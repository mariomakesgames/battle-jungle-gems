import Phaser from 'phaser';
import { bindText } from '../ui/LocalizedUI';
import { PHOTO_LEVELS, photoCollection, photoKey, photoPath } from '../beauty/PhotoRules';

// Collection viewer only. All level selection belongs to BaddieMapScene.
export class PhotoAlbumScene extends Phaser.Scene {
    constructor() { super('PhotoAlbumScene'); }
    init(data = {}) {
        this.returnScene = data.returnScene || 'BaddieMapScene';
        this.mapReturnScene = data.mapReturnScene || 'TitleScene';
        const focus = Number.isInteger(data.focusIndex) ? data.focusIndex : photoCollection.completed - 1;
        this.index = Phaser.Math.Clamp(focus, 0, Math.max(0, photoCollection.completed - 1));
        this.ready = false;
    }
    preload() {
        if (photoCollection.completed && !this.textures.exists(photoKey(this.index))) {
            this.load.image(photoKey(this.index), photoPath(this.index));
        }
    }
    create() {
        this.sound.stopAll();
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        this.add.rectangle(288, 512, 576, 1024, 0x101c30, 0.94);
        this.label(288, 65, 'baddieGallery', 32, {}, 275);
        this.button(72, 65, 112, 'duelBack', () => this.leave(), 'beauty-album-back');
        if (!photoCollection.completed) {
            this.label(288, 440, 'baddieGalleryEmpty', 25);
            this.button(288, 560, 260, 'baddieLevels', () => this.leave(), 'beauty-gallery-levels');
            this.ready = true;
            return;
        }
        if (!this.textures.exists(photoKey(this.index))) {
            this.label(288, 440, 'beautyImageError', 25);
            this.button(288, 560, 260, 'restart', () => this.restart(this.index), 'beauty-gallery-retry');
            return;
        }
        this.label(288, 145, PHOTO_LEVELS[this.index].title, 25);
        this.add.image(288, 482, photoKey(this.index)).setDisplaySize(400, 500).setName('beauty-gallery-photo');
        this.label(288, 784, 'beautyPage', 23, { page: this.index + 1, total: photoCollection.completed });
        this.previousPage = this.button(132, 856, 190, 'beautyPreviousPage', () => this.browse(-1), 'beauty-page-previous');
        this.nextPage = this.button(444, 856, 190, 'beautyNextPage', () => this.browse(1), 'beauty-page-next');
        for (const [button, enabled] of [[this.previousPage, this.index > 0], [this.nextPage, this.index + 1 < photoCollection.completed]]) {
            if (!enabled) button.disableInteractive().setAlpha(0.35);
        }
        this.ready = true;
    }
    browse(delta) {
        const index = this.index + delta;
        if (photoCollection.isCollected(index)) this.restart(index);
    }
    restart(index) { this.scene.restart({ focusIndex: index, returnScene: this.returnScene, mapReturnScene: this.mapReturnScene }); }
    leave() { this.scene.start(this.returnScene, { returnScene: this.mapReturnScene, focusIndex: this.index }); }
    label(x, y, key, size, params = {}, width = 520) {
        return bindText(this.add.text(x, y, '', { fontSize: `${size}px`, color: '#fff5df', align: 'center' })
            .setOrigin(0.5), key, params, width);
    }
    button(x, y, width, key, action, name) {
        const button = this.add.rectangle(x, y, width, 44, 0x78522d).setStrokeStyle(2, 0xe8bd70)
            .setInteractive({ useHandCursor: true }).setName(name);
        this.label(x, y, key, 20, {}, width - 12);
        button.on('pointerdown', action);
        return button;
    }
}
