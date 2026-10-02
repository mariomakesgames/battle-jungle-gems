import { createLanguageSelector, localizedLabel, localizeButton } from '../../ui/LocalizedUI';
import Phaser from 'phaser';
import APIManager from '../../managers/APIManager';
import AudioManager from '../../managers/AudioManager';

export class SettingsPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsPopup' });
        this.levelId = 1; // Giá trị mặc định
        this.musicVolume = 0.5; // Giá trị tạm, sẽ được cập nhật trong create()
        this.soundVolume = 0.5; // Giá trị tạm, sẽ được cập nhật trong create()
    }

    // Nhận dữ liệu từ GameScene
    init(data) {
        this.levelId = data.levelId;
    }

    create() {
        const { width, height } = this.scale;
        createLanguageSelector(this, 935);
        localizedLabel(this, 288, 248, 'settings', 240, 52);
        localizedLabel(this, 275, 398, 'level', 60, 24);

        // << [AUDIO] Đọc volume từ AudioManager mỗi lần mở popup (đảm bảo lấy giá trị mới nhất) >>
        this.musicVolume = AudioManager.getMusicVolume();
        this.soundVolume = AudioManager.getSoundVolume();

        // 1. Tạm dừng các scene bên dưới (chỉ pause nếu đang chạy)
        if (this.scene.isActive('GameScene')) {
            this.scene.pause('GameScene');
        }
        if (this.scene.isActive('UIScene')) {
            this.scene.pause('UIScene');
        }
        // Nếu mở từ MapScene, pause MapScene
        if (this.scene.isActive('MapScene')) {
            this.scene.pause('MapScene');
        }

        // 2. Tạo một lớp nền mờ
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive()
            .setDepth(1);

        // 3. Tạo background UI
        const uiBackground = this.add.image(width / 2, height / 2, 'setting_ui')
            .setOrigin(0.5)
            .setDepth(2);

        // 4. Tạo nút đóng (X) ở góc trên bên phải
        const closeButton = this.add.image(470, 270, 'pause_exit')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(5);

        closeButton.on('pointerdown', () => {
            this.closePopup();
        });

        // 5. Lấy thông tin người chơi từ API và hiển thị
        this.loadUserInfo();

        // 6. Tạo thanh trượt âm nhạc
        this.createMusicSlider(width, height);

        // 7. Tạo thanh trượt âm thanh
        this.createSoundSlider(width, height);
        localizedLabel(this, 288, 465, 'music', 160, 28);
        localizedLabel(this, 288, 555, 'sound', 160, 28);

        // 8. Tạo các nút chức năng
        this.createActionButtons(width, height);

        // 9. Đảm bảo game resume khi popup tắt
        this.events.on('shutdown', this.onResumeGame, this);
    }

    createMusicSlider(width, height) {
        // Vị trí
        const sliderX = 288;
        const sliderY = 512;
        const startX = 140;
        const endX = 440;
        const sliderWidth = endX - startX;
        const maskY = sliderY - 30; // Vị trí Y và chiều cao của mask
        const maskHeight = 60;

        // 1. Tạo thanh bar DUY NHẤT
        // Đây là thanh bar sẽ bị che (mask)
        const sliderBar = this.add.image(sliderX, sliderY, 'pause_bar')
            .setOrigin(0.5)
            .setDepth(3);

        // 2. Tạo mask (một đối tượng Graphics)
        // Mask định nghĩa vùng "HIỂN THỊ"
        const musicMask = this.add.graphics();
        musicMask.fillStyle(0xffffff);
        
        // 3. Áp dụng mask cho thanh bar
        sliderBar.setMask(musicMask.createGeometryMask());

        // 4. Vẽ mask ban đầu (từ startX đến vị trí volume hiện tại)
        const initialFillWidth = (this.musicVolume * sliderWidth);
        musicMask.fillRect(startX, maskY, initialFillWidth, maskHeight);

        // 5. Tạo nút kéo thả
        const musicHandle = this.add.image(startX + initialFillWidth, sliderY, 'pause_music')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(4); // Phải nằm trên thanh bar

        // Lưu thông tin
        this.musicSlider = {
            bar: sliderBar,
            mask: musicMask,
            handle: musicHandle,
            startX: startX,
            endX: endX,
            currentValue: this.musicVolume
        };

        // Thêm sự kiện kéo thả
        this.input.setDraggable(musicHandle);
        musicHandle.on('drag', (pointer, dragX, dragY) => {
            const newX = Phaser.Math.Clamp(dragX, this.musicSlider.startX, this.musicSlider.endX);
            musicHandle.setX(newX);
            
            this.musicVolume = (newX - this.musicSlider.startX) / (this.musicSlider.endX - this.musicSlider.startX);
            this.musicSlider.currentValue = this.musicVolume;
            
            // 6. CẬP NHẬT MASK (vẽ lại phần HIỂN THỊ)
            const fillWidth = newX - this.musicSlider.startX;
            this.musicSlider.mask.clear();
            this.musicSlider.mask.fillStyle(0xffffff);
            this.musicSlider.mask.fillRect(startX, maskY, fillWidth, maskHeight);
            
            // << [AUDIO] Áp dụng volume cho nhạc nền >>
            AudioManager.setMusicVolume(this.musicVolume);
            console.log('Music Volume:', this.musicVolume);
        });
    }

    createSoundSlider(width, height) {
        // Vị trí
        const sliderX = 288;
        const sliderY = 592;
        const startX = 140;
        const endX = 440;
        const sliderWidth = endX - startX;
        const maskY = sliderY - 30;
        const maskHeight = 60;

        // 1. Tạo thanh bar DUY NHẤT
        const sliderBar = this.add.image(sliderX, sliderY, 'pause_bar')
            .setOrigin(0.5)
            .setDepth(3);

        // 2. Tạo mask
        const soundMask = this.add.graphics();
        soundMask.fillStyle(0xffffff);

        // 3. Áp dụng mask
        sliderBar.setMask(soundMask.createGeometryMask());

        // 4. Vẽ mask ban đầu
        const initialFillWidth = (this.soundVolume * sliderWidth);
        soundMask.fillRect(startX, maskY, initialFillWidth, maskHeight);

        // 5. Tạo nút kéo thả
        const soundHandle = this.add.image(startX + initialFillWidth, sliderY, 'pause_sound')
            .setOrigin(0.5)

            .setInteractive({ useHandCursor: true })
            .setDepth(4);

        // Lưu thông tin
        this.soundSlider = {
            bar: sliderBar,
            mask: soundMask,
            handle: soundHandle,
            startX: startX,
            endX: endX,
            currentValue: this.soundVolume
        };

        // Thêm sự kiện kéo thả
        this.input.setDraggable(soundHandle);
        soundHandle.on('drag', (pointer, dragX, dragY) => {
            const newX = Phaser.Math.Clamp(dragX, this.soundSlider.startX, this.soundSlider.endX);
            soundHandle.setX(newX);
            
            this.soundVolume = (newX - this.soundSlider.startX) / (this.soundSlider.endX - this.soundSlider.startX);
            this.soundSlider.currentValue = this.soundVolume;
            
            // 6. CẬP NHẬT MASK (vẽ lại phần HIỂN THỊ)
            const fillWidth = newX - this.soundSlider.startX;
            this.soundSlider.mask.clear();
            this.soundSlider.mask.fillStyle(0xffffff);
            this.soundSlider.mask.fillRect(startX, maskY, fillWidth, maskHeight);
            
            // << [AUDIO] Áp dụng volume cho sound effects >>
            AudioManager.setSoundVolume(this.soundVolume);
            console.log('Sound Volume:', this.soundVolume);
        });
    }

    createActionButtons(width, height) {
        // 4 nút chức năng ở vị trí nút continue cũ (662)
        const buttonY = 662;
        const buttonSpacing = 80; // Khoảng cách giữa các nút
        const startX = 288 - (buttonSpacing * 1.5); // Căn giữa 4 nút

        // Nút Notice
        const noticeButton = this.add.image(startX, buttonY, 'notice')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        noticeButton.on('pointerdown', () => {
            console.log('Notice clicked');
        });

        // Nút Email
        const emailButton = this.add.image(startX + buttonSpacing, buttonY, 'email')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        emailButton.on('pointerdown', () => {
            console.log('Email clicked');
        });

        // Nút Information
        const infoButton = this.add.image(startX + buttonSpacing * 2, buttonY, 'information')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        infoButton.on('pointerdown', () => {
            console.log('Information clicked');
        });

        // Nút Share
        const shareButton = this.add.image(startX + buttonSpacing * 3, buttonY, 'share')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        shareButton.on('pointerdown', () => {
            console.log('Share clicked');
        });

        // Nút Facebook Connect ở vị trí cũ
        const facebookButton = this.add.image(288, 745, 'facebook')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        localizeButton(this, facebookButton, 'connect');

        facebookButton.on('pointerdown', () => {
            // Xử lý kết nối Facebook
            console.log('Facebook Connect clicked');
            // TODO: Thêm logic kết nối Facebook
        });
    }

    closePopup() {
        this.events.off('shutdown', this.onResumeGame, this);
        this.onResumeGame();
        this.scene.stop();
    }

    onResumeGame() {
        if (this.scene.isPaused('GameScene')) {
            this.scene.resume('GameScene');
        }
        if (this.scene.isPaused('UIScene')) {
            this.scene.resume('UIScene');
        }
        if (this.scene.isPaused('MapScene')) {
            this.scene.resume('MapScene');
        }
    }

    /**
     * Gọi API để lấy thông tin người chơi và hiển thị
     */
    async loadUserInfo() {
        try {
            const userInfo = await APIManager.getUserInfo();
            const { userId, username, level } = userInfo;

            // Dòng ID đầu tiên
            this.add.text(284, 800, `${userId}`, {
                fontFamily: 'UTMCookies',
                fontSize: '15px',
                color: '#b43827',
                align: 'center'
            }).setOrigin(0.5).setDepth(5);

            // Dòng ID lặp lại
            this.add.text(325, 429, `${userId}`, {
                fontFamily: 'UTMCookies',
                fontSize: '15px',
                color: '#b43827',
                align: 'left'
            }).setOrigin(0.5).setDepth(5);

            // Dòng Level
            this.add.text(318, 402, `${level}`, {
                fontFamily: 'UTMCookies',
                fontSize: '15px',
                color: '#b43827',
                align: 'left'
            }).setOrigin(0.5).setDepth(5);

            // Dòng tên (màu trắng)
            this.add.text(294, 375, 'BAPLUOC', {
                fontFamily: 'UTMCookies',
                fontSize: '15px',
                color: '#ffffff',
                align: 'left'
            }).setOrigin(0.5).setDepth(5);
        } catch (error) {
            console.error('Lỗi khi lấy thông tin người chơi từ API:', error);
            // Hiển thị giá trị mặc định nếu API lỗi
            this.add.text(294, 798, 'N/A', {
                fontFamily: 'UTMCookies',
                fontSize: '15px',
                color: '#b43827',
                align: 'left'
            }).setOrigin(0.5).setDepth(5);
        }
    }
}

