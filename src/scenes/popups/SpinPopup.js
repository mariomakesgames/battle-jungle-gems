import { preloadPopupAssets } from '../../ui/PopupLoading';
import { localizeButton } from '../../ui/LocalizedUI';
// src/scenes/popups/SpinPopup.js
import Phaser from 'phaser';
import APIManager from '../../managers/APIManager';
import PlayerDataManager from '../../managers/PlayerDataManager';
import AudioManager from '../../managers/AudioManager';
import { SOUND_KEYS } from '../../utils/SoundAssets';

export class SpinPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'SpinPopup' });
        this.baseRotation = 22.5; // Độ xoay gốc
        this.pointerTargetAngle = 95; // Góc mục tiêu của con trỏ (độ)
        this.boardContainer = null; // Container chứa board và items
        this.items = []; // Mảng chứa các item
        this.isSpinning = false; // Cờ chặn spin khi đang quay
        this.pointer = null; // tham chiếu con trỏ
        this.spinButton = null; // tham chiếu nút spin
    }

    init(data) {
        // this.baseRotation = data?.baseRotation ?? 0;
    }

    preload() {
        preloadPopupAssets(this, 'spin', ['MapScene']);
    }

    create() {
        const { width, height } = this.scale;

        // 1. Tạm dừng MapScene (nếu có)
        if (this.scene.isActive('MapScene')) {
            this.scene.pause('MapScene');
        }

        // 2. Tạo một lớp nền mờ
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive()
            .setDepth(1);

        // 3. Tạo background UI
        const uiBackground = this.add.image(width / 2, height / 2, 'spin_background')
            .setOrigin(0.5)
            .setScale(0.4)
            .setDepth(2);

        // 3.1. Tạo container chứa board và items (để xoay cùng nhau)
        const boardX = width / 2;
        const boardY = 558;
        this.boardContainer = this.add.container(boardX, boardY);

        // 3.2. Tạo board và thêm vào container
        const board = this.add.image(0, 0, 'spin_board')
            .setOrigin(0.5)
            .setScale(0.4);
        this.boardContainer.add(board);

        // 3.3. Tạo 8 items xung quanh board (bao gồm booster và item đặc biệt)
        // - Booster: dùng icon booster mặc định khi x1, và _2 khi x2
        // - Đặc biệt: coin_x2, heart_2 (luôn x2, texture riêng)
        const wheelItems = [
            { kind: 'booster', baseKey: 'booster_hammer', texture: 'hammer_2', quantity: 2 },
            { kind: 'booster', baseKey: 'booster_shuffle', texture: 'shuffle_2', quantity: 2 },
            { kind: 'special', rewardType: 'coin', texture: 'coin_x2', quantity: 1 },
            { kind: 'booster', baseKey: 'booster_rocket', texture: 'rocket_2', quantity: 2 },
            { kind: 'special', rewardType: 'heart', texture: 'heart_2', quantity: 2 },
            { kind: 'booster', baseKey: 'booster_shuffle', texture: 'shuffle_2', quantity: 2 },
            { kind: 'booster', baseKey: 'booster_rocket', texture: 'rocket_2', quantity: 2 },
            { kind: 'booster', baseKey: 'booster_swap', texture: 'swap_2', quantity: 2 }
        ];

        const itemCount = 8;
        const radius = 170; // Bán kính vòng tròn (tính theo scale 0.4)
        const angleStep = (360 / itemCount) * (Math.PI / 180); // Góc giữa mỗi item (radian)

        // Chuyển độ lệch gốc sang Radian
        const baseOffsetRadians = this.baseRotation * (Math.PI / 180);

        for (let i = 0; i < itemCount; i++) {
            // Thêm độ lệch vào góc
            const angle = (i * angleStep) + baseOffsetRadians;
            const itemX = Math.cos(angle) * radius;
            const itemY = Math.sin(angle) * radius;

            // Tạo container cho mỗi item
            const itemContainer = this.add.container(itemX, itemY);

            // Xoay container của item để nó hướng ra ngoài tâm
            // (angle là góc vị trí, + Math.PI / 2 là +90 độ để hướng "lên" của item trùng với hướng ra tâm)
            itemContainer.setRotation(angle + (Math.PI / 2));

            // Lấy trực tiếp dữ liệu từ mảng wheelItems, không random
            const def = wheelItems[i];
            const quantity = def.quantity;
            const textureKey = def.texture;
            let rewardType;
            let baseKey = null;
            if (def.kind === 'special') {
                rewardType = def.rewardType; // 'coin' | 'heart'
            } else {
                baseKey = def.baseKey;
                rewardType = baseKey;
            }

            const boosterIcon = this.add.image(0, 0, textureKey)
                .setOrigin(0.5)
            if (baseKey === 'booster_swap') {
                boosterIcon.y += 5;
            }
            itemContainer.add(boosterIcon);

            // Lưu dữ liệu phần thưởng trên item
            const reward = { type: rewardType, quantity, index: i, texture: textureKey };
            itemContainer.setData('reward', reward);

            this.boardContainer.add(itemContainer);
            this.items.push(itemContainer);
        }

        this.boardContainer.setDepth(3);

        // 3.4. Tạo các layer khác (led, center) - không xoay theo board
        const led = this.add.image(boardX, boardY, 'spin_led')
            .setOrigin(0.5)
            .setScale(0.4)
            .setDepth(5);

        // Hiệu ứng nhấp nháy cho dải LED (luôn chạy, kể cả khi đang spin)
        this.tweens.add({
            targets: led,
            alpha: { from: 0.55, to: 1 },
            duration: 800,
            hold: 200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        const center = this.add.image(boardX, boardY, 'spin_center')
            .setOrigin(0.5)
            .setScale(0.4)
            .setDepth(4);

        // 4. Tạo nút đóng (X) - dùng lại pause_exit
        const closeButton = this.add.image(470, 270, 'pause_exit')
            .setOrigin(0.5)

            .setInteractive({ useHandCursor: true })
            .setDepth(5);

        closeButton.on('pointerdown', () => {
            this.closePopup();
        });

        // 5. Tạo pointer (con trỏ chỉ vị trí trên bánh xe)
        this.pointer = this.add.image(width / 2, 290, 'spin_pointer')
            .setOrigin(0.5,0.1)
            .setScale(0.4)
            .setDepth(4.5);

        // 6. Tạo nút quay (spin button)
        this.spinButton = this.add.image(width / 2, 900, 'spin_button')
            .setOrigin(0.5)
            .setScale(0.4)
            .setInteractive({ useHandCursor: true })
            .setDepth(4.5);
        localizeButton(this, this.spinButton, 'spin');

        this.spinButton.on('pointerdown', () => {
            if (this.isSpinning) return;
            this.startSpin();
        });
        
        // 6.1 & 6.2: Tạo UI Ticket (Text và Icon)
        // Khởi tạo Text (Vị trí tạm thời, sẽ được updateTicketUI chỉnh lại ngay sau đó)
        this.ticketCountText = this.add.text(0, 0, '', {
            fontFamily: 'NABILA',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold'
        }).setDepth(5);
        
        // Khởi tạo Icon
        this.ticketIcon = this.add.image(0, 0, 'ticket')
            .setDepth(5);

        // Gọi hàm update lần đầu để căn chỉnh vị trí ngay khi mở popup
        this.updateTicketUI();

        // Hiệu ứng hover cho spin button (chỉ khi enabled)
        this.spinButton.on('pointerover', () => {
            if (!this.isSpinning && this.spinButton.input && this.spinButton.input.enabled) {
                this.tweens.add({ targets: this.spinButton, scale: 0.42, duration: 100 });
            }
        });

        this.spinButton.on('pointerout', () => {
            if (!this.isSpinning && this.spinButton.input && this.spinButton.input.enabled) {
                this.tweens.add({ targets: this.spinButton, scale: 0.4, duration: 100 });
            }
        });
        
        // Kiểm tra và cập nhật trạng thái nút spin ban đầu
        this.updateSpinButtonState();

        // 7. Đảm bảo MapScene resume khi popup tắt
        this.events.on('shutdown', this.onResumeMap, this);
    }

    closePopup() {
        this.events.off('shutdown', this.onResumeMap, this);
        this.onResumeMap();
        this.scene.stop();
    }

    onResumeMap() {
        if (this.scene.isPaused('MapScene')) {
            this.scene.resume('MapScene');
        }
    }

    /**
     * Xoay board và tất cả items theo độ xoay mới
     * @param {number} rotation - Độ xoay (độ)
     */
    rotateBoard(rotation) {
        if (this.boardContainer) {
            this.boardContainer.setRotation(rotation * (Math.PI / 180));
        }
    }

    /**
     * Lấy độ xoay hiện tại của board
     * @returns {number} Độ xoay (độ)
     */
    getBoardRotation() {
        if (this.boardContainer) {
            return this.boardContainer.rotation * (180 / Math.PI);
        }
        return 0;
    }

    /**
     * Cập nhật trạng thái nút spin (enable/disable) dựa trên số vé
     */
    updateSpinButtonState() {
        const hasEnoughTickets = PlayerDataManager.getTickets() >= 1;
        
        if (hasEnoughTickets) {
            this.spinButton.setInteractive({ useHandCursor: true });
            this.spinButton.setAlpha(1);
        } else {
            this.spinButton.disableInteractive();
            this.spinButton.setAlpha(0.5);
        }
    }
    
    /**
     * Cập nhật ResourceDisplay trong MapScene
     */
    updateResourceDisplay() {
        const mapScene = this.scene.get('MapScene');
        if (mapScene && mapScene.resourceDisplay) {
            mapScene.resourceDisplay.updateDisplay();
        }
    }
    
    /**
     * Cập nhật UI ticket (icon và text) và tự động căn giữa màn hình
     */
    updateTicketUI() {
        const ticketCount = PlayerDataManager.getTickets();
        const spacing = 5; // Khoảng cách giữa Icon và Text

        // 1. Cập nhật nội dung text trước để Phaser tính lại width mới
        this.ticketCountText.setText(`x${ticketCount}`);

        // 2. Lấy độ rộng thực tế hiện tại
        const iconWidth = this.ticketIcon.displayWidth;
        const textWidth = this.ticketCountText.width;
        
        // 3. Tính tổng độ rộng của cả cụm (Icon + Spacing + Text)
        const totalWidth = iconWidth + spacing + textWidth;

        // 4. Tính vị trí bắt đầu (X) để cả cụm nằm giữa màn hình
        // (Center màn hình) - (Nửa tổng độ rộng)
        const startX = (this.scale.width / 2) - (totalWidth / 2);
        const startY = 975; // Y cố định

        // 5. Đặt lại vị trí
        // Set Origin về (0, 0.5) để căn lề trái cho dễ xếp hàng ngang
        this.ticketIcon.setOrigin(0, 0.5);
        this.ticketCountText.setOrigin(0, 0.5);

        // Đặt Icon ở vị trí bắt đầu
        this.ticketIcon.setPosition(startX, startY);
        
        // Đặt Text ngay sau Icon + spacing
        this.ticketCountText.setPosition(startX + iconWidth + spacing, startY);
    }
    
    /**
     * Bắt đầu quá trình quay và xác định người thắng
     */
    async startSpin() {
        // Kiểm tra xem người chơi có đủ ticket không
        if (PlayerDataManager.getTickets() < 1) {
            console.log('Không đủ ticket để quay!');
            return;
        }
        
        this.isSpinning = true;
        this.spinButton.disableInteractive();
        this.spinButton.setAlpha(0.7);

        // << [AUDIO] Phát âm thanh quay - kiểm tra volume từ Setting >>
        const sfxVolume = AudioManager.getSoundVolume();
        if (sfxVolume > 0) {
            // Âm thanh "tút tút" (effect cũ) - tạm tắt
            // this.sound.play(SOUND_KEYS.SPIN_WHEEL, { volume: sfxVolume });
            // Âm thanh nhạc nền khi quay (sẽ dừng khi quay xong)
            this.spinBgSound = this.sound.add(SOUND_KEYS.SPIN_BACKGROUND_EFFECT, { volume: sfxVolume });
            this.spinBgSound.play();
        }

        // Hiệu ứng lắc lư cho con trỏ trong khi quay
        const pointerTween = this.tweens.add({
            targets: this.pointer,
            angle: { from: -5, to: 5 },
            duration: 100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: 40
        });

        let winningIndex = 0;
        try {
            console.log("Đang chờ kết quả spin từ backend...");
            const response = await APIManager.spinWheel();

            if (response && response.success) {
                const prizeId = response.prizeId;
                console.log(`Backend trả về giải: ${prizeId}`);

                const foundIndex = this.items.findIndex(item => {
                    const reward = item.getData('reward');
                    return reward && reward.type === prizeId;
                });

                if (foundIndex !== -1) {
                    winningIndex = foundIndex;
                } else {
                    console.warn(`Không tìm thấy item cho ID: ${prizeId}. Mặc định trúng ô 0.`);
                    winningIndex = 0;
                }
            } else {
                console.error('Lỗi khi spin từ BE, mặc định trúng ô 0.');
                winningIndex = 0;
            }
        } catch (error) {
            console.error('Lỗi nghiêm trọng khi gọi API spin:', error);
            winningIndex = 0;
        }

        // Tính toán góc quay cần đạt (độ)
        const angleStepDegrees = 360 / this.items.length;
        const winningItemInitialAngle = (winningIndex * angleStepDegrees) + this.baseRotation;
        const targetPointerAngle = this.pointerTargetAngle;
        const rotationOffset = 180; // Bánh xe đang bị ngược, cần xoay thêm 180 độ
        
        // 1. Lấy góc hiện tại của board (ví dụ: 0, 1690, 3335...)
        const currentBoardAngle = this.getBoardRotation();
        
        // 2. Tính "góc hiệu dụng" (0-360) của board hiện tại
        // Phép toán (+ 360) % 360 để đảm bảo kết quả luôn dương
        const currentEffectiveAngle = (currentBoardAngle % 360 + 360) % 360;
        
        // 3. Tính "góc hiệu dụng" (0-360) mà chúng ta muốn dừng lại
        // Đây là góc mà item trúng thưởng (winningItemInitialAngle)
        // nằm ngay dưới con trỏ (targetPointerAngle)
        const targetWheelAngle = targetPointerAngle - winningItemInitialAngle - rotationOffset;
        const targetEffectiveAngle = (targetWheelAngle % 360 + 360) % 360;
        
        // 4. Tính toán "khoảng chênh lệch" cần quay thêm (chính là phần "trừ hao" bạn nói)
        // Chúng ta cần quay từ currentEffectiveAngle -> targetEffectiveAngle
        const spinDifference = (targetEffectiveAngle - currentEffectiveAngle + 360) % 360;
        
        // 5. Tính tổng số độ sẽ quay trong *lần này*
        // Gồm 10 vòng quay đầy đủ + phần chênh lệch để "trừ hao"
        // (Tăng lên 10 vòng để ban đầu quay nhanh hơn, tạo cảm giác "tít thò lò")
        const totalSpinThisTurn = (360 * 10) + spinDifference;
        
        // 6. Tính góc "đích" cuối cùng mà boardContainer sẽ đạt tới
        // Bằng góc hiện tại + tổng số độ quay lần này
        const finalTargetAngle = currentBoardAngle + totalSpinThisTurn;

        // Trừ 1 ticket ngay khi bắt đầu quay
        PlayerDataManager.updateTickets(-1);
        this.updateResourceDisplay();
        
        // Cập nhật hiển thị số ticket trong popup (Dùng hàm mới để tự căn giữa)
        this.updateTicketUI();
        
        // Cập nhật trạng thái nút spin sau khi trừ vé
        this.updateSpinButtonState();
        
        this.tweens.add({
            targets: this.boardContainer,
            // Sử dụng góc đích cuối cùng đã được tính toán chính xác
            angle: finalTargetAngle,
            duration: 8000, // Kéo dài 8s để đoạn "chậm dần" lết về đích nhìn hồi hộp hơn
            ease: 'Quart.easeOut', // Giảm tốc gắt hơn Cubic, tạo cảm giác bánh xe nặng và có ma sát
            onComplete: async () => {
                pointerTween.stop();
                this.pointer.setAngle(0);
                this.isSpinning = false;
                
                // Dừng âm thanh nhạc nền quay
                if (this.spinBgSound && this.spinBgSound.isPlaying) {
                    this.spinBgSound.stop();
                }
                
                // Cập nhật trạng thái nút spin (có thể disable nếu hết vé)
                this.updateSpinButtonState();

                // << [AUDIO] Phát âm thanh nhận quà - kiểm tra volume từ Setting >>
                const collectVolume = AudioManager.getSoundVolume();
                if (collectVolume > 0) {
                    this.sound.play(SOUND_KEYS.SPIN_COLLECT, { volume: collectVolume });
                }

                const reward = this.items[winningIndex].getData('reward');
                console.log('--- SPIN DONE (Theo BE) ---');
                console.log('Reward:', reward);

                // Gọi API để nhận thưởng và cập nhật inventory
                try {
                    const result = await APIManager.claimSpinReward(reward.type, reward.quantity);
                    if (result.success) {
                        console.log('Đã nhận thưởng thành công:', result.reward);
                        // Cập nhật ResourceDisplay
                        this.updateResourceDisplay();
                    }
                } catch (error) {
                    console.error('Lỗi khi nhận thưởng spin:', error);
                }

                // Hiển thị hiệu ứng bay phần thưởng
                this.playRewardFlyAnimation(reward);
            }
        });
    }

    playRewardFlyAnimation(reward) {
        if (!reward) return;
        const textureKey = reward.texture || reward.type;
        const startX = this.boardContainer ? this.boardContainer.x : this.scale.width / 2;
        const startY = (this.boardContainer ? this.boardContainer.y : this.scale.height / 2) + 100;

        const icon = this.add.image(startX, startY, textureKey)
            .setOrigin(0.5)
            .setScale(1)
            .setDepth(10)
            .setAlpha(0);

        this.tweens.add({
            targets: icon,
            alpha: 1,
            y: startY - 150,
            scale: 1.05,
            duration: 700,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: icon,
                    alpha: 0,
                    y: startY - 220,
                    duration: 400,
                    ease: 'Quad.In',
                    onComplete: () => icon.destroy()
                });
            }
        });
    }
}

