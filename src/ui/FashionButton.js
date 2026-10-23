import Phaser from 'phaser';
import { BADDIE } from './BaddieTheme.js';

// Shared rounded satin surface. Cached textures keep dozens of controls inexpensive.
export class FashionButton extends Phaser.GameObjects.Image {
    constructor(scene, x, y, width, height = 52, primary = false) {
        super(scene, x, y, '__WHITE');
        this.surfaceWidth = width;
        this.surfaceHeight = height;
        this.fillColor = primary ? BADDIE.rose : BADDIE.raised;
        this.strokeColor = BADDIE.gold;
        this.lineWidth = 1;
        scene.add.existing(this);
        this.paint();
        this.setInteractive({ useHandCursor: true });
        this.on('pointerover', () => this.setTint(0xffe3ee));
        this.on('pointerdown', () => this.setTint(0xd9adc3));
        this.on('pointerup', () => this.clearTint());
        this.on('pointerout', () => this.clearTint());
    }
    setFillStyle(color) { this.fillColor = color; return this.paint(); }
    setStrokeStyle(width, color) { this.lineWidth = width; this.strokeColor = color; return this.paint(); }
    paint() {
        const w = this.surfaceWidth, h = this.surfaceHeight;
        const key = `fashion-button-${w}-${h}-${this.fillColor}-${this.strokeColor}-${this.lineWidth}`;
        if (!this.scene.textures.exists(key)) {
            const texture = this.scene.textures.createCanvas(key, w * 2, h * 2);
            const ctx = texture.context;
            ctx.scale(2, 2);
            const hex = value => '#' + value.toString(16).padStart(6, '0');
            const primary = this.fillColor === BADDIE.rose;
            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, primary ? '#ea9dbb' : '#65506b');
            gradient.addColorStop(.48, hex(this.fillColor));
            gradient.addColorStop(1, primary ? '#91365e' : '#302238');
            ctx.beginPath();
            ctx.roundRect(1, 1, w - 2, h - 4, 12);
            ctx.fillStyle = gradient;
            ctx.shadowColor = '#09060c'; ctx.shadowBlur = 1; ctx.shadowOffsetY = 3;
            ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = this.lineWidth > 1 ? hex(this.strokeColor) : 'rgba(249,206,221,.5)';
            ctx.lineWidth = this.lineWidth; ctx.stroke();
            ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 8, Math.min(15, h / 3));
            ctx.strokeStyle = 'rgba(255,240,246,.18)'; ctx.lineWidth = 1; ctx.stroke();
            texture.refresh();
        }
        this.setTexture(key).setDisplaySize(w, h);
        return this;
    }
}

export function fashionButton(scene, x, y, width, height = 52, primary = false) {
    return new FashionButton(scene, x, y, width, height, primary);
}
