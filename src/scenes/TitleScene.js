import { bindText, createLanguageSelector } from '../ui/LocalizedUI';
// src/scenes/TitleScene.js
import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
        this.background = null;
    }

    create() {
        createLanguageSelector(this, 920);
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        // 1. Background (Sử dụng logic resize giống PreloaderScene)
        this.background = this.add.image(0, 0, 'preloading_background');
        this.resizeBackground(gameWidth, gameHeight);

        // 2. Logo (Vị trí và hiệu ứng GIỐNG HỆT PreloaderScene)
        // Logo ở giữa, lệch lên trên
        const logo = this.add.image(gameWidth / 2, gameHeight / 2 - 310, 'loading_logo').setOrigin(0.5);
        // Scale logo để không vượt quá 40% bề rộng màn hình (giống PreloaderScene)
        const maxLogoWidth = gameWidth * 0.4;
        if (logo.width > 0 && logo.width > maxLogoWidth) {
            const logoScale = 1;
            logo.setScale(logoScale);
        }

        // Hiệu ứng lướt lên xuống nhẹ nhàng cho logo (GIỐNG PreloaderScene)
        this.tweens.add({
            targets: logo,
            y: '+=10',
            duration: 2000,
            delay: 500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        const modeButton = (y, color, key, name, action) => {
            const button = this.add.rectangle(gameWidth / 2, y, 300, 46, color)
                .setStrokeStyle(2, 0xe8bd70).setInteractive({ useHandCursor: true }).setName(name);
            bindText(this.add.text(gameWidth / 2, y, '', { fontSize: '25px', color: '#fff5df' })
                .setOrigin(0.5).setName(`${name}-label`), key, {}, 280);
            button.on('pointerdown', action);
        };
        modeButton(768, 0x713719, 'classicMode', 'classic-mode-entry', () => {
            if (!this.scale.isFullscreen && this.scale.fullscreen.available) this.scale.startFullscreen();
            this.scene.start('PreloaderScene');
        });
        modeButton(835, 0x174b50, 'aiDuel', 'ai-duel-entry', () => this.scene.start('AIDuelScene'));
        modeButton(675, 0x243e63, 'onlineDuel', 'online-duel-entry', () => this.scene.start('OnlineLobbyScene'));
        modeButton(613, 0x43304f, 'beautyMode', 'beauty-entry', () => this.scene.start('BaddieMapScene'));
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));

        // Lắng nghe sự kiện resize để vẽ lại background nếu xoay màn hình
        this.scale.on('resize', this.handleResize, this);
    }

    // Hàm xử lý khi resize cửa sổ (Đồng bộ với logic của Preloader)
    handleResize(gameSize) {
        this.resizeBackground(gameSize.width, gameSize.height);
        
        // Cập nhật lại vị trí các phần tử nếu cần thiết (ở đây ví dụ background là quan trọng nhất)
        // Các phần tử khác như Logo/Text đang dùng tỉ lệ tương đối trong create(), 
        // nếu muốn responsive hoàn hảo khi xoay ngang/dọc thì nên tách logic vẽ UI ra hàm riêng và gọi lại ở đây.
    }

    // Hàm scale background full màn hình (copy logic từ PreloaderScene)
    resizeBackground(gameWidth, gameHeight) {
        if (!this.background) return;
        this.background.setPosition(gameWidth / 2, gameHeight / 2);
        // Chọn tỉ lệ scale lớn hơn giữa chiều rộng và chiều cao để phủ kín (cover)
        const scale = Math.max(gameWidth / this.background.width, gameHeight / this.background.height);
        this.background.setScale(scale);
    }
}
