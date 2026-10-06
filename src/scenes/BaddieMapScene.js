import Phaser from 'phaser';
import { bindText } from '../ui/LocalizedUI';
import { LevelNode } from '../ui/LevelNode';
import { CLASSIC_MAP_NODES, MAP_PART1_HEIGHT, MAP_PART2_HEIGHT, MAP_CHAPTER_HEIGHT } from '../ui/MapLayout';
import { PHOTO_LEVELS, photoCollection } from '../beauty/PhotoRules';
import { queueAssetGroup } from '../utils/AssetGroups';
import { startAssetStream } from './AssetStreamScene';

const NODE_ASSETS = ['level_lock', 'level_unlock'];

export class BaddieMapScene extends Phaser.Scene {
    constructor() { super('BaddieMapScene'); }

    init(data = {}) {
        this.returnScene = data.returnScene || 'TitleScene';
        this.focusIndex = Phaser.Math.Clamp(Number.isInteger(data.focusIndex) ? data.focusIndex : photoCollection.completed, 0, PHOTO_LEVELS.length - 1);
        this.initialMap = CLASSIC_MAP_NODES[this.focusIndex % 9].mapKey;
        this.areas = [];
        this.nodes = [];
        this.stream = null;
        this.dragStart = null;
        this.dragMoved = false;
        this.ready = false;
        this.failedMaps = new Set();
    }

    preload() {
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        this.label(288, 512, 'loading', { percent: 0 });
        for (const key of NODE_ASSETS) if (!this.textures.exists(key)) this.load.image(key, `assets/images/map/${key}.png`);
        queueAssetGroup(this, this.initialMap === 'map_part1' ? 'mapArea1' : 'mapArea2');
    }

    create() {
        this.sound.stopAll();
        this.children.removeAll(true);
        this.events.once('shutdown', () => { this.stream?.cancel(); this.stream = null; });
        if ([...NODE_ASSETS, this.initialMap].some(key => !this.textures.exists(key))) {
            this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
            this.label(288, 400, 'baddieMapError');
            this.button(288, 505, 250, 'restart', () => this.scene.restart({ returnScene: this.returnScene, focusIndex: this.focusIndex }), 'baddie-map-retry');
            this.button(288, 585, 250, 'duelBack', () => this.scene.start(this.returnScene), 'baddie-map-back');
            return;
        }
        const chapters = Math.ceil(PHOTO_LEVELS.length / 9);
        this.totalHeight = chapters * MAP_CHAPTER_HEIGHT;
        for (let chapter = 0; chapter < chapters; chapter++) {
            const offset = (chapters - chapter - 1) * MAP_CHAPTER_HEIGHT;
            for (const [key, y, height] of [['map_part2', offset, MAP_PART2_HEIGHT], ['map_part1', offset + MAP_PART2_HEIGHT, MAP_PART1_HEIGHT]]) {
                const area = { key, y, height, image: null };
                this.paintArea(area);
                this.areas.push(area);
            }
            for (const position of CLASSIC_MAP_NODES) {
                const index = chapter * 9 + position.id - 1;
                if (index >= PHOTO_LEVELS.length) break;
                const node = new LevelNode(this, position.x, offset + position.y, index + 1,
                    !photoCollection.canPlay(index), 0, () => {
                        if (!this.dragMoved) this.openLevel(index);
                    });
                node.setDepth(20).setName(`baddie-level-${index + 1}`);
                if (photoCollection.isCollected(index)) {
                    this.add.text(node.x + 35, node.y - 35, '✓', { fontSize: '27px', color: '#ffe286', stroke: '#37270c', strokeThickness: 3 }).setDepth(21);
                }
                this.nodes.push(node);
            }
        }
        // Trim the unused upper part of the last chapter while keeping level 30 visible.
        const minY = Math.max(0, this.nodes.at(-1).y - 230);
        this.cameras.main.setBounds(0, minY, 576, this.totalHeight - minY);
        this.focusLevel(this.focusIndex);
        this.add.rectangle(288, 90, 576, 180, 0x223322, 0.94).setScrollFactor(0).setDepth(1000);
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
        area.image = this.textures.exists(area.key)
            ? this.add.image(288, area.y, area.key).setOrigin(0.5, 0).setDisplaySize(576, area.height)
            : this.add.rectangle(288, area.y, 576, area.height, 0x315031).setOrigin(0.5, 0);
        area.image.setDepth(0);
    }

    update() {
        if (!this.ready || this.stream) return;
        const top = this.cameras.main.scrollY, bottom = top + 1024;
        const area = this.areas.find(area => area.y < bottom && area.y + area.height > top && !this.textures.exists(area.key) && !this.failedMaps.has(area.key));
        if (!area) return;
        this.stream = startAssetStream(this, { groups: [area.key === 'map_part1' ? 'mapArea1' : 'mapArea2'], onComplete: () => {
            this.stream = null;
            if (this.textures.exists(area.key)) this.areas.filter(other => other.key === area.key).forEach(other => this.paintArea(other));
            else {
                this.failedMaps.add(area.key);
                const retry = bindText(this.add.text(288, area.y + area.height / 2, '', { fontSize: '22px', color: '#fff5df' })
                    .setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true }), 'baddieMapError', {}, 530);
                retry.on('pointerdown', () => { this.failedMaps.delete(area.key); retry.destroy(); });
            }
        } });
    }

    scrollTo(y) {
        const bounds = this.cameras.main.getBounds();
        this.cameras.main.setScroll(0, Phaser.Math.Clamp(y, bounds.y, bounds.bottom - 1024));
    }
    focusLevel(index) { this.scrollTo(this.nodes[index].y - 560); }
    openLevel(index) {
        if (!photoCollection.canPlay(index)) return;
        this.scene.start('PhotoChallengeScene', { index, selectionScene: 'BaddieMapScene', returnScene: this.returnScene });
    }
    openGallery() {
        this.scene.start('PhotoAlbumScene', { returnScene: 'BaddieMapScene', mapReturnScene: this.returnScene, focusIndex: this.focusIndex });
    }
    label(x, y, key, params = {}, width = 530, size = 22) {
        return bindText(this.add.text(x, y, '', { fontSize: `${size}px`, color: '#fff5df' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(1001), key, params, width);
    }
    button(x, y, width, key, action, name, params = {}) {
        const button = this.add.rectangle(x, y, width, 44, 0x713719).setStrokeStyle(2, 0xe8bd70)
            .setScrollFactor(0).setDepth(1001).setInteractive({ useHandCursor: true }).setName(name);
        this.label(x, y, key, params, width - 12, 21);
        button.on('pointerdown', action);
        return button;
    }
}
