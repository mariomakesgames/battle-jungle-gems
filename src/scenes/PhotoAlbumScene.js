import Phaser from 'phaser';
import { bindText } from '../ui/LocalizedUI';
import { PHOTO_LEVELS, photoCollection } from '../beauty/PhotoRules';
import LanguageManager from '../i18n/LanguageManager';
import { photoGoalsText } from '../ui/PhotoGoals';

const PAGE_SIZE = 3;
const PAGE_COUNT = Math.ceil(PHOTO_LEVELS.length / PAGE_SIZE);

export class PhotoAlbumScene extends Phaser.Scene {
    constructor() { super('PhotoAlbumScene'); }
    init(data = {}) {
        this.returnScene = data.returnScene || 'TitleScene';
        const focus = Number.isInteger(data.focusIndex) ? data.focusIndex : photoCollection.completed;
        this.page = Math.max(0, Math.min(PAGE_COUNT - 1, Math.floor(focus / PAGE_SIZE)));
        this.pageItems = [];
    }

    create() {
        this.sound.stopAll();
        this.add.image(288, 512, 'preloading_background').setDisplaySize(576, 1024);
        this.add.rectangle(288, 512, 576, 1024, 0x101c30, 0.92);
        this.label(288, 78, 'beautyMode', 36);
        this.label(288, 150, 'beautyIntro', 21);
        this.button(72, 78, 108, 'duelBack', () => this.scene.start(this.returnScene), 'beauty-album-back');

        this.previousPage = this.button(111, 845, 156, 'beautyPreviousPage', () => this.changePage(-1), 'beauty-page-previous');
        this.nextPage = this.button(465, 845, 156, 'beautyNextPage', () => this.changePage(1), 'beauty-page-next');
        this.pageLabel = this.label(288, 845, 'beautyPage', 23, () => ({ page: this.page + 1, total: PAGE_COUNT }), 140);
        this.label(288, 909, 'beautyCollectionCount', 23, { count: photoCollection.completed, total: PHOTO_LEVELS.length });
        this.label(288, 952, 'beautySaveHint', 18);
        this.renderPage();
    }

    changePage(delta) {
        const page = this.page + delta;
        if (page < 0 || page >= PAGE_COUNT) return;
        this.page = page;
        this.renderPage();
    }

    renderPage() {
        this.pageItems.forEach(item => item.destroy());
        const start = this.children.list.length;
        const first = this.page * PAGE_SIZE;
        PHOTO_LEVELS.slice(first, first + PAGE_SIZE).forEach((level, slot) => {
            const index = first + slot;
            const y = 326 + slot * 192;
            const collected = photoCollection.isCollected(index);
            const available = photoCollection.canPlay(index);
            this.add.rectangle(288, y, 520, 164, available ? 0x233550 : 0x162236)
                .setStrokeStyle(2, available ? 0xe8bd70 : 0x3d4c63);
            this.add.circle(85, y - 35, 29, collected ? 0x785b2b : 0x3b526d);
            this.add.text(85, y - 35, String(index + 1).padStart(2, '0'), { fontSize: '25px', color: '#fff2ab' }).setOrigin(0.5);
            this.label(282, y - 42, level.title, 27, {}, 310);
            this.label(282, y - 2, level.classicLevel ? 'beautyClassicLevelGoal' : 'beautyLevelGoal', 19,
                () => ({ score: level.target, moves: level.moves, goals: photoGoalsText(level.objectives || []) }), 430);
            this.label(142, y + 48, collected ? 'beautyCollected' : available ? 'beautyReady' : 'beautyLocked', 19,
                { level: index }, 195);
            if (available) {
                this.button(411, y + 48, 214, collected ? 'beautyView' : 'beautyChallenge', () => {
                    this.scene.start('PhotoChallengeScene', { index, viewing: collected, returnScene: this.returnScene });
                }, `beauty-photo-${index}`);
            }
        });
        this.pageItems = this.children.list.slice(start);
        this.pageLabel.setText(LanguageManager.t('beautyPage', { page: this.page + 1, total: PAGE_COUNT }));
        for (const [button, enabled] of [[this.previousPage, this.page > 0], [this.nextPage, this.page < PAGE_COUNT - 1]]) {
            button.setAlpha(enabled ? 1 : 0.35);
            if (enabled) button.setInteractive({ useHandCursor: true });
            else button.disableInteractive();
        }
    }

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
