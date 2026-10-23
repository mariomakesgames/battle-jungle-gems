import { playGameSfx } from '../managers/GameSfx.js';
import { AIDuelScene } from './AIDuelScene';
import { Board } from '../objects/Board';
import { PowerupVFXManager } from '../objects/vfx/PowerupVFXManager';
import { startAssetStream } from './AssetStreamScene';
import { DUEL_COLORS } from '../ai/ChooseMove';
import AudioManager from '../managers/AudioManager';
import LanguageManager from '../i18n/LanguageManager';
import { PHOTO_LEVELS, PhotoRun, photoCollection, canEnterPhotoLevel, photoKey, photoPath, classicPhotoKey, photoBoardPath, copyClassicPhotoBoard } from '../beauty/PhotoRules';
import { bindPointerLifecycle } from '../input/BoardGesture';
import { PhotoBoosters, queuePhotoBoosters } from '../beauty/PhotoBoosters';
import { PhotoRevealVFX } from '../beauty/PhotoRevealVFX.js';
import { BADDIE, fashionBackground, fashionCard, queueBaddieTheme } from '../ui/BaddieTheme.js';

const PHOTO = { x: 168, y: 126, width: 240, height: 300 };
const GRID = { x: 72, y: 478, cell: 48, size: 432 };

// Reuse only the duel's board assets, gestures and common buttons. There is no AI.
export class PhotoChallengeScene extends AIDuelScene {
    constructor() { super('PhotoChallengeScene'); }
    supportsTutorial() { return false; }

    init(data = {}) {
        super.init(data);
        this.fashionTheme = true;
        this.selectionScene = data.selectionScene || 'BaddieMapScene';
        this.selectionLabel = this.selectionScene === 'BaddieMapScene' ? 'baddieLevels' : 'beautyAlbum';
        this.mapReturnScene = data.mapReturnScene || 'TitleScene';
        this.index = canEnterPhotoLevel(data.index) ? data.index : Math.min(photoCollection.completed, PHOTO_LEVELS.length - 1);
        this.viewing = !!data.viewing && photoCollection.isCollected(this.index);
        this.level = PHOTO_LEVELS[this.index];
        this.hasAuthoredBoard = !!(this.level.classicLevel || this.level.importedLevel);
        this.run = new PhotoRun(this.level);
        this.coverTiles = [];
        this.blockerAssets = [];
        this.activeBooster = null;
        this.boosters = null;
        this.boosterHelp = null;
        this.revealVFX = null;
        this.resultQueued = false;
        this.lastMoves = null;
        this.hintButton = null;
    }

    preload() {
        queueBaddieTheme(this);
        if (!this.viewing) super.preload();
        if (!this.viewing) queuePhotoBoosters(this);
        if (!this.viewing && this.hasAuthoredBoard) {
            const key = classicPhotoKey(this.level);
            if (!this.cache.json.exists(key)) this.load.json(key, photoBoardPath(this.level));
            const types = this.level.objectives.filter(goal => goal.target === 'blocker').map(goal => goal.type);
            this.blockerAssets = [['blocker_stone_1', 'blocker_stone_2'], ['blocker_stone_2', 'blocker_stone_1'], ['blocker_rope', 'blocker_rope']]
                .filter(([key]) => types.some(type => key.startsWith(`blocker_${type}`)));
            for (const [key, file] of this.blockerAssets) {
                if (!this.textures.exists(key)) this.load.image(key, `assets/images/gameplay/blockers/${file}.png`);
            }
        }
        if (!this.textures.exists(photoKey(this.index))) this.load.image(photoKey(this.index), photoPath(this.index));
    }

    create() {
        this.sound.stopAll();
        fashionBackground(this, .52);
        this.events.once('shutdown', this.cleanup, this);
        const missingBoard = !this.viewing && this.hasAuthoredBoard &&
            (!this.cache.json.exists(classicPhotoKey(this.level)) || this.blockerAssets.some(([key]) => !this.textures.exists(key)));
        if (!this.textures.exists(photoKey(this.index)) || missingBoard) {
            this.makeLabel(288, 390, missingBoard ? 'beautyLevelError' : 'beautyImageError', 25);
            this.button(288, 505, 260, 'restart', () => this.scene.restart({ index: this.index, viewing: this.viewing, ...this.navigationData() }), 'beauty-load-retry');
            this.button(288, 585, 260, this.selectionLabel, () => this.leave(), 'beauty-load-back');
            return;
        }
        if (this.viewing) { this.showPhoto(true); return; }

        this.add.text(288, 29, 'B A D D I E   C L U B', { fontFamily: BADDIE.font, fontSize: '11px', color: BADDIE.muted }).setOrigin(.5);
        this.makeLabel(288, 58, this.level.title, 26, this.level.titleParams, 290);
        this.button(67, 58, 100, 'duelBack', () => this.leave(), 'beauty-exit');
        this.button(509, 58, 100, 'pause', () => this.showPause(), 'beauty-pause');


        fashionCard(this, 170, 102, 250, 32, 10);
        fashionCard(this, 447, 102, 190, 32, 10);
        this.scoreLabel = this.makeLabel(170, 102, this.hasAuthoredBoard ? 'beautyCurrentScore' : 'beautyScore', 21, () => ({ score: this.run.score, target: this.level.target }), 285);
        this.movesLabel = this.makeLabel(447, 102, 'beautyMoves', 21, () => ({ count: this.run.movesLeft }), 190);

        fashionCard(this, 288, 276, 256, 316, 18);
        this.portrait = this.add.image(288, 276, photoKey(this.index)).setDisplaySize(PHOTO.width, PHOTO.height).setDepth(20);
        this.coverTiles = Array.from({ length: 48 }, (_, index) => {
            const tile = this.add.rectangle(PHOTO.x + (index % 6 + 0.5) * 40, PHOTO.y + (Math.floor(index / 6) + 0.5) * 37.5,
                40, 37.5, index % 2 ? 0x28212f : 0x241e2b).setStrokeStyle(1, 0x443448, .45).setDepth(21);
            tile.revealed = false;
            return tile;
        });
        this.revealVFX = new PhotoRevealVFX(this, this.coverTiles);
        this.add.rectangle(288, 442, 244, 10, 0x130d1a).setStrokeStyle(1, BADDIE.gold, .5);
        this.add.rectangle(288, 442, 240, 6, 0x3a2440);
        this.progressBar = this.add.rectangle(168, 442, 0, 6, BADDIE.pink).setOrigin(0, 0.5);
        this.progressLabel = this.makeLabel(288, 459, 'beautyRevealProgress', 16, () => ({ percent: Math.floor(this.run.progress * 100) }));

        fashionCard(this, 288, 694, 464, 456, 20);
        this.add.rectangle(288, 965, 520, 1, 0xc2a4b7, .12);
        this.gemLayer = this.add.layer().setDepth(4);
        this.vfxLayer = this.add.layer().setDepth(25);
        const mask = this.make.graphics().fillStyle(0xffffff).fillRect(GRID.x, GRID.y, GRID.size, GRID.size).createGeometryMask();
        this.gemLayer.setMask(mask);
        this.vfxLayer.setMask(mask);
        this.powerupVFXManager = new PowerupVFXManager(this, this.vfxLayer);
        const gridSize = this.hasAuthoredBoard ? this.cache.json.get(classicPhotoKey(this.level)).gridSize || 9 : 9;
        this.board = new Board(this, GRID.x, GRID.y, GRID.size / gridSize, this.powerupVFXManager, this.gemLayer, gridSize);
        this.board.maybeEmitLevelCompleted = () => {};
        this.loadBoard();
        if (this.hasAuthoredBoard) {
            this.goalBadges = this.add.container(288, 940).setDepth(30);
            this.goalCounters = this.run.objectives.map((goal, index, goals) => {
                const x = (index - (goals.length - 1) / 2) * 112;
                const surface = fashionCard(this, x, 0, 100, 34, 10);
                const texture = goal.target === 'blocker' ? this.blockerTexture(goal.type === 'stone' ? 'stone_2' : goal.type) : this.pieceTexture(goal.type);
                const icon = this.add.image(x - 27, 0, texture).setDisplaySize(29, 29);
                const count = this.add.text(x + 15, 0, '', { fontFamily: BADDIE.font, fontSize: '22px', color: '#ffe5b5', stroke: '#301529', strokeThickness: 2 }).setOrigin(.5);
                this.goalBadges.add([surface, icon, count]);
                return { goal, icon, count };
            });
            this.boosterHelp = this.makeLabel(288, 941, 'beautyClassicRules', 16, {}, 530);
        } else this.makeLabel(288, 944, 'beautyRules', 18, {}, 530);
        this.boosters = new PhotoBoosters(this);
        this.hintButton = this.button(500, 990, 120, 'beautyHint', () => {
            if (this.canPlayerAct()) {
                this.boosters.clear();
                this.board.showHint();
            }
        }, 'beauty-hint');
        this.hintLabel = this.hintButton.getData('label');

        this.events.on('swapAccepted', this.onAccepted, this);
        this.game.events.on('addScore', this.onScore, this);
        this.game.events.on('boardBusy', this.onBusy, this);
        this.game.events.on('levelFailed', this.onShuffleFailed, this);
        this.game.events.on('objectiveUpdated', this.onObjectiveUpdated, this);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointerup', this.onUp, this);
        this.removePointerLifecycle = bindPointerLifecycle(this, this.onUp, this.cancelBoardGesture);
        this.unsubscribe = LanguageManager.subscribe(() => this.refresh());
        this.game.events.on('musicVolumeChanged', this.onMusicVolume, this);
        this.musicStream = startAssetStream(this, {
            audio: [{ key: 'map_01', path: 'assets/sounds/optimized/map_01.m4a' }],
            onComplete: () => {
                this.musicStream = null;
                this.music = this.sound.add('map_01', { loop: true, volume: 0.2 * AudioManager.getMusicVolume() });
                this.music.play();
                if (this.paused) this.music.pause();
            },
        });
        this.refresh();
    }

    canPlayerAct() { return !this.paused && !this.run.finished && !this.run.pending && !this.board.boardBusy; }

    pieceTexture(type) { return this.textures.exists(`baddie_${type}`) ? `baddie_${type}` : `gem_${type}`; }
    blockerTexture(type) { return this.textures.exists(`baddie_${type}`) ? `baddie_${type}` : `blocker_${type}`; }

    onDown(pointer) {
        if (!this.activeBooster) super.onDown(pointer);
    }

    onUp(pointer) {
        if (this.activeBooster) {
            const cell = this.cellAt(pointer);
            if (cell) this.boosters.target(cell.r, cell.c);
            return;
        }
        super.onUp(pointer);
    }

    loadBoard() {
        if (!this.hasAuthoredBoard) return super.loadBoard();
        const definition = copyClassicPhotoBoard(this.cache.json.get(classicPhotoKey(this.level)));
        this.board.loadLevel(definition);
        for (const powerup of definition.initialPowerups || []) {
            this.board.transformIntoPowerup(this.board.grid[powerup.row][powerup.col], powerup.type);
        }
        this.board.initializeObjectives(definition);
        // PhotoRun owns the move budget and result; campaign events must not fire.
        this.board.isMoveBasedLevel = false;
        this.run = new PhotoRun({ ...this.level, moves: definition.maxMoves, objectives: definition.objectives });
    }

    performMove(move) {
        if (!this.canPlayerAct() || Math.abs(move.r1 - move.r2) + Math.abs(move.c1 - move.c2) !== 1) return false;
        const a = this.board.grid[move.r1]?.[move.c1], b = this.board.grid[move.r2]?.[move.c2];
        if (!a || !b || a.type !== 'gem' || b.type !== 'gem' ||
            this.board.isCellBlockedForMovement(move.r1, move.c1) || this.board.isCellBlockedForMovement(move.r2, move.c2) || !this.run.begin()) return false;
        this.board.clearHint();
        this.board.clearSelection();
        this.board.swapGems(a, b);
        return true;
    }

    onAccepted() {
        if (this.run.accept() && [5, 1].includes(this.run.movesLeft)) playGameSfx(this, 'low_moves');
        this.refresh();
    }
    onScore(points) { if (this.run.addScore(points)) this.refresh(); }

    onObjectiveUpdated({ key, remaining }) {
        if (this.run.updateObjective(key, remaining)) this.refresh();
    }

    onShuffleFailed() {
        if (!this.hasAuthoredBoard) return super.onShuffleFailed();
        this.cancelBoardGesture();
        this.input.enabled = true;
        this.board.boardBusy = false;
        this.run.settle();
        this.run.finished = true;
        this.refresh();
        this.queueResult();
    }

    onBusy(busy) {
        if (busy) this.cancelBoardGesture();
        this.boosters?.refresh();
        this.refreshHint(busy);
        if (busy || this.board.consecutiveShuffleFailures >= 3 || this.run.finished) return;
        this.run.settle();
        this.refresh();
        if (this.run.finished) {
            this.queueResult();
        }
    }

    queueResult() {
        if (this.resultQueued) return;
        this.resultQueued = true;
        this.revealVFX.whenIdle(() => {
            if (this.run.won) { photoCollection.collect(this.index); this.showPhoto(false); }
            else this.showFailure();
        });
    }

    refreshHint(busy = this.board?.boardBusy) {
        if (!this.hintButton?.active) return;
        const enabled = !busy && this.canPlayerAct();
        this.hintButton.input.enabled = enabled;
        this.hintButton.setAlpha(enabled ? 1 : .4);
        this.hintLabel?.setAlpha(enabled ? 1 : .4);
    }

    refresh() {
        if (!this.scoreLabel) return;
        this.scoreLabel.setText(LanguageManager.t(this.hasAuthoredBoard ? 'beautyCurrentScore' : 'beautyScore', { score: this.run.score, target: this.level.target }));
        for (const { goal, count, icon } of this.goalCounters || []) {
            const remaining = Math.max(0, goal.remaining ?? goal.count);
            count.setText(remaining === 0 ? '✓' : String(remaining)).setColor(remaining === 0 ? '#9ce4be' : '#ffe5b5');
            icon.setAlpha(remaining === 0 ? .55 : 1);
        }
        this.movesLabel.setText(LanguageManager.t('beautyMoves', { count: this.run.movesLeft }));
        this.movesLabel.setColor(this.run.movesLeft <= 5 ? '#ff97ae' : BADDIE.text);
        if (this.lastMoves !== null && this.lastMoves !== this.run.movesLeft) {
            this.tweens.killTweensOf(this.movesLabel);
            this.movesLabel.setScale(1);
            this.tweens.add({ targets: this.movesLabel, scale: 1.1, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
        }
        this.lastMoves = this.run.movesLeft;
        this.refreshHint();
        this.progressLabel.setText(LanguageManager.t('beautyRevealProgress', { percent: Math.floor(this.run.progress * 100) }));
        this.tweens.killTweensOf(this.progressBar);
        this.tweens.add({ targets: this.progressBar, width: 240 * this.run.progress, duration: 220, ease: 'Sine.easeOut' });
        this.boosters?.refresh();
        this.revealVFX?.reveal(this.run.progress);
    }

    showPhoto(viewing) {
        if (this.resultShown) return;
        if (!viewing) playGameSfx(this, 'win');
        this.resultShown = true;
        const panel = this.add.container(0, 0).setDepth(100);
        panel.add(this.add.rectangle(288, 512, 576, 1024, BADDIE.ink, 0.98).setInteractive());
        panel.add(this.makeLabel(288, 107, viewing ? 'beautyCollected' : 'beautyUnlocked', 34));
        panel.add(this.makeLabel(288, 159, this.level.title, 24, this.level.titleParams));
        panel.add(this.add.rectangle(288, 429, 350, 434, BADDIE.panel).setStrokeStyle(2, BADDIE.gold));
        panel.add(this.add.image(288, 429, photoKey(this.index)).setDisplaySize(336, 420).setName('beauty-full-photo'));
        const hasNext = this.index + 1 < PHOTO_LEVELS.length;
        const label = viewing ? 'beautyReplay' : hasNext ? 'beautyNext' : 'beautyAllCollected';
        this.button(288, 744, 320, label, () => {
            if (viewing) this.scene.restart({ index: this.index, ...this.navigationData() });
            else if (hasNext) this.scene.restart({ index: this.index + 1, ...this.navigationData() });
            else this.leave();
        }, 'beauty-next', panel);
        this.button(288, 822, 260, this.selectionLabel, () => this.leave(), 'beauty-result-album', panel);
        panel.add(this.makeLabel(288, 916, 'beautySaveHint', 18));
    }

    showFailure() {
        if (this.resultShown) return;
        playGameSfx(this, 'lose');
        this.resultShown = true;
        const panel = this.add.container(0, 0).setDepth(100);
        panel.add(this.add.rectangle(288, 512, 576, 1024, BADDIE.ink, 0.94).setInteractive());
        panel.add(fashionCard(this, 288, 510, 440, 390, 24));
        panel.add(this.makeLabel(288, 380, 'beautyFailed', 34));
        panel.add(this.makeLabel(288, 455, 'beautyTryAgain', 22));
        this.button(288, 555, 260, 'beautyReplay', () => this.scene.restart({ index: this.index, ...this.navigationData() }), 'beauty-retry', panel);
        this.button(288, 635, 260, this.selectionLabel, () => this.leave(), 'beauty-result-album', panel);
    }

    showPause() {
        if (this.paused || this.run.finished || this.board.boardBusy || this.run.pending) return;
        this.boosters?.clear();
        super.showPause();
    }

    navigationData() { return { returnScene: this.returnScene, selectionScene: this.selectionScene, mapReturnScene: this.mapReturnScene }; }

    leave() { this.scene.start(this.selectionScene, { ...this.navigationData(), focusIndex: this.index }); }

    cleanup() {
        this.revealVFX?.destroy();
        this.revealVFX = null;
        this.boosters?.destroy();
        this.boosters = null;
        this.boosterHelp = null;
        // Scene instances are reused by Phaser; clear references to destroyed HUDs.
        fashionCard(this, 170, 102, 250, 32, 10);
        fashionCard(this, 447, 102, 190, 32, 10);
        this.scoreLabel = null;
        this.goalBadges = null;
        this.goalCounters = [];
        this.game.events.off('objectiveUpdated', this.onObjectiveUpdated, this);
        super.cleanup();
    }
}
