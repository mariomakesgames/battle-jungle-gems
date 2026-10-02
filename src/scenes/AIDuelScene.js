import Phaser from 'phaser';
import { Board } from '../objects/Board';
import { PowerupVFXManager } from '../objects/vfx/PowerupVFXManager';
import { queueAssetGroup } from '../utils/AssetGroups';
import { startAssetStream } from './AssetStreamScene';
import { bindText } from '../ui/LocalizedUI';
import LanguageManager from '../i18n/LanguageManager';
import AudioManager from '../managers/AudioManager';
import { DuelRules } from '../ai/DuelRules';
import { chooseMove, makeDuelGrid, DUEL_COLORS } from '../ai/ChooseMove';

export class AIDuelScene extends Phaser.Scene {
    constructor() { super('AIDuelScene'); }

    init(data = {}) {
        this.returnScene = data.returnScene || 'TitleScene';
        this.duel = new DuelRules();
        this.paused = false;
        this.aiTimer = null;
        this.musicStream = null;
        this.music = null;
        this.downCell = null;
        this.resultShown = false;
        this.noticeKey = null;
    }

    preload() {
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        const loading = bindText(this.add.text(288, 512, '', { fontSize: '28px' }).setOrigin(0.5),
            'loading', () => ({ percent: Math.round(this.load.progress * 100) }));
        const onProgress = progress => loading.setText(LanguageManager.t('loading', { percent: Math.round(progress * 100) }));
        this.load.on('progress', onProgress);
        this.events.once('create', () => { this.load.off('progress', onProgress); loading.destroy(); });
        queueAssetGroup(this, 'gameplay');
        for (const color of [...DUEL_COLORS, 'bomb', 'stripe', 'color_bomb', 'color_bomb_op']) {
            const key = `gem_${color}`;
            if (!this.textures.exists(key)) this.load.image(key, `assets/images/gameplay/gems/${color}.png`);
        }
        for (let i = 1; i <= 4; i++) {
            if (!this.textures.exists(`note${i}`)) this.load.image(`note${i}`, `assets/images/vfx/note${i}.png`);
        }
    }

    create() {
        this.sound.stopAll();
        this.add.image(288, 512, 'map1_background').setDisplaySize(576, 1024);
        this.add.rectangle(288, 512, 576, 1024, 0x16291d, 0.65);
        this.makeLabel(288, 58, 'aiDuel', 32);
        this.roundLabel = this.makeLabel(288, 112, 'duelRound', 22,
            () => ({ round: this.duel.round, total: this.duel.totalRounds }));
        for (const [actor, x, color] of [['player', 156, 0x174b50], ['ai', 420, 0x583751]]) {
            this.add.rectangle(x, 189, 240, 112, color, 0.96).setStrokeStyle(2, 0xe8bd70);
            this.makeLabel(x, 165, actor === 'player' ? 'duelYou' : 'duelAI', 22);
            const score = this.add.text(x, 207, '0', { fontSize: '32px', color: '#fff2ab' }).setOrigin(0.5);
            if (actor === 'player') this.playerScore = score; else this.aiScore = score;
        }
        this.turnLabel = this.makeLabel(288, 279, 'duelYourTurn', 26);
        this.swapsLabel = this.makeLabel(288, 317, 'duelSwaps', 22, () => ({ count: this.duel.swapsLeft }));
        this.add.rectangle(288, 603, 512, 512, 0x342819, 0.95).setStrokeStyle(4, 0xe8bd70);
        this.gemLayer = this.add.layer().setDepth(4);
        this.vfxLayer = this.add.layer().setDepth(25);
        const mask = this.make.graphics().fillStyle(0xffffff).fillRect(45, 360, 486, 486).createGeometryMask();
        this.gemLayer.setMask(mask);
        this.vfxLayer.setMask(mask);
        this.powerupVFXManager = new PowerupVFXManager(this, this.vfxLayer);
        this.board = new Board(this, 45, 360, 54, this.powerupVFXManager, this.gemLayer);
        // This free-play board has its own result; campaign objectives stay separate.
        this.board.maybeEmitLevelCompleted = () => {};
        this.loadBoard();
        this.makeLabel(288, 892, 'duelRules', 18, {}, 530);
        this.notice = this.add.text(288, 941, '', { fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#ffdf82' }).setOrigin(0.5);
        this.button(67, 58, 100, this.returnScene === 'MapScene' ? 'quit' : 'duelBack', () => this.leave(), 'duel-exit');
        this.button(509, 58, 100, 'pause', () => this.showPause(), 'duel-pause');

        this.events.on('swapAccepted', this.onAccepted, this);
        this.game.events.on('addScore', this.onScore, this);
        this.game.events.on('boardBusy', this.onBusy, this);
        this.game.events.on('levelFailed', this.onShuffleFailed, this);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointerup', this.onUp, this);
        this.unsubscribe = LanguageManager.subscribe(() => this.refresh());
        this.game.events.on('musicVolumeChanged', this.onMusicVolume, this);
        this.musicStream = startAssetStream(this, {
            audio: [{ key: 'map_01', path: 'assets/sounds/optimized/map_01.m4a' }],
            onComplete: () => {
                this.musicStream = null;
                this.music = this.sound.add('map_01', { loop: true, volume: 0.2 * AudioManager.getMusicVolume() });
                this.music.play();
                if (this.paused) this.music.pause();
            }
        });
        this.events.once('shutdown', this.cleanup, this);
        this.refresh();
    }

    makeLabel(x, y, key, size, params = {}, width = 500) {
        return bindText(this.add.text(x, y, '', { fontSize: `${size}px`, color: '#fff5df', align: 'center' })
            .setOrigin(0.5).setDepth(30), key, params, width);
    }

    button(x, y, width, key, action, name, parent = null) {
        const box = this.add.rectangle(x, y, width, 44, 0x713719).setStrokeStyle(2, 0xe8bd70)
            .setInteractive({ useHandCursor: true }).setDepth(60).setName(name);
        const label = this.makeLabel(x, y, key, 20, {}, width - 10).setDepth(61);
        box.on('pointerdown', action);
        if (parent) parent.add([box, label]);
        return box;
    }

    loadBoard() {
        const colors = makeDuelGrid();
        const indexes = ['red', 'green', 'blue', 'purple', 'yellow', 'orange'];
        this.board.loadLevel({
            gridLayout: colors.map(row => row.map(color => indexes.indexOf(color) + 1)),
            availableGems: DUEL_COLORS,
        });
    }

    canPlayerAct() { return !this.paused && !this.duel.finished && !this.duel.pending && this.duel.actor === 'player' && !this.board.boardBusy; }

    cellAt(pointer) {
        const r = Math.floor((pointer.y - 360) / 54), c = Math.floor((pointer.x - 45) / 54);
        return this.board.isValidCell(r, c) ? { r, c } : null;
    }

    onDown(pointer) { this.downCell = this.canPlayerAct() ? this.cellAt(pointer) : null; }

    onUp(pointer) {
        if (!this.canPlayerAct() || !this.downCell) return;
        const from = this.downCell, to = this.cellAt(pointer);
        this.downCell = null;
        if (!to) return;
        if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) === 1) {
            this.performMove({ r1: from.r, c1: from.c, r2: to.r, c2: to.c }, 'player');
            return;
        }
        if (from.r !== to.r || from.c !== to.c) return;
        const selected = this.board.selectedGem;
        const gem = this.board.grid[to.r][to.c];
        if (selected && this.board.areNeighbors(selected, gem)) {
            this.performMove({ r1: selected.sprite.getData('row'), c1: selected.sprite.getData('col'), r2: to.r, c2: to.c }, 'player');
        } else this.board.handleGemClick(to.r, to.c);
    }

    performMove(move, actor) {
        if (this.paused || this.board.boardBusy || Math.abs(move.r1 - move.r2) + Math.abs(move.c1 - move.c2) !== 1) return false;
        const a = this.board.grid[move.r1]?.[move.c1], b = this.board.grid[move.r2]?.[move.c2];
        if (!a || !b || !this.duel.begin(actor)) return false;
        this.board.clearSelection();
        this.board.swapGems(a, b);
        return true;
    }

    onAccepted({ special }) {
        if (!this.duel.accept(special)) return;
        this.noticeKey = special ? 'duelBonus' : null;
        this.refresh();
    }

    onScore(points) { this.duel.addScore(points); this.refresh(); }

    onBusy(busy) {
        if (busy || this.board.consecutiveShuffleFailures >= 3) return;
        this.duel.settle();
        this.refresh();
        if (this.duel.finished) this.showResult();
        else this.scheduleAI();
    }

    onShuffleFailed() {
        this.loadBoard();
        this.input.enabled = true;
        this.onBusy(false);
    }

    scheduleAI() {
        if (this.duel.actor !== 'ai' || this.duel.pending || this.aiTimer || this.duel.finished) return;
        this.aiTimer = this.time.delayedCall(700, () => {
            this.aiTimer = null;
            const move = chooseMove(this.board.grid.map(row => row.map(gem => gem?.value || null)));
            if (move) this.performMove(move, 'ai');
            else this.board.triggerAutoShuffle();
        });
    }

    refresh() {
        this.roundLabel.setText(LanguageManager.t('duelRound', { round: this.duel.round, total: this.duel.totalRounds }));
        this.turnLabel.setText(LanguageManager.t(this.duel.actor === 'player' ? 'duelYourTurn' : 'duelAIThinking'));
        this.swapsLabel.setText(LanguageManager.t('duelSwaps', { count: this.duel.swapsLeft }));
        this.playerScore.setText(String(this.duel.scores.player));
        this.aiScore.setText(String(this.duel.scores.ai));
        this.notice.setText(this.noticeKey ? LanguageManager.t(this.noticeKey) : '');
    }

    showResult() {
        if (this.resultShown) return;
        this.resultShown = true;
        this.add.rectangle(288, 512, 576, 1024, 0x08120d, 0.84).setDepth(50).setInteractive();
        this.makeLabel(288, 385, { player: 'duelWin', ai: 'duelLose', draw: 'duelDraw' }[this.duel.winner], 38).setDepth(60);
        this.makeLabel(288, 470, 'duelFinalScore', 27, () => this.duel.scores).setDepth(60);
        this.button(288, 560, 260, 'restart', () => this.scene.restart({ returnScene: this.returnScene }), 'duel-replay');
        this.button(288, 635, 260, this.returnScene === 'MapScene' ? 'quit' : 'duelBack', () => this.leave(), 'duel-result-exit');
    }

    showPause() {
        if (this.paused || this.duel.finished || this.board.boardBusy) return;
        this.paused = true;
        this.downCell = null;
        this.time.paused = true;
        this.tweens.pauseAll();
        this.music?.pause();
        this.pausePanel = this.add.container(0, 0).setDepth(100);
        this.pausePanel.add(this.add.rectangle(288, 512, 576, 1024, 0x08120d, 0.88).setInteractive());
        this.pausePanel.add(this.makeLabel(288, 405, 'pause', 36));
        this.button(288, 510, 260, 'continue', () => {
            this.pausePanel.destroy(true);
            this.paused = false;
            this.time.paused = false;
            this.tweens.resumeAll();
            this.music?.resume();
        }, 'duel-resume', this.pausePanel);
        this.button(288, 590, 260, 'duelBack', () => this.leave(), 'duel-pause-exit', this.pausePanel);
    }

    onMusicVolume(volume) { this.music?.setVolume(0.2 * volume); }
    leave() { this.scene.start(this.returnScene); }

    cleanup() {
        this.aiTimer?.remove();
        this.musicStream?.cancel();
        this.music?.destroy();
        this.unsubscribe?.();
        this.game.events.off('addScore', this.onScore, this);
        this.game.events.off('boardBusy', this.onBusy, this);
        this.game.events.off('levelFailed', this.onShuffleFailed, this);
        this.game.events.off('musicVolumeChanged', this.onMusicVolume, this);
        this.events.off('swapAccepted', this.onAccepted, this);
        this.input.off('pointerdown', this.onDown, this);
        this.input.off('pointerup', this.onUp, this);
        this.time.paused = false;
        this.input.enabled = true;
        this.resultShown = false;
        this.noticeKey = null;
    }
}
