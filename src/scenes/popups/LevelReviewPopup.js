import { preloadPopupAssets } from '../../ui/PopupLoading';
import LanguageManager from '../../i18n/LanguageManager';
import { localizeButton } from '../../ui/LocalizedUI';
// src/scenes/popups/LevelReviewPopup.js
import Phaser from 'phaser';
import PlayerDataManager from '../../managers/PlayerDataManager';
import { ObjectiveItem } from '../../ui/ObjectiveItem';
import { BOOSTER_TYPES } from '../../utils/constants';

export class LevelReviewPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelReviewPopup' });
        this.levelId = 1;
        this.levelData = null;
        this.playerData = null;
        this.boosterItems = [];
    }

    // Nhận dữ liệu từ MapScene
    init(data) {
        this.levelId = data.levelId;
        this.levelData = data.levelData;
    }

    preload() {
        preloadPopupAssets(this, 'levelReview', ['MapScene']);
    }

    create() {
        const { width, height } = this.scale;
        this.playerData = PlayerDataManager.getUserData();

        // 1. Tạm dừng MapScene
        this.scene.pause('MapScene');

        // 2. Tạo một lớp nền mờ
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive()
            .setDepth(1);

        // 3. Tạo background UI chính
        const uiBackground = this.add.image(width / 2, height / 2, 'level_review_ui')
            .setOrigin(0.5)
            .setScale(1)
            .setDepth(2);

        // 4. Tạo nút đóng (X) - vị trí tương tự PausePopup
        const closeButton = this.add.image(470, 270, 'pause_exit')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(5);

        closeButton.on('pointerdown', () => {
            this.closePopup();
        });

        // 4.1. Dòng chữ Stage + số level ở giữa, cùng y với nút X
        this.add.text(width / 2, 250, LanguageManager.t('stage', { level: this.levelId }), {
            fontFamily: 'UTMCookies',
            fontSize: '38px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5);

        // 5. Tạo bảng nhiệm vụ
        this.createObjectivesPanel(width, height);

        // 6. Tạo bảng booster
        this.createBoostersPanel(width, height);

        // 7. Tạo nút bắt đầu chơi
        this.createPlayButton(width, height);

        // 9. Đảm bảo game resume khi popup tắt
        this.events.on('shutdown', this.onResumeMap, this);
    }


    createObjectivesPanel(width, height) {
        if (!this.levelData || !this.levelData.objectives) return;

        // Vị trí cố định cho 4 mission (max = 4)
        const missionPositions = [
            { x: 170, y: 410 },
            { x: 250, y: 410 },
            { x: 330, y: 410 },
            { x: 400, y: 410 }
        ];

        this.objectiveItems = {};

        this.levelData.objectives.forEach((objData, index) => {
            // Chỉ hiển thị tối đa 4 mission
            if (index >= 4) return;
            
            const position = missionPositions[index];
            
            // Tạo key duy nhất cho mỗi nhiệm vụ
            const objectiveKey = `${objData.target}_${objData.type}`;
            
            const item = new ObjectiveItem(this, position.x, position.y, objData);
            this.objectiveItems[objectiveKey] = item;
            item.setDepth(3);
        });
    }

    createBoostersPanel(width, height) {
        // Vị trí cố định cho 4 booster
        const boosterPositions = [
            { x: 170, y: 620 },
            { x: 250, y: 620 },
            { x: 330, y: 620 },
            { x: 400, y: 620 }
        ];

        const boosterTypes = [
            { key: 'booster_hammer', type: BOOSTER_TYPES.HAMMER },
            { key: 'booster_swap', type: BOOSTER_TYPES.SWAP },
            { key: 'booster_rocket', type: BOOSTER_TYPES.ROCKET },
            { key: 'booster_shuffle', type: BOOSTER_TYPES.SHUFFLE }
        ];

        this.boosterItems = [];

        boosterTypes.forEach((boosterInfo, index) => {
            const position = boosterPositions[index];
            
            const background = this.add.image(position.x, position.y, 'booster_background')
                .setOrigin(0.5)
                .setScale(0.4)
                .setDepth(2);
            
            let iconX = position.x;
            if (boosterInfo.type === BOOSTER_TYPES.HAMMER) {
                iconX = position.x + 5;
            } else if (boosterInfo.type === BOOSTER_TYPES.SHUFFLE) {
                iconX = position.x - 5;
            }
            
            const icon = this.add.image(iconX, position.y - 15, boosterInfo.key)
                .setOrigin(0.5)
                .setDepth(3);

            const quantityBg = this.add.image(position.x + 29, position.y + 31, 'quantity_background')
                .setOrigin(1, 1)
                .setScale(0.4)
                .setDepth(3);
            
            const boosterItem = {
                background,
                icon,
                quantityBg,
                countDisplay: null,
                type: boosterInfo.type,
                position: { ...position }
            };

            this.boosterItems.push(boosterItem);
            this.drawBoosterCount(boosterItem);
        });
    }

    drawBoosterCount(item) {
        if (!item) return;

        if (item.countDisplay) {
            item.countDisplay.destroy();
            item.countDisplay = null;
        }

        const boosters = this.playerData?.inventory?.boosters || {};
        const count = boosters[item.type] || 0;
        const baseX = item.position.x;
        const baseY = item.position.y;

        // Tính toán tâm của hình tròn nền
        const centerX = baseX + 13;
        const centerY = baseY + 10;

        if (count === 0) {
            item.countDisplay = this.add.image(centerX, centerY, 'add_icon')
                .setOrigin(0.5, 0.5) // Neo giữa-giữa
                .setScale(0.4)
                .setDepth(4)
                .setInteractive({ useHandCursor: true });

            item.countDisplay.on('pointerdown', () => {
                this.tweens.add({
                    targets: item.countDisplay,
                    scale: 0.35,
                    duration: 50,
                    yoyo: true,
                    onComplete: () => this.openShop()
                });
            });
        } else {
            item.countDisplay = this.add.text(centerX, centerY, `${count}`, {
                fontFamily: 'UTMCookies',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                fontWeight: 'bold',
                strokeThickness: 3
            }).setOrigin(0.5, 0.5).setDepth(4); // Neo giữa-giữa
        }
    }

    openShop() {
        console.log('Open Shop from LevelReviewPopup');
        this.scene.launch('ShopPopup');
        
        const shopPopup = this.scene.get('ShopPopup');
        if (shopPopup?.events) {
            shopPopup.events.once('shutdown', () => {
                this.updateBoosterStates();
            });
        }
    }

    updateBoosterStates() {
        console.log('Shop closed, refreshing booster data...');
        this.playerData = PlayerDataManager.getUserData();

        this.boosterItems.forEach(item => {
            this.drawBoosterCount(item);
        });
    }

    createPlayButton(width, height) {
        // Tạo nút Play sử dụng texture play.png
        const playButton = this.add.image(width / 2, 750, 'play_button')
            .setOrigin(0.5)
            .setScale(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        localizeButton(this, playButton, 'play');

        playButton.on('pointerdown', () => {
            const currentLives = PlayerDataManager.getLives();
            if (currentLives > 0) {
                PlayerDataManager.updateLives(-1);

                const mapScene = this.scene.get('MapScene');
                if (mapScene?.resourceDisplay?.updateDisplay) {
                    mapScene.resourceDisplay.updateDisplay();
                }

                this.startGame();
            } else {
                console.log('Không đủ mạng để bắt đầu màn chơi!');
                this.scene.launch('ShopPopup');
            }
        });

        // Hiệu ứng hover
        playButton.on('pointerover', () => {
            playButton.setScale(0.52);
        });

        playButton.on('pointerout', () => {
            playButton.setScale(0.5);
        });
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

    startGame() {
        // Chuyển sang LevelLoaderScene với levelId
        this.scene.stop('MapScene');
        this.scene.start('LevelLoaderScene', { levelId: this.levelId });
    }
}
