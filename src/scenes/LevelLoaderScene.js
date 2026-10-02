import { queueAssetGroup } from '../utils/AssetGroups';
import Phaser from 'phaser';

export class LevelLoaderScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelLoaderScene' });
        this.levelId = 1;
    }

    init(data) {
        this.levelId = data.levelId;
        this.transitionStarted = false;
    }

    preload() {
        const { width, height } = this.scale;
        // Reuse the boot artwork instead of downloading six large loading-only images.
        const bg = this.add.image(width / 2, height / 2, 'preloading_background');
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        const progressBar = this.add.image(290, 593, 'loading_level_progressbar')
            .setScale(0.34, 0.39);
        this.progressMask = this.make.graphics();
        progressBar.setMask(this.progressMask.createGeometryMask());
        this.progressBar = progressBar;
        this.barDisplayWidth = progressBar.displayWidth;
        this.barDisplayHeight = progressBar.displayHeight;
        this.updateLoadingProgress(0);
        this.load.on('progress', value => this.updateLoadingProgress(value));

        queueAssetGroup(this, 'gameplay');
        const level = this.cache.json.get(`level_${this.levelId}`);
        queueAssetGroup(this, `theme${level?.playgroundTheme || '1'}`);

        for (let i = 1; i <= 4; i++) {
            if (!this.textures.exists(`note${i}`)) {
                this.load.image(`note${i}`, `assets/images/vfx/note${i}.png`);
            }
        }
        for (let i = 1; i <= 7; i++) {
            const key = `bubble_particle_${i}`;
            if (!this.textures.exists(key)) {
                this.load.image(key, `assets/images/vfx/booster_shuffle_effect_${i}.png`);
            }
        }
    }

    updateLoadingProgress(value) {
        this.progressMask.clear();
        this.progressMask.fillStyle(0xffffff);
        this.progressMask.fillRect(
            this.progressBar.x - this.barDisplayWidth / 2,
            this.progressBar.y - this.barDisplayHeight / 2,
            this.barDisplayWidth * value,
            this.barDisplayHeight
        );
    }

    create() {
        // Works for both a completed download queue and an entirely cached level.
        this.updateLoadingProgress(1);
        this.transitionToGame();
    }

    transitionToGame() {
        if (this.transitionStarted) return;
        this.transitionStarted = true;
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { levelId: this.levelId });
        });
        this.cameras.main.fadeOut(200, 0, 0, 0);
    }
}
