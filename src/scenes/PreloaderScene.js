import LanguageManager from '../i18n/LanguageManager';
// src/scenes/PreloaderScene.js
import Phaser from 'phaser';

export class PreloaderScene extends Phaser.Scene {
    constructor() {
        super('PreloaderScene');
        this.background = null;
        this.logo = null;
        this.progressBarBg = null;
        this.progressBar = null;
        this.barTextureWidth = 0;
        this.barTextureHeight = 0;
        this.percentText = null;
        this.realProgress = 0;
        this.displayProgress = 0;
        this.hasTriggeredNextScene = false;
    }

    preload() {
        console.log("--- BẮT ĐẦU PRELOAD ---");

        // Tạo giao diện loading
        this.createLoadingScreen();

        this.hasTriggeredNextScene = false;
        this.updateLoadingProgress(0);

        this.loadAssets();

        // Font tải ngầm (không ảnh hưởng logic progress bar)
        this.waitForFont('UTMCookies'); 
        this.waitForFont('NABILA');
    }

    create() {
        // Phaser calls create only after the real asset queue has completed.
        this.updateLoadingProgress(1);
        this.startNextScene();
    }

    updateLoadingProgress(value) {
        this.realProgress = value;
        this.displayProgress = value;
        if (this.progressBar && this.barTextureWidth > 0) {
            this.progressBar.setCrop(0, 0, this.barTextureWidth * value, this.barTextureHeight);
        }
        if (this.percentText) {
            this.percentText.setText(LanguageManager.t('loading', { percent: Math.floor(value * 100) }));
        }
    }

    createLoadingScreen() {
        console.log("Vẽ màn hình loading...");
        this.background = this.add.image(0, 0, 'preloading_background');
        this.resizeBackground(this.scale.width, this.scale.height);
        
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        // Logo ở giữa, lệch lên trên
        this.logo = this.add.image(gameWidth / 2, gameHeight / 2 - 310, 'loading_logo').setOrigin(0.5);
        // Scale logo để không vượt quá 60% bề rộng màn hình
        const maxLogoWidth = gameWidth * 0.4;
        if (this.logo.width > 0 && this.logo.width > maxLogoWidth) {
            const logoScale = 1;
            this.logo.setScale(logoScale);
        }

        // Hiệu ứng lướt lên xuống nhẹ nhàng cho logo
        this.tweens.add({
            targets: this.logo,
            y: '+=10',
            duration: 2000,
            delay: 500, 
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Progress bar background và bar ở dưới logo
        const progressY = gameHeight / 2 - 130;
        this.progressBarBg = this.add.image(gameWidth / 2, progressY, 'loading_progress_bar_background').setOrigin(0.5);
        this.progressBar = this.add.image(gameWidth / 2, progressY, 'loading_progress_bar').setOrigin(0.5);

        // Scale theo bề rộng màn hình (tối đa 70%)
        const maxBarWidth = gameWidth * 0.5;
        const baseBarWidth = this.progressBar.width;
        if (baseBarWidth > 0 && baseBarWidth > maxBarWidth) {
            const barScale = maxBarWidth / baseBarWidth;
            this.progressBarBg.setScale(barScale);
            this.progressBar.setScale(barScale);
        }

        // Dùng crop theo kích thước texture (tối ưu hiệu năng)
        this.barTextureWidth = this.progressBar.width;
        this.barTextureHeight = this.progressBar.height;
        this.progressBar.setCrop(0, 0, 0, this.barTextureHeight);

        this.load.on('progress', (value) => this.updateLoadingProgress(value));
    }
    
    loadAssets() {
        // Only the first visible map section and shared small icons are critical.
        // Decoration, ambient audio, other sections and panels load separately.
        const images = [
            ['setting_button', 'assets/images/ui/setting_button_scale.png'],
            ['pause_exit', 'assets/images/ui/pause/exit.png'],
            ['gem_red', 'assets/images/gameplay/gems/red.png'],
            ['gem_green', 'assets/images/gameplay/gems/green.png'],
            ['gem_blue', 'assets/images/gameplay/gems/blue.png'],
            ['gem_purple', 'assets/images/gameplay/gems/purple.png'],
            ['gem_yellow', 'assets/images/gameplay/gems/yellow.png'],
            ['gem_orange', 'assets/images/gameplay/gems/orange.png'],
            ['gem_bomb', 'assets/images/gameplay/gems/bomb.png'],
            ['gem_color_bomb', 'assets/images/gameplay/gems/color_bomb.png'],
            ['gem_color_bomb_op', 'assets/images/gameplay/gems/color_bomb_op.png'],
            ['gem_stripe', 'assets/images/gameplay/gems/stripe.png'],
            ['blocker_stone_1', 'assets/images/gameplay/blockers/blocker_stone_2.png'],
            ['blocker_stone_2', 'assets/images/gameplay/blockers/blocker_stone_1.png'],
            ['blocker_rope', 'assets/images/gameplay/blockers/blocker_rope.png'],
            ['booster_hammer', 'assets/images/ui/booster_hammer_15.png'],
            ['booster_swap', 'assets/images/ui/booster_swap_15.png'],
            ['booster_rocket', 'assets/images/ui/booster_rocket_15.png'],
            ['booster_shuffle', 'assets/images/ui/booster_shuffle_15.png'],
            ['quantity_background', 'assets/images/ui/level_review/quantity_background.png'],
            ['add_icon', 'assets/images/ui/level_review/add_icon.png'],
            ['loading_level_progressbar', 'assets/screen/progress-bar.png'],
            ['map_part1', 'assets/images/map/map.webp'],
            ['level_lock', 'assets/images/map/level_lock.png'],
            ['level_unlock', 'assets/images/map/level_unlock.png'],
            ['star_1', 'assets/images/map/star_1.png'],
            ['star_2', 'assets/images/map/star_2.png'],
            ['star_3', 'assets/images/map/star_3.png'],
            ['coin', 'assets/screen/coin.png'],
            ['heart', 'assets/screen/heart.png'],
            ['ticket', 'assets/images/ui/ticket.png'],
            ['spin', 'assets/images/ui/spin.png'],
            ['store', 'assets/images/ui/store.png'],
            ['friend_button', 'assets/images/ui/friends.png'],
        ];
        for (const [key, path] of images) {
            if (!this.textures.exists(key)) this.load.image(key, path);
        }
        // These small level descriptions are shared by review/objective screens.
        for (let level = 1; level <= 9; level++) {
            const key = `level_${level}`;
            if (!this.cache.json.exists(key)) this.load.json(key, `assets/levels/${key}.json`);
        }
    }

    // Chờ font web sẵn sàng. Nếu trình duyệt không hỗ trợ, bỏ qua để không chặn preload
    waitForFont(fontName) {
        try {
            if (document && document.fonts && document.fonts.load) {
                // Kích hoạt tải font và đợi ready
                const triggerLoad = document.fonts.load(`20px ${fontName}`);
                const ready = document.fonts.ready;
                return Promise.all([triggerLoad, ready]).then(() => {
                    console.log(`[Preloader] Font '${fontName}' đã sẵn sàng.`);
                }).catch((err) => {
                    console.warn(`[Preloader] Không thể xác nhận trạng thái font '${fontName}':`, err);
                });
            }
        } catch (e) {
            console.warn('[Preloader] document.fonts không khả dụng:', e);
        }
        return Promise.resolve();
    }


    handleContextRestored() {
        console.log("SỰ KIỆN: WebGL Context đã được khôi phục! Bắt đầu lại từ BootScene...");
        this.cleanUpListeners();
        this.scene.start('BootScene');
    }

    handleResize() {
        console.log("SỰ KIỆN: Cửa sổ đã thay đổi kích thước! Bắt đầu lại từ BootScene...");
        this.cleanUpListeners();
        this.scene.start('BootScene');
    }

    shutdown() {
        console.log("PreloaderScene shutdown.");
        this.cleanUpListeners();
    }
    
    cleanUpListeners() {
        this.scale.off('resize', this.handleResize, this);
        this.sys.game.renderer.off('contextrestored', this.handleContextRestored, this);
    }


    startNextScene() {
        if (this.hasTriggeredNextScene) return;
        this.hasTriggeredNextScene = true;
        console.log("PreloaderScene quyết định chuyển cảnh. Dọn dẹp listener ngay lập tức.");
        
        // --- ĐIỂM SỬA QUAN TRỌNG NHẤT ---
        // Dọn dẹp TẤT CẢ listener ngay tại thời điểm quyết định chuyển cảnh.
        // Đây là "điểm không thể quay đầu". Scene không nên lắng nghe bất cứ thứ gì nữa.
        this.cleanUpListeners();

        // Bây giờ mới bắt đầu hiệu ứng chuyển cảnh một cách an toàn
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            console.log("Fade out xong, chính thức bắt đầu MapScene.");
            // Chuyển scene ngay lập tức để VFX có thời gian khởi tạo
            this.scene.start('MapScene');
        });
    }

    resizeBackground(gameWidth, gameHeight) {
        if (!this.background) return;
        this.background.setPosition(gameWidth / 2, gameHeight / 2);
        const scale = Math.max(gameWidth / this.background.width, gameHeight / this.background.height);
        this.background.setScale(scale);
    }
}
