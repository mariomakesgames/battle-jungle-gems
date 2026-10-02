// src/scenes/BootScene.js
import Phaser from 'phaser';
import AudioManager from '../managers/AudioManager';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Tải những asset TỐI THIỂU cho màn hình loading
        // Ví dụ: ảnh nền của thanh loading và ảnh thanh loading sẽ được fill
        this.load.image('preloading_background', 'assets/images/map/preloading.png');
        this.load.image('loading_logo', 'assets/images/map/logo.png');
        this.load.image('loading_progress_bar', 'assets/images/map/loading_progress_bar.png');
        this.load.image('loading_progress_bar_background', 'assets/images/map/loading_progress_bar_background.png');
    }

    create() {
        // << [AUDIO] Khởi tạo AudioManager với game instance >>
        AudioManager.setGame(this.game);
        
        // --- THAY ĐỔI: Đợi Font tải xong mới vào màn Title ---
        this.waitForFont('UTMCookies').then(() => {
            this.scene.start('TitleScene');
        });
    }

    // Hàm tiện ích để đợi font (lấy từ PreloaderScene sang)
    waitForFont(fontName) {
        return new Promise((resolve) => {
            if (document && document.fonts && document.fonts.load) {
                document.fonts.load(`20px ${fontName}`).then(() => {
                    return document.fonts.ready;
                }).then(() => {
                    console.log(`[Boot] Font '${fontName}' ready.`);
                    resolve();
                }).catch(() => {
                    // Nếu lỗi thì cứ cho qua (dùng font mặc định)
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}