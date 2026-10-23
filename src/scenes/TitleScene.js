import { fashionButton } from '../ui/FashionButton.js';
import Phaser from 'phaser';
import { bindText, createLanguageSelector } from '../ui/LocalizedUI';
import { isDebugMode } from '../utils/DebugMode';
import { photoKey, photoPath } from '../beauty/PhotoRules.js';
import { gameLettering, BADDIE, fashionBackground } from '../ui/BaddieTheme.js';

export class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    preload() {
        for (const index of [11, 28]) {
            if (!this.textures.exists(photoKey(index))) this.load.image(photoKey(index), photoPath(index));
        }
    }

    create() {
        this.fashionTheme = true;
        fashionBackground(this, .06);
        this.add.image(64, 65, 'baddie_brand').setDisplaySize(40, 40);
        this.add.text(96, 65, 'B A D D I E   C L U B', { fontFamily: BADDIE.body, fontSize: '18px', color: '#e1c4b2' }).setOrigin(0, .5);
        this.add.text(43, 115, 'Baddie', { fontFamily: BADDIE.heading, fontSize: '82px', color: '#ffe5c1', stroke: '#4a253b', strokeThickness: 5, shadow: { offsetX: 0, offsetY: 5, color: '#08050e', blur: 6, fill: true } });
        this.label(49, 230, 'baddieTagline', 18, 470).setOrigin(0, .5);

        const left = this.add.container(139, 458).setAngle(-5);
        left.add(this.add.rectangle(0, 0, 196, 259, BADDIE.panel).setStrokeStyle(2, BADDIE.gold));
        left.add(this.add.image(0, -8, photoKey(28)).setDisplaySize(182, 228));
        left.add(this.add.text(0, 119, 'THE COLLECTION', { fontFamily: BADDIE.body, fontSize: '11px', color: '#dcb98c', letterSpacing: 2 }).setOrigin(.5));
        const main = this.add.container(354, 433).setAngle(3);
        main.add(this.add.rectangle(0, 0, 282, 370, BADDIE.panel).setStrokeStyle(2, BADDIE.gold));
        main.add(this.add.image(0, -9, photoKey(11)).setDisplaySize(266, 332));
        main.add(this.add.text(0, 170, 'BADDIE  /  01', { fontFamily: BADDIE.body, fontSize: '12px', color: '#dcb98c', letterSpacing: 3 }).setOrigin(.5));
        this.tweens.add({ targets: main, y: 443, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });


        this.label(288, 662, 'baddiePlayline', 17, 340);

        const button = fashionButton(this, 288, 738, 470, 72, true).setName('beauty-entry');
        this.label(273, 738, 'beautyMode', 28, 370).setName('beauty-entry-label');
        this.add.text(493, 738, '›', { fontFamily: BADDIE.heading, fontSize: '40px', color: '#fff3e3' }).setOrigin(.5);
        button.on('pointerdown', () => this.scene.start('BaddieMapScene'));
        this.label(288, 806, 'baddieCollectionHint', 17, 470);
        createLanguageSelector(this, 905);
        if (isDebugMode()) this.label(288, 992, 'debugMode', 12, 540).setColor(BADDIE.muted).setName('debug-mode-label');
    }

    label(x, y, key, size, width) {
        return gameLettering(bindText(this.add.text(x, y, '', { fontSize: `${size}px`, color: BADDIE.text, align: 'center' })
            .setOrigin(.5), key, {}, width).setFontFamily(BADDIE.font));
    }
}
