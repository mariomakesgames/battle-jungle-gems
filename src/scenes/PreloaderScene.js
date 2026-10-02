import LanguageManager from '../i18n/LanguageManager';
// src/scenes/PreloaderScene.js
import Phaser from 'phaser';
import { SOUND_PATHS } from '../utils/SoundAssets';

const MIN_LOAD_TIME = 2000; // Giảm thời gian chờ một chút

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
        this.startTime = 0;

        // Data tải xong chưa?
        this.isDataLoaded = false;
        // Timer đã bắt đầu đếm chưa?
        this.timerStarted = false;
        // Thời điểm bắt đầu chạy 25% cuối
        this.phase2StartTime = 0;
        // Biến để đảm bảo chỉ gọi chuyển scene 1 lần
        this.hasTriggeredNextScene = false;
    }

    preload() {
        console.log("--- BẮT ĐẦU PRELOAD ---");

        // Tạo giao diện loading
        this.createLoadingScreen();

        // Bắt sự kiện load xong toàn bộ tài nguyên
        this.load.on('complete', () => {
            console.log(">>> SỰ KIỆN: Data đã tải xong!");
            this.isDataLoaded = true;
        });

        this.loadAssets();

        // Font tải ngầm (không ảnh hưởng logic progress bar)
        this.waitForFont('UTMCookies'); 
        this.waitForFont('NABILA');
    }

    create() {
        console.log("--- CREATE ĐƯỢC GỌI (Sau khi preload xong) ---");
        this.sys.game.renderer.on('contextrestored', this.handleContextRestored, this);
        this.scale.on('resize', this.handleResize, this);
    }
   
    update() {
        if (this.hasTriggeredNextScene) return;

        // Chỉ bắt đầu tính giờ khi update thực sự chạy frame đầu tiên
        if (!this.timerStarted) {
            this.startTime = this.time.now;
            this.timerStarted = true;
        }

        const currentTime = this.time.now;
        const elapsedTime = currentTime - this.startTime;
        
        let targetPercent = 0;

        // --- PHASE 1: Chạy từ 0% -> 75% trong 2 giây (2000ms) ---
        if (elapsedTime <= 2000) {
            const ratio = elapsedTime / 2000;
            targetPercent = ratio * 0.75;
        } 
        // --- WAIT PHASE: Giữ ở 75% ---
        // Chạy khi: (Chưa đủ 3s tổng cộng) HOẶC (Data chưa tải xong)
        else if (elapsedTime <= 3000 || !this.isDataLoaded) {
            targetPercent = 0.75;
        }
        // --- PHASE 2: Chạy từ 75% -> 100% trong 1 giây ---
        // Chạy khi: (Đã qua 3s) VÀ (Data đã tải xong)
        else {
            if (this.phase2StartTime === 0) {
                this.phase2StartTime = currentTime;
                console.log(">>> Bắt đầu Phase 2 (25% cuối)");
            }

            const p2Elapsed = currentTime - this.phase2StartTime;
            const p2Ratio = Math.min(1.0, p2Elapsed / 1000);
            
            targetPercent = 0.75 + (p2Ratio * 0.25);
        }

        // --- Cập nhật hiển thị ---
        this.displayProgress = targetPercent;

        if (this.progressBar && this.barTextureWidth > 0) {
            const cropWidth = this.displayProgress * this.barTextureWidth;
            this.progressBar.setCrop(0, 0, cropWidth, this.barTextureHeight);
        }

        if (this.percentText) {
            this.percentText.setText(LanguageManager.t('loading', { percent: Math.floor(this.displayProgress * 100) }));
        }

        // --- Chuyển cảnh ---
        if (this.displayProgress >= 1 && !this.hasTriggeredNextScene) {
            console.log("--- HOÀN TẤT LOADING ---");
            this.hasTriggeredNextScene = true;
            this.startNextScene();
        }
    }

    createLoadingScreen() {
        console.log("Vẽ màn hình loading...");
        this.background = this.add.image(0, 0, 'loading_background');
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

        this.load.on('progress', (value) => {
            this.realProgress = value;
        });
    }
    
    loadAssets() {
        // Bỏ giới hạn maxParallelDownloads để tăng tốc tải (mặc định Phaser là 32)
        // this.load.maxParallelDownloads = 4
        console.log("Bắt đầu ra lệnh tải assets...");
        this.load.image(`level_background`, 'assets/screen/level.png');
        this.load.image(`map1_background`, 'assets/images/map/map1-background.png');
        this.load.image(`playground1_border`, 'assets/images/map/playground-border.png');
        this.load.image(`playground1_background`, 'assets/images/map/playground.png');
        
        // Tải asset cho theme board của level 5
        this.load.image(`playground2_border`, 'assets/images/map/playground2_border.png');
        this.load.image(`playground2_background`, 'assets/images/map/playground2_background.png');
        
        this.load.image(`cell`, 'assets/images/map/cell.png');
        
        // Nút cài đặt
        this.load.image('setting_button', 'assets/images/ui/setting_button_scale.png');
        
        // Load Pause UI assets
        this.load.image('pause_ui', 'assets/images/ui/pause/UI.png');
        this.load.image('pause_continue', 'assets/images/ui/pause/countinue.png');
        this.load.image('pause_quit', 'assets/images/ui/pause/quit.png');
        this.load.image('pause_restart', 'assets/images/ui/pause/Restart.png');
        this.load.image('pause_exit', 'assets/images/ui/pause/exit.png');
        this.load.image('pause_bar', 'assets/images/ui/pause/Bar.png');
        this.load.image('pause_music', 'assets/images/ui/pause/music.png');
        this.load.image('pause_sound', 'assets/images/ui/pause/sound.png');
        
        // Load Setting UI assets
        this.load.image('setting_ui', 'assets/images/ui/setting/Bang UI Setting.png');
        this.load.image('facebook', 'assets/images/ui/setting/facebook.png');
        this.load.image('share', 'assets/images/ui/setting/share.png');
        this.load.image('information', 'assets/images/ui/setting/information.png');
        this.load.image('email', 'assets/images/ui/setting/email.png');
        this.load.image('notice', 'assets/images/ui/setting/notice.png');
        
        // Load Level Review UI assets
        this.load.image('level_review_ui', 'assets/images/ui/level_review/UI1.png');
        
        // Load Play button
        this.load.image('play_button', 'assets/images/ui/level_review/play.png');
        
        // Load gem images for objectives
        this.load.image(`gem_red`, 'assets/images/gameplay/gems/red.png');
        this.load.image(`gem_green`, 'assets/images/gameplay/gems/green.png');
        this.load.image(`gem_blue`, 'assets/images/gameplay/gems/blue.png');
        this.load.image(`gem_purple`, 'assets/images/gameplay/gems/purple.png');
        this.load.image(`gem_yellow`, 'assets/images/gameplay/gems/yellow.png');
        this.load.image(`gem_orange`, 'assets/images/gameplay/gems/orange.png');
        
        // Load power-up images for objectives
        this.load.image(`gem_bomb`, 'assets/images/gameplay/gems/bomb.png');
        this.load.image(`gem_color_bomb`, 'assets/images/gameplay/gems/color_bomb.png');
        this.load.image(`gem_color_bomb_op`, 'assets/images/gameplay/gems/color_bomb_op.png');
        this.load.image(`gem_stripe`, 'assets/images/gameplay/gems/stripe.png');
        
        // Load blocker images for objectives
        this.load.image(`blocker_stone_1`, 'assets/images/gameplay/blockers/blocker_stone_2.png');
        this.load.image(`blocker_stone_2`, 'assets/images/gameplay/blockers/blocker_stone_1.png');
        this.load.image(`blocker_rope`, 'assets/images/gameplay/blockers/blocker_rope.png');
        
        // Load booster icons for Level Review
        // this.load.image('booster_hammer', 'assets/images/ui/booster_hammer.png');
        // this.load.image('booster_swap', 'assets/images/ui/booster_swap.png');
        // this.load.image('booster_rocket', 'assets/images/ui/booster_rocket.png');
        // this.load.image('booster_shuffle', 'assets/images/ui/booster_shuffle.png');
        this.load.image('booster_hammer', 'assets/images/ui/booster_hammer_15.png');
        this.load.image('booster_swap', 'assets/images/ui/booster_swap_15.png');
        this.load.image('booster_rocket', 'assets/images/ui/booster_rocket_15.png');
        this.load.image('booster_shuffle', 'assets/images/ui/booster_shuffle_15.png');
        this.load.image('booster_background', 'assets/images/ui/level_review/booster_background.png');
        this.load.image('quantity_background', 'assets/images/ui/level_review/quantity_background.png');
        this.load.image('add_icon', 'assets/images/ui/level_review/add_icon.png');
        this.load.image('booster_rocket_2', 'assets/images/ui/shop/rocket_2.png');

        // Load UI Progress Bar assets
        this.load.image('progress_bar_background', 'assets/images/ui/progress_bar_background.png');
        this.load.image('progress_bar_fill', 'assets/images/ui/progress_bar_fill.png');
        this.load.image('star_off', 'assets/images/ui/star_off.png');
        this.load.image('star_on', 'assets/images/ui/star_on.png');
        this.load.image('star_off_pgb', 'assets/images/ui/star_off_pgb.png');
        this.load.image('star_on_pgb', 'assets/images/ui/star_on_pgb.png');
        // Victory UI background
        this.load.image('victory_background', 'assets/images/ui/victory/background1.png');
        this.load.image('lose_background', 'assets/images/ui/lose/background1.png');
        
        // Load loading background images
        this.load.image('loading_background_1', 'assets/screen/loading_1.png');
        this.load.image('loading_background_2', 'assets/screen/loading_2.png');
        this.load.image('loading_background_3', 'assets/screen/loading_3.png');
        this.load.image('loading_background_4', 'assets/screen/loading_4.png');
        this.load.image('loading_background_5', 'assets/screen/loading_5.png');
        this.load.image('loading_background_6', 'assets/screen/loading_6.png');
        
        // Load progress bar image for level loading
        this.load.image('loading_level_progressbar', 'assets/screen/progress-bar.png');

        // Load assets cho màn hình bản đồ mới
        this.load.image('map_part1', 'assets/images/map/map.png');
        // this.load.image('map_part1', 'assets/images/map/map_part_1.png');
        this.load.image('map_part2', 'assets/images/map/map_part_2.png');
        
        // --- THÊM ASSETS MỚI CHO MAPSCENE ---
        this.load.image('level_lock', 'assets/images/map/level_lock.png');
        this.load.image('level_unlock', 'assets/images/map/level_unlock.png');
        this.load.image('star_1', 'assets/images/map/star_1.png');
        this.load.image('star_2', 'assets/images/map/star_2.png');
        this.load.image('star_3', 'assets/images/map/star_3.png');
        
        // Load UI assets cho ResourceDisplay
        this.load.image('coin', 'assets/screen/coin.png');
        this.load.image('heart', 'assets/screen/heart.png');
        this.load.image('ticket', 'assets/images/ui/ticket.png');
        this.load.image('spin', 'assets/images/ui/spin.png');
        this.load.image('store', 'assets/images/ui/store.png');
        // VFX - steam
        this.load.image('vfx_steam_1_1_bot_nuoc', 'assets/images/map/vfx/steam/1.1. Bot nuoc.png');
        this.load.image('vfx_steam_1_2_bot_nuoc', 'assets/images/map/vfx/steam/1.2. Bot nuoc.png');
        this.load.image('vfx_steam_1_3_bot_nuoc', 'assets/images/map/vfx/steam/1.3. Bot nuoc.png');
        this.load.image('vfx_steam_1_4_bot_nuoc', 'assets/images/map/vfx/steam/1.4.  Bot nuoc.png');
        // --- NEW: Banana tree variants and wooden stumps for Steam area ---
        // Bạn đã cung cấp 3 ảnh: cay_chuoi1, cay_chuoi2, coc_go
        // Đặt key ngắn gọn để dùng trong MapVFXManager
        this.load.image('steam_cay_chuoi1', 'assets/images/map/vfx/steam/cay_chuoi1.png');
        this.load.image('steam_cay_chuoi2', 'assets/images/map/vfx/steam/cay_chuoi2.png');
        this.load.image('steam_coc_go', 'assets/images/map/vfx/steam/coc_go.png');
        this.load.image('vfx_steam_10_mat_nuoc_loang_1', 'assets/images/map/vfx/steam/10. Mat nuoc loang 1.png');
        this.load.image('vfx_steam_11_mat_nuoc_loang_1', 'assets/images/map/vfx/steam/11. Mat nuoc loang 1.png');
        this.load.image('vfx_steam_13_mat_nuoc_loang_3', 'assets/images/map/vfx/steam/13. Mat nuoc loang 3.png');
        this.load.image('vfx_steam_15_nuoc_chay_chan_thac', 'assets/images/map/vfx/steam/15. Nuoc chay chan thac.png');
        this.load.image('vfx_steam_16_nuoc_chay_chan_thac', 'assets/images/map/vfx/steam/16. nuoc chay chan thac.png');
        this.load.image('vfx_steam_17_nuoc_loang_chan_thac', 'assets/images/map/vfx/steam/17. Nuoc loang chan thac.png');
        this.load.image('vfx_steam_3_nuoc_dau_ngon_thac', 'assets/images/map/vfx/steam/3. Nuoc dau ngon thac.png');
        this.load.image('vfx_steam_4_nuoc_dau_ngon_thac', 'assets/images/map/vfx/steam/4. Nuoc dau ngon thac.png');
        this.load.image('vfx_steam_5_giot_nuoc_ngon_thac', 'assets/images/map/vfx/steam/5. Giot nuoc ngon thac.png');
        this.load.image('vfx_steam_6_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/6. Nuoc chay giua ngon thac.png');
        this.load.image('vfx_steam_7_nuoc_chay_giua_angon_thac', 'assets/images/map/vfx/steam/7. Nuoc chay giua angon thac.png');
        this.load.image('vfx_steam_8_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/8. Nuoc chay giua ngon thac.png');
        this.load.image('vfx_steam_9_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/9. Nuoc chay giua ngon thac.png');
        this.load.image('vfx_steam_mat_nuoc_loang_2', 'assets/images/map/vfx/steam/Mat nuoc loang 2.png');
        this.load.image('vfx_steam_mat_nuoc_loang_4', 'assets/images/map/vfx/steam/Mat nuoc loang 4.png');
        this.load.image('vfx_steam_thac_nuoc', 'assets/images/map/vfx/steam/Thac nuoc.png');

        // VFX - decanter
        this.load.image('vfx_decanter_dong_nuoc_chinh', 'assets/images/map/vfx/decanter/Dong nuoc chinh.png');
        this.load.image('vfx_decanter_giot_nuoc_1', 'assets/images/map/vfx/decanter/Giot nuoc 1.png');
        this.load.image('vfx_decanter_giot_nuoc_2', 'assets/images/map/vfx/decanter/Giot nuoc 2.png');
        this.load.image('vfx_decanter_giot_nuoc_3', 'assets/images/map/vfx/decanter/Giot nuoc 3.png');
        this.load.image('vfx_decanter_giot_nuoc_4', 'assets/images/map/vfx/decanter/Giot nuoc 4.png');
        this.load.image('vfx_decanter_nuoc_chay_1', 'assets/images/map/vfx/decanter/Nuoc chay 1.png');
        this.load.image('vfx_decanter_nuoc_chay_2', 'assets/images/map/vfx/decanter/Nuoc chay 2.png');
        this.load.image('vfx_decanter_nuoc_chay_3', 'assets/images/map/vfx/decanter/Nuoc chay 3.png');
        this.load.image('vfx_decanter_nuoc_chay_4', 'assets/images/map/vfx/decanter/Nuoc chay 4.png');

        // VFX - bambo
        this.load.image('vfx_bambo_cay_tre', 'assets/images/map/vfx/bambo/Cay tre.png');
        this.load.image('vfx_bambo_mat_sau_quai_trong_dong', 'assets/images/map/vfx/bambo/Mat sau quai trong dong.png');
        this.load.image('vfx_bambo_quai_trong_dong_1', 'assets/images/map/vfx/bambo/Quai trong dong 1.png');
        this.load.image('vfx_bambo_quai_trong_dong_2', 'assets/images/map/vfx/bambo/Quai trong dong 2.png');

        // VFX - banana
        this.load.image('vfx_banana_buong_chuoi', 'assets/images/map/vfx/banana/Buong chuoi.png');
        this.load.image('vfx_banana_cay_chuoi', 'assets/images/map/vfx/banana/Cay chuoi.png');

        // VFX - map_part2 (cây cối)
        this.load.image('map_part2_cay_chuoi', 'assets/images/map/vfx/map_part2/Cay chuoi.png');
        this.load.image('map_part2_chum_bap', 'assets/images/map/vfx/map_part2/Chum bap.png');
        this.load.image('map_part2_la_cay', 'assets/images/map/vfx/map_part2/La cay.png');

        // VFX - map_part2 fish (cá nhảy + splash)
        this.load.image('map_part2_fish_1_1', 'assets/images/map/vfx/map_part2/fish/1.1.png');
        this.load.image('map_part2_fish_1_2', 'assets/images/map/vfx/map_part2/fish/1.2.png');
        this.load.image('map_part2_fish_2_1', 'assets/images/map/vfx/map_part2/fish/2.1.png');
        this.load.image('map_part2_fish_2_2', 'assets/images/map/vfx/map_part2/fish/2.2.png');
        this.load.image('map_part2_fish_3_1', 'assets/images/map/vfx/map_part2/fish/3.1.png');
        this.load.image('map_part2_fish_3_2', 'assets/images/map/vfx/map_part2/fish/3.2.png');
        this.load.image('map_part2_fish_4_1', 'assets/images/map/vfx/map_part2/fish/4.1.png');
        this.load.image('map_part2_fish_4_2', 'assets/images/map/vfx/map_part2/fish/4.2.png');
        this.load.image('map_part2_fish_4_3', 'assets/images/map/vfx/map_part2/fish/4.3.png');
        this.load.image('map_part2_fish_4_4', 'assets/images/map/vfx/map_part2/fish/4.4.png');

        // VFX - map_part2 steam (thác nước chảy)
        this.load.image('map_part2_steam_base', 'assets/images/map/vfx/map_part2/steam/base.png');
        this.load.image('map_part2_steam_0', 'assets/images/map/vfx/map_part2/steam/0. Bot nuoc.png');
        this.load.image('map_part2_steam_1', 'assets/images/map/vfx/map_part2/steam/1. Nuoc ban len.png');
        this.load.image('map_part2_steam_2', 'assets/images/map/vfx/map_part2/steam/2. Nuoc chay 1.png');
        this.load.image('map_part2_steam_3', 'assets/images/map/vfx/map_part2/steam/3. Nuoc chay 2.png');
        this.load.image('map_part2_steam_4', 'assets/images/map/vfx/map_part2/steam/4. Nuoc chay 3.png');
        this.load.image('map_part2_steam_5', 'assets/images/map/vfx/map_part2/steam/5. Nuoc chay 4.png');

        //Spin popup
        this.load.image('spin_background', 'assets/images/ui/spin/background.png');
        this.load.image('spin_button', 'assets/images/ui/spin/button.png');
        this.load.image('spin_pointer', 'assets/images/ui/spin/pointer.png');
        this.load.image('spin_board', 'assets/images/ui/spin/board.png');
        this.load.image('spin_center', 'assets/images/ui/spin/center.png');
        this.load.image('spin_led', 'assets/images/ui/spin/led.png');
        this.load.image('heart_2', 'assets/images/ui/shop/heart_2.png');
        this.load.image('coin_x2', 'assets/images/ui/shop/coin_x2.png');
        this.load.image('shuffle_2', 'assets/images/ui/shop/shuffle_2.png');
        this.load.image('rocket_2', 'assets/images/ui/shop/rocket_2.png');
        this.load.image('hammer_2', 'assets/images/ui/shop/hammer_2.png');
        this.load.image('swap_2', 'assets/images/ui/shop/swap_2.png');
        // Shop
        this.load.image('shop_background', 'assets/images/ui/shop/background.png');
        this.load.image('shop_price_background', 'assets/images/ui/shop/price_background.png');
        this.load.image('shop_discount_40', 'assets/images/ui/shop/discount_40.png');
        this.load.image('next_button', 'assets/images/ui/shop/next.png');
        this.load.image('previous_button', 'assets/images/ui/shop/previous.png');

        // --- FRIEND UI ASSETS ---
        this.load.image('friend_button', 'assets/images/ui/friends.png');
        this.load.image('friend_ui_bg', 'assets/images/ui/friend/UI.png');
        this.load.image('friend_item_bg', 'assets/images/ui/friend/item_background.png');
        this.load.image('friend_cover', 'assets/images/ui/friend/cover.png'); // Ảnh che phần dưới
        // Decor friend (đè lên cover)
        this.load.image('friend_decor', 'assets/images/ui/friend/friend_decor.png');
        this.load.image('friend_msg_icon', 'assets/images/ui/friend/message_icon.png');
        this.load.image('friend_select_all_text', 'assets/images/ui/friend/select_all.png'); // Chữ Select All
        this.load.image('friend_send_button', 'assets/images/ui/friend/send_all.png');
        this.load.image('friend_tick', 'assets/images/ui/friend/tick.png');

        // Avatars
        this.load.image('avt1', 'assets/images/ui/friend/avt1.png');
        this.load.image('avt2', 'assets/images/ui/friend/avt2.png');
        this.load.image('avt3', 'assets/images/ui/friend/avt3.png');
        this.load.image('avt4', 'assets/images/ui/friend/avt4.png');

        // << [AUDIO] Load âm thanh cho Map VFX >>
        this.load.audio('background', 'assets/sounds/maps/background.ogg');
        this.load.audio('stream', 'assets/sounds/maps/stream.mp3');
        this.load.audio('monkey', 'assets/sounds/maps/monkey.mp3');
        this.load.audio('water-drop', 'assets/sounds/maps/water-drop.m4a');

        // Load level data
        this.load.json('level_1', 'assets/levels/level_1.json');
        this.load.json('level_2', 'assets/levels/level_2.json');
        this.load.json('level_3', 'assets/levels/level_3.json');
        this.load.json('level_4', 'assets/levels/level_4.json');
        this.load.json('level_5', 'assets/levels/level_5.json');
        this.load.json('level_6', 'assets/levels/level_6.json');
        this.load.json('level_7', 'assets/levels/level_7.json');
        this.load.json('level_8', 'assets/levels/level_8.json');
        this.load.json('level_9', 'assets/levels/level_9.json');

        // << [AUDIO] Load Sound Effects từ file config >>
        console.log('Loading Sound Effects...');
        SOUND_PATHS.forEach(sound => {
            this.load.audio(sound.key, sound.path);
        });
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