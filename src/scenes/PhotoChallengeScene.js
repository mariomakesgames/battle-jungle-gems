import { AIDuelScene } from './AIDuelScene';
import { Board } from '../objects/Board';
import { PowerupVFXManager } from '../objects/vfx/PowerupVFXManager';
import { startAssetStream } from './AssetStreamScene';
import { DUEL_COLORS } from '../ai/ChooseMove';
import AudioManager from '../managers/AudioManager';
import LanguageManager from '../i18n/LanguageManager';
import { PHOTO_LEVELS, PhotoRun, photoCollection, photoKey, photoPath, REVEAL_ORDER } from '../beauty/PhotoRules';
import { bindPointerLifecycle } from '../input/BoardGesture';

const PHOTO = { x: 168, y: 126, width: 240, height: 300 };
const GRID = { x: 72, y: 478, cell: 48, size: 432 };

// Reuse only the duel's board assets, gestures and common buttons. There is no AI.
export class PhotoChallengeScene extends AIDuelScene {
    constructor() { super('PhotoChallengeScene'); }
    supportsTutorial() { return false; }

    init(data = {}) {
        super.init(data);
        this.index = photoCollection.canPlay(data.index) ? data.index : Math.min(photoCollection.completed, PHOTO_LEVELS.length - 1);
        this.viewing = !!data.viewing && photoCollection.isCollected(this.index);
        this.level = PHOTO_LEVELS[this.index];
        this.run = new PhotoRun(this.level);
        this.coverTiles = [];
    }

    preload() {
        if (!this.viewing) super.preload();
        if (!this.textures.exists(photoKey(this.index))) this.load.image(photoKey(this.index), photoPath(this.index));
    }

    create() {
        this.sound.stopAll();
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        this.add.rectangle(288, 512, 576, 1024, 0x101c30, 0.94);
        this.events.once('shutdown', this.cleanup, this);
        if (!this.textures.exists(photoKey(this.index))) {
            this.makeLabel(288, 390, 'beautyImageError', 25);
            this.button(288, 505, 260, 'restart', () => this.scene.restart({ index: this.index, viewing: this.viewing, returnScene: this.returnScene }), 'beauty-load-retry');
            this.button(288, 585, 260, 'beautyAlbum', () => this.leave(), 'beauty-load-back');
            return;
        }
        if (this.viewing) { this.showPhoto(true); return; }

        this.makeLabel(288, 58, this.level.title, 30, {}, 290);
        this.button(67, 58, 100, 'duelBack', () => this.leave(), 'beauty-exit');
        this.button(509, 58, 100, 'pause', () => this.showPause(), 'beauty-pause');
        this.scoreLabel = this.makeLabel(173, 102, 'beautyScore', 21, () => ({ score: this.run.score, target: this.level.target }), 285);
        this.movesLabel = this.makeLabel(447, 102, 'beautyMoves', 21, () => ({ count: this.run.movesLeft }), 190);

        this.add.rectangle(288, 276, 250, 310, 0x0b1323).setStrokeStyle(3, 0xe8bd70);
        this.portrait = this.add.image(288, 276, photoKey(this.index)).setDisplaySize(PHOTO.width, PHOTO.height).setDepth(20);
        this.coverTiles = Array.from({ length: 48 }, (_, index) => {
            const tile = this.add.rectangle(PHOTO.x + (index % 6 + 0.5) * 40, PHOTO.y + (Math.floor(index / 6) + 0.5) * 37.5,
                40, 37.5, index % 2 ? 0x20314b : 0x19283f).setStrokeStyle(1, 0x3b526d).setDepth(21);
            tile.revealed = false;
            return tile;
        });
        this.add.rectangle(288, 442, 260, 10, 0x32455f);
        this.progressBar = this.add.rectangle(158, 442, 0, 10, 0xe8bd70).setOrigin(0, 0.5);
        this.progressLabel = this.makeLabel(288, 460, 'beautyRevealProgress', 18, () => ({ percent: Math.floor(this.run.progress * 100) }));

        this.add.rectangle(288, 694, 448, 448, 0x263449).setStrokeStyle(3, 0xe8bd70);
        this.gemLayer = this.add.layer().setDepth(4);
        this.vfxLayer = this.add.layer().setDepth(25);
        const mask = this.make.graphics().fillStyle(0xffffff).fillRect(GRID.x, GRID.y, GRID.size, GRID.size).createGeometryMask();
        this.gemLayer.setMask(mask);
        this.vfxLayer.setMask(mask);
        this.powerupVFXManager = new PowerupVFXManager(this, this.vfxLayer);
        this.board = new Board(this, GRID.x, GRID.y, GRID.cell, this.powerupVFXManager, this.gemLayer);
        this.board.maybeEmitLevelCompleted = () => {};
        this.loadBoard();
        this.makeLabel(288, 944, 'beautyRules', 18, {}, 530);
        this.button(288, 990, 180, 'beautyHint', () => {
            if (this.canPlayerAct()) this.board.showHint();
        }, 'beauty-hint');

        this.events.on('swapAccepted', this.onAccepted, this);
        this.game.events.on('addScore', this.onScore, this);
        this.game.events.on('boardBusy', this.onBusy, this);
        this.game.events.on('levelFailed', this.onShuffleFailed, this);
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

    performMove(move) {
        if (!this.canPlayerAct() || Math.abs(move.r1 - move.r2) + Math.abs(move.c1 - move.c2) !== 1) return false;
        const a = this.board.grid[move.r1]?.[move.c1], b = this.board.grid[move.r2]?.[move.c2];
        if (!a || !b || !this.run.begin()) return false;
        this.board.clearHint();
        this.board.clearSelection();
        this.board.swapGems(a, b);
        return true;
    }

    onAccepted() { this.run.accept(); this.refresh(); }
    onScore(points) { if (this.run.addScore(points)) this.refresh(); }

    onBusy(busy) {
        if (busy) this.cancelBoardGesture();
        if (busy || this.board.consecutiveShuffleFailures >= 3 || this.run.finished) return;
        this.run.settle();
        this.refresh();
        if (this.run.finished) {
            if (this.run.won) { photoCollection.collect(this.index); this.showPhoto(false); }
            else this.showFailure();
        }
    }

    refresh() {
        if (!this.scoreLabel) return;
        this.scoreLabel.setText(LanguageManager.t('beautyScore', { score: this.run.score, target: this.level.target }));
        this.movesLabel.setText(LanguageManager.t('beautyMoves', { count: this.run.movesLeft }));
        this.progressLabel.setText(LanguageManager.t('beautyRevealProgress', { percent: Math.floor(this.run.progress * 100) }));
        this.progressBar.width = 260 * this.run.progress;
        const count = Math.floor(this.run.progress * this.coverTiles.length);
        for (const index of REVEAL_ORDER.slice(0, count)) {
            const tile = this.coverTiles[index];
            if (tile.revealed) continue;
            tile.revealed = true;
            this.tweens.add({ targets: tile, alpha: 0, duration: 400, ease: 'Cubic.easeOut' });
        }
    }

    showPhoto(viewing) {
        if (this.resultShown) return;
        this.resultShown = true;
        const panel = this.add.container(0, 0).setDepth(100);
        panel.add(this.add.rectangle(288, 512, 576, 1024, 0x101c30, 0.98).setInteractive());
        panel.add(this.makeLabel(288, 107, viewing ? 'beautyCollected' : 'beautyUnlocked', 34));
        panel.add(this.makeLabel(288, 159, this.level.title, 24));
        panel.add(this.add.rectangle(288, 429, 350, 434, 0x0b1323).setStrokeStyle(3, 0xe8bd70));
        panel.add(this.add.image(288, 429, photoKey(this.index)).setDisplaySize(336, 420).setName('beauty-full-photo'));
        const hasNext = this.index + 1 < PHOTO_LEVELS.length;
        const label = viewing ? 'beautyReplay' : hasNext ? 'beautyNext' : 'beautyAllCollected';
        this.button(288, 744, 320, label, () => {
            if (viewing) this.scene.restart({ index: this.index, returnScene: this.returnScene });
            else if (hasNext) this.scene.restart({ index: this.index + 1, returnScene: this.returnScene });
            else this.leave();
        }, 'beauty-next', panel);
        this.button(288, 822, 260, 'beautyAlbum', () => this.leave(), 'beauty-result-album', panel);
        panel.add(this.makeLabel(288, 916, 'beautySaveHint', 18));
    }

    showFailure() {
        this.resultShown = true;
        const panel = this.add.container(0, 0).setDepth(100);
        panel.add(this.add.rectangle(288, 512, 576, 1024, 0x101c30, 0.88).setInteractive());
        panel.add(this.makeLabel(288, 380, 'beautyFailed', 34));
        panel.add(this.makeLabel(288, 455, 'beautyTryAgain', 22));
        this.button(288, 555, 260, 'beautyReplay', () => this.scene.restart({ index: this.index, returnScene: this.returnScene }), 'beauty-retry', panel);
        this.button(288, 635, 260, 'beautyAlbum', () => this.leave(), 'beauty-result-album', panel);
    }

    showPause() {
        if (this.paused || this.run.finished || this.board.boardBusy) return;
        super.showPause();
    }

    leave() { this.scene.start('PhotoAlbumScene', { returnScene: this.returnScene }); }

    cleanup() {
        // Scene instances are reused by Phaser; clear references to destroyed HUDs.
        this.scoreLabel = null;
        super.cleanup();
    }
}
