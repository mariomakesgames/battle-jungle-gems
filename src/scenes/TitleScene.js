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

        // 3. Nút "BẮT ĐẦU" (Text Button)
        // Vị trí: 75% chiều cao màn hình (dưới màn hình)
        const startText = this.add.text(gameWidth / 2, gameHeight * 0.75, 'BẮT ĐẦU', {
            fontFamily: 'UTMCookies', // Font game
            fontSize: '64px',         // Cỡ chữ
            color: '#FFFFFF',         // Màu trắng
            stroke: '#4a2c2a',        // Viền nâu
            strokeThickness: 8,       // Độ dày viền
            align: 'center',
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                stroke: true,
                fill: true
            },
            // --- KHẮC PHỤC LỖI MẤT DẤU ---
            padding: {
                top: 20,    // Thêm khoảng trống phía trên để chứa dấu mũ
                bottom: 10, // Thêm phía dưới cho cân đối
                left: 10,
                right: 10
            }
        }).setOrigin(0.5);
      bindText(startText, 'start', {}, 460);

        // Điều chỉnh scale chữ nếu màn hình quá nhỏ (Mobile)
        const maxTextWidth = gameWidth * 0.8;
        if (startText.width > maxTextWidth) {
             startText.setScale(maxTextWidth / startText.width);
        }

        // Làm cho chữ bấm được
        startText.setInteractive({ useHandCursor: true });

        // Hiệu ứng "Thở" cho nút Bắt đầu
        this.tweens.add({
            targets: startText,
            scaleX: startText.scaleX * 1.1,
            scaleY: startText.scaleY * 1.1,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Sự kiện click
        startText.on('pointerdown', () => {
            startText.setTint(0xaaaaaa); // Tối đi chút khi bấm
            // Thu nhỏ nhẹ bằng cách giảm scale hiện tại đi một chút
            startText.setScale(startText.scaleX * 0.9); 
        });

        startText.on('pointerup', () => {
            startText.clearTint();
            
            // Trigger Fullscreen (Logic giống main.js cũ nhưng đưa vào đây)
            if (!this.scale.isFullscreen && this.scale.fullscreen.available) {
                this.scale.startFullscreen();
            }

            // Chuyển sang màn hình PreloaderScene để tải assets thật
            this.scene.start('PreloaderScene');
        });

        const duelButton = this.add.rectangle(gameWidth / 2, 835, 300, 46, 0x174b50)
            .setStrokeStyle(2, 0xe8bd70).setInteractive({ useHandCursor: true }).setName('ai-duel-entry');
        bindText(this.add.text(gameWidth / 2, 835, '', { fontSize: '25px', color: '#fff5df' })
            .setOrigin(0.5), 'aiDuel', {}, 280);
        duelButton.on('pointerdown', () => this.scene.start('AIDuelScene'));
        const onlineButton = this.add.rectangle(gameWidth / 2, 675, 300, 46, 0x243e63)
            .setStrokeStyle(2, 0xe8bd70).setInteractive({ useHandCursor: true }).setName('online-duel-entry');
        bindText(this.add.text(gameWidth / 2, 675, '', { fontSize: '25px', color: '#fff5df' })
            .setOrigin(0.5), 'onlineDuel', {}, 280);
        onlineButton.on('pointerdown', () => this.scene.start('OnlineLobbyScene'));
        const photoButton = this.add.rectangle(gameWidth / 2, 613, 300, 46, 0x43304f)
            .setStrokeStyle(2, 0xe8bd70).setInteractive({ useHandCursor: true }).setName('beauty-entry');
        bindText(this.add.text(gameWidth / 2, 613, '', { fontSize: '25px', color: '#fff5df' })
            .setOrigin(0.5), 'beautyMode', {}, 280);
        photoButton.on('pointerdown', () => this.scene.start('PhotoAlbumScene'));
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
