import { fashionButton } from '../ui/FashionButton.js';
import Phaser from 'phaser';
import { bindText } from '../ui/LocalizedUI';
import { LevelNode } from '../ui/LevelNode';
import { CLASSIC_MAP_NODES, MAP_PART1_HEIGHT, MAP_PART2_HEIGHT, MAP_CHAPTER_HEIGHT } from '../ui/MapLayout';
import { PHOTO_LEVELS, photoCollection, canEnterPhotoLevel } from '../beauty/PhotoRules';
import { gameLettering, BADDIE, fashionBackground, queueBaddieTheme } from '../ui/BaddieTheme.js';

const NODE_ASSETS = ['baddie_node_lock', 'baddie_node_unlock'];

export class BaddieMapScene extends Phaser.Scene {
    constructor() { super('BaddieMapScene'); }

    init(data = {}) {
        this.fashionTheme = true;
        this.returnScene = data.returnScene || 'TitleScene';
        this.focusIndex = Phaser.Math.Clamp(Number.isInteger(data.focusIndex) ? data.focusIndex : photoCollection.completed, 0, PHOTO_LEVELS.length - 1);
        this.areas = [];
        this.nodes = [];
        this.dragStart = null;
        this.dragMoved = false;
        this.ready = false;
    }

    preload() {
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        this.label(288, 512, 'loading', { percent: 0 });
        queueBaddieTheme(this);
    }

    create() {
        this.sound.stopAll();
        this.children.removeAll(true);
        if ([...NODE_ASSETS, 'baddie_studio'].some(key => !this.textures.exists(key))) {
            this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
            this.label(288, 400, 'baddieMapError');
            this.button(288, 505, 250, 'restart', () => this.scene.restart({ returnScene: this.returnScene, focusIndex: this.focusIndex }), 'baddie-map-retry');
            this.button(288, 585, 250, 'duelBack', () => this.scene.start(this.returnScene), 'baddie-map-back');
            return;
        }
        fashionBackground(this).setScrollFactor(0);
        const chapters = Math.ceil(PHOTO_LEVELS.length / 9);
        this.totalHeight = chapters * MAP_CHAPTER_HEIGHT;
        for (let chapter = 0; chapter < chapters; chapter++) {
            const offset = (chapters - chapter - 1) * MAP_CHAPTER_HEIGHT;
            for (const [key, y, height] of [['map_part2', offset, MAP_PART2_HEIGHT], ['map_part1', offset + MAP_PART2_HEIGHT, MAP_PART1_HEIGHT]]) {
                const area = { key, y, height, image: null };
                this.paintArea(area);
                this.areas.push(area);
            }
            const path = new Phaser.Curves.Spline(CLASSIC_MAP_NODES.map(position => new Phaser.Math.Vector2(position.x, offset + position.y)));
            const line = this.add.graphics().lineStyle(3, BADDIE.gold, .4).setDepth(2);
            path.draw(line, 100);
            bindText(this.add.text(38, offset + 255, '', { fontSize: '19px', color: '#e0bcac' }).setDepth(3),
                'baddieChapter', { chapter: String(chapter + 1).padStart(2, '0') }, 180).setFontFamily(BADDIE.font);
            for (const position of CLASSIC_MAP_NODES) {
                const index = chapter * 9 + position.id - 1;
                if (index >= PHOTO_LEVELS.length) break;
                const node = new LevelNode(this, position.x, offset + position.y, index + 1,
                    !canEnterPhotoLevel(index), 0, () => {
                        if (!this.dragMoved) this.openLevel(index);
                    });
                node.setDepth(20).setName(`baddie-level-${index + 1}`);
                if (photoCollection.isCollected(index)) {
                    this.add.text(node.x + 35, node.y - 35, '✓', { fontSize: '27px', color: '#ffe286', stroke: '#37270c', strokeThickness: 3 }).setDepth(21);
                }
                this.nodes.push(node);
            }
        }
        // Trim unused space above the final level of the last chapter.
        const minY = Math.max(0, this.nodes.at(-1).y - 230);
        this.cameras.main.setBounds(0, minY, 576, this.totalHeight - minY);
        this.focusLevel(this.focusIndex);
        this.add.rectangle(288, 90, 576, 180, BADDIE.panel, 0.98).setStrokeStyle(1, BADDIE.gold, .5).setScrollFactor(0).setDepth(1000);
        this.label(288, 48, 'beautyMode', {}, 250, 30);
        this.button(68, 48, 110, 'duelBack', () => this.scene.start(this.returnScene), 'baddie-map-back');
        this.button(501, 48, 130, 'baddieGallery', () => this.openGallery(), 'baddie-gallery');
        this.label(288, 100, 'beautyCollectionCount', { count: photoCollection.completed, total: PHOTO_LEVELS.length });
        this.button(288, 145, 260, photoCollection.completed < PHOTO_LEVELS.length ? 'baddieContinue' : 'beautyAllCollected',
            () => photoCollection.completed < PHOTO_LEVELS.length ? this.openLevel(photoCollection.completed) : this.openGallery(),
            'baddie-continue', { level: photoCollection.completed + 1 });
        this.input.on('pointerdown', pointer => {
            this.dragMoved = false;
            this.dragStart = pointer.y > 180 ? { y: pointer.y, x: pointer.x, scroll: this.cameras.main.scrollY, id: pointer.id } : null;
        });
        this.input.on('pointermove', pointer => {
            if (!pointer.isDown || !this.dragStart || this.dragStart.id !== pointer.id) return;
            const dy = pointer.y - this.dragStart.y;
            if (Math.max(Math.abs(dy), Math.abs(pointer.x - this.dragStart.x)) > 10) this.dragMoved = true;
            this.scrollTo(this.dragStart.scroll - dy);
        });
        this.input.on('pointerup', () => { this.dragStart = null; });
        this.input.on('pointerupoutside', () => { this.dragStart = null; });
        this.input.on('wheel', (_pointer, _objects, _dx, dy) => this.scrollTo(this.cameras.main.scrollY + dy));
        this.ready = true;
    }

    paintArea(area) {
        area.image?.destroy();
        area.image = this.add.rectangle(288, area.y, 576, area.height, BADDIE.ink, 0).setOrigin(.5, 0);
        area.image.setDepth(0);
    }

    scrollTo(y) {
        const bounds = this.cameras.main.getBounds();
        this.cameras.main.setScroll(0, Phaser.Math.Clamp(y, bounds.y, bounds.bottom - 1024));
    }
    focusLevel(index) { this.scrollTo(this.nodes[index].y - 560); }
    openLevel(index) {
        if (!canEnterPhotoLevel(index)) return;
        this.scene.start('PhotoChallengeScene', { index, selectionScene: 'BaddieMapScene', returnScene: this.returnScene });
    }
    openGallery() {
        this.scene.start('PhotoAlbumScene', { returnScene: 'BaddieMapScene', mapReturnScene: this.returnScene, focusIndex: this.focusIndex });
    }
    label(x, y, key, params = {}, width = 530, size = 22) {
        return gameLettering(bindText(this.add.text(x, y, '', { fontSize: `${size}px`, color: '#fff5df' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(1001), key, params, width).setFontFamily(BADDIE.font));
    }
    button(x, y, width, key, action, name, params = {}) {
        const button = fashionButton(this, x, y, width, 52, width >= 250)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true }).setName(name);
        this.label(x, y, key, params, width - 12, 21);
        button.on('pointerdown', action);
        return button;
    }
}
