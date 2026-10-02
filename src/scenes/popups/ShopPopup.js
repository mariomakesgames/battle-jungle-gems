import { preloadPopupAssets } from '../../ui/PopupLoading';
import LanguageManager from '../../i18n/LanguageManager';
// src/scenes/popups/ShopPopup.js
import Phaser from 'phaser';
import APIManager from '../../managers/APIManager';
import PlayerDataManager from '../../managers/PlayerDataManager';
import AudioManager from '../../managers/AudioManager';
import { SOUND_KEYS } from '../../utils/SoundAssets';

export class ShopPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopPopup' });
        this.itemsLayer = null;
        this.currentPage = 0;
        this.totalPages = 1;
        this.shopData = null;
        this.itemsPerPage = 6; // 2 hàng x 3 cột
        this.prevBtn = null;
        this.nextBtn = null;
        this.pageText = null;
        this.purchasedItems = []; // Danh sách item đã mua
        this.coinDisplay = null; // Hiển thị số coin hiện tại
    }

    preload() {
        preloadPopupAssets(this, 'shop', ['MapScene']);
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // 1) Tạm dừng MapScene (nếu đang mở từ bản đồ)
        if (this.scene.isActive('MapScene')) this.scene.pause('MapScene');

        // 2) Overlay mờ phía sau
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive()
            .setDepth(1);

        // 3) Background shop (Neo vào chính giữa)
        const bg = this.add.image(centerX, centerY, 'shop_background')
            .setOrigin(0.5)
            .setScale(1)
            .setDepth(2);

        // 4) Nút đóng (X) - Neo theo tỉ lệ
        // Cũ: 470, 270 -> Mới: width * 0.816, height * 0.264
        const closeBtnX = width * 0.816;
        const closeBtnY = height * 0.264;
        const closeButton = this.add.image(closeBtnX, closeBtnY, 'pause_exit')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(5);
        closeButton.on('pointerdown', () => this.close());

        // 4.1) Hiển thị số coin hiện tại - Neo theo tỉ lệ
        // Cũ: 300, 50 -> Mới: width * 0.52, height * 0.05
        const coinX = width * 0.52;
        const coinY = height * 0.05;
        const coinIcon = this.add.image(coinX, coinY, 'coin')
            .setScale(0.4)
            .setDepth(5)
            .setScrollFactor(0);
        this.coinDisplay = this.add.text(coinX + 5, coinY, `${PlayerDataManager.getCoin()}`, {
            fontFamily: 'NABILA',
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5).setDepth(5).setScrollFactor(0);

        // 5) Lớp chứa item để tiện xoá/vẽ lại khi đổi trang
        this.itemsLayer = this.add.container(0, 0).setDepth(3);

        // 6) Nút điều khiển prev/next + text trang - Neo theo tỉ lệ
        // Cũ Y: 755 -> Mới Y: height * 0.737
        // Cũ Offset X: 80px -> Mới Offset: width * 0.139
        const pagY = height * 0.737;
        const btnOffset = width * 0.139;
        this.prevBtn = this.add.image(centerX - btnOffset, pagY, 'previous_button')
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        this.nextBtn = this.add.image(centerX + btnOffset, pagY, 'next_button')
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        this.pageText = this.add.text(centerX, pagY, '1/1', {
            fontFamily: 'UTMCookies',
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5);

        this.prevBtn.on('pointerdown', () => {
            if (this.currentPage <= 0) return;
            this.currentPage -= 1;
            this.renderPage(this.currentPage);
        });
        this.nextBtn.on('pointerdown', () => {
            if (this.currentPage >= this.totalPages - 1) return;
            this.currentPage += 1;
            this.renderPage(this.currentPage);
        });

        // 7) Gọi API để lấy data và render
        this.loadAndRenderShop();

        // Đảm bảo resume MapScene khi tắt
        this.events.on('shutdown', () => {
            if (this.scene.isPaused('MapScene')) this.scene.resume('MapScene');
        });
    }

    async loadAndRenderShop() {
        // NOTE: Đã xóa đoạn check isActive() ở đây vì khi create() gọi hàm này,
        // scene đang ở trạng thái CREATING (chưa RUNNING), nên isActive() trả về false.
        // Chỉ giữ lại đoạn check SAU lệnh await vì lúc đó scene đã RUNNING hoặc đã bị đóng.

        const { width, height } = this.scale;
        const loadingText = this.add.text(width / 2, height / 2, LanguageManager.t('loadingShop'), {
            fontSize: '24px',
            color: '#fff',
            fontFamily: 'NABILA'
        }).setOrigin(0.5).setDepth(10);

        // vô hiệu hóa lúc đầu
        this.updateButtons();
        try {
            this.shopData = await APIManager.getDailyShop();
            
            // Kiểm tra lại sau khi await (scene có thể đã bị đóng trong lúc chờ API)
            if (!this.sys || !this.sys.isActive()) {
                console.warn('ShopPopup: Scene đã bị destroy sau khi load API');
                return;
            }

            if (!this.shopData || !this.shopData.items) {
                throw new Error('Invalid shop data received');
            }

            // Load danh sách item đã mua
            this.purchasedItems = APIManager.getPurchasedItems();
            console.log('Purchased items:', this.purchasedItems);

            this.totalPages = Math.max(1, Math.ceil(this.shopData.items.length / this.itemsPerPage));
            this.currentPage = 0;
            this.renderPage(this.currentPage);
        } catch (error) {
            console.error('Failed to load shop:', error);
            // Kiểm tra loadingText còn tồn tại không trước khi setText
            if (loadingText && loadingText.active) {
                loadingText.setText(LanguageManager.t('error'));
            }
            return;
        }

        // Kiểm tra loadingText còn tồn tại không trước khi destroy
        if (loadingText && loadingText.active) {
            loadingText.destroy();
        }
    }

    renderPage(pageIndex) {
        // NOTE: Đã xóa check isActive() vì hàm này được gọi trong quá trình khởi tạo
        
        this.itemsLayer.removeAll(true);

        if (!this.shopData) {
            this.updateButtons();
            return;
        }

        const { width, height } = this.scale;

        const startIndex = pageIndex * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.shopData.items.length);
        const itemsToShow = this.shopData.items.slice(startIndex, endIndex);

        // --- CẤU HÌNH LƯỚI THEO TỈ LỆ ---
        const cols = 3;
        // Cũ: 125 -> Mới: width * 0.217
        const cellSpacingX = width * 0.217;
        // Cũ: 150 -> Mới: height * 0.146
        const cellSpacingY = height * 0.148;
        // Tính vị trí bắt đầu X sao cho Grid luôn căn giữa màn hình
        const startX = (width / 2) - cellSpacingX;
        // Cũ: 432 -> Mới: height * 0.422
        const startY = height * 0.435;

        itemsToShow.forEach((item, localIndex) => {
            const r = Math.floor(localIndex / cols);
            const c = localIndex % cols;
            const x = startX + c * cellSpacingX;
            const y = startY + r * cellSpacingY;

            const container = this.add.container(x, y);
            this.itemsLayer.add(container);

            // Lưu itemData vào container để sử dụng sau
            container.setData('itemData', item);

            // Kiểm tra xem item đã được mua chưa
            const isPurchased = this.purchasedItems.includes(item.id);

            // Danh sách các icon đã có sẵn chữ +2 trên ảnh
            const iconsWithBuiltInText = ['hammer_2', 'swap_2', 'shuffle_2', 'rocket_2', 'heart_2'];

            // Icon không có +2 thì giảm Y thêm 2 đơn vị (từ 40 xuống 38)
            const iconY = iconsWithBuiltInText.includes(item.icon) ? 40 : 36;

            // Icon đặt với origin (0.5, 1) để chân icon nằm ngay trên bảng giá
            const icon = this.add.image(0, iconY, item.icon)
                .setOrigin(0.5, 1) // Neo ở giữa - đáy
                .setName('itemIcon');
            
            // Logic scale giữ nguyên
            if (item.icon === 'ticket') {
                icon.setScale(1.3);
            }
            if (item.icon === 'heart_2') {
                icon.setScale(0.8);
            }

            // --- LOGIC HIỂN THỊ SỐ LƯỢNG ---
            let quantity = 1;
            const match = item.id.match(/_(\d+)$/);
            if (match) {
                quantity = parseInt(match[1]);
            }

            let quantityText = null;
            // Chỉ vẽ text nếu số lượng > 1 VÀ icon không nằm trong danh sách đã có chữ sẵn
            if (quantity > 1 && !iconsWithBuiltInText.includes(item.icon)) {
                // Đặt text số lượng ở phần dưới của item (y=20)
                quantityText = this.add.text(0, 20, `+${quantity}`, {
                    fontFamily: 'UTMCookies',
                    fontSize: '24px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#782a16',
                    strokeThickness: 4
                }).setOrigin(0.5);
            }
            // --- KẾT THÚC LOGIC ---
            
            // Nếu đã mua, thêm overlay màu xám
            if (isPurchased) {
                icon.setTint(0x666666); // Màu xám
                icon.setAlpha(0.5);
            }
            
            container.add(icon);

            if (quantityText) {
                container.add(quantityText);
                container.bringToTop(quantityText);
            }

            // --- HIỂN THỊ GIÁ ---
            const priceBg = this.add.image(0, 56, 'shop_price_background')
                .setOrigin(0.5)
                .setScale(1)
                .setName('itemPriceBg');
            
            if (isPurchased) {
                priceBg.setTint(0x666666);
                priceBg.setAlpha(0.5);
            }
            container.add(priceBg);

            // Text giá tiền (Vị trí x: 8 giống với giá giảm)
            const priceText = this.add.text(8, 56, isPurchased ? LanguageManager.t('soldOut') : `${item.price}`, {
                fontFamily: 'NABILA',
                fontSize: isPurchased ? '14px' : '24px',
                color: isPurchased ? '#999999' : '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // --- XỬ LÝ GIẢM GIÁ ---
            if (item.isDiscounted && !isPurchased) {
                // 1. Badge giảm giá
                const badge = this.add.image(34, -40, 'shop_discount_40')
                    .setOrigin(0.5)
                    .setScale(0.4);
                container.add(badge);

                // 2. Giá gốc: Lệch nhẹ lên trên - trái
                const originalText = this.add.text(-10, 48, `${item.originalPrice}`, {
                    fontFamily: 'NABILA',
                    fontSize: '15px',
                    color: '#dddddd',
                    stroke: '#000000',
                    strokeThickness: 3,
                    fontStyle: 'bold'
                }).setOrigin(0.5).setAlpha(0.85);
                container.add(originalText);

                // 3. Gạch ngang giá gốc
                const strike = this.add.graphics();
                strike.lineStyle(2, 0xff5555, 1);
                const halfW = (originalText.width / 2) + 2;
                strike.strokeLineShape(new Phaser.Geom.Line(-halfW, 0, halfW, 0));
                strike.setPosition(originalText.x, originalText.y);
                strike.setAngle(-10);
                container.add(strike);

                // 4. Giá mới: Lệch nhẹ xuống dưới - phải
                priceText.setPosition(8, 58);
                priceText.setFontSize('24px');
                priceText.setColor('#ffe066');
                priceText.setStroke('#000000', 5);
                priceText.setAngle(-5);
            }
            
            container.add(priceText);

            // Chỉ thêm tương tác nếu chưa mua
            if (!isPurchased) {
                // 1. Tương tác cho Icon (chính xác theo pixel)
                icon.setInteractive({ pixelPerfect: true, useHandCursor: true });
                icon.on('pointerdown', () => {
                    console.log(`[ShopPopup] Click item id: ${item.id}, price=${item.price}`);
                    this.handleBuyItem(item, container);
                });
                
                // 2. Tương tác cho Nút giá (hình chữ nhật bình thường)
                priceBg.setInteractive({ useHandCursor: true });
                priceBg.on('pointerdown', () => {
                    console.log(`[ShopPopup] Click item id: ${item.id}, price=${item.price}`);
                    this.handleBuyItem(item, container);
                });
                
                // 3. Hiệu ứng Hover (cho cả hai)
                const hoverIn = () => {
                    this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
                };
                const hoverOut = () => {
                    this.tweens.add({ targets: container, scale: 1, duration: 100 });
                };
                
                icon.on('pointerover', hoverIn);
                icon.on('pointerout', hoverOut);
                priceBg.on('pointerover', hoverIn);
                priceBg.on('pointerout', hoverOut);
            }
        });

        this.updateButtons();
    }

    updateButtons() {
        // NOTE: Đã xóa check isActive() vì hàm này được gọi trong quá trình khởi tạo
        
        const dataLoaded = !!this.shopData;
        if (this.prevBtn) {
            this.prevBtn.setAlpha(dataLoaded && this.currentPage > 0 ? 1 : 0.5)
                .setInteractive(dataLoaded && this.currentPage > 0);
        }
        if (this.nextBtn) {
            this.nextBtn.setAlpha(dataLoaded && this.currentPage < this.totalPages - 1 ? 1 : 0.5)
                .setInteractive(dataLoaded && this.currentPage < this.totalPages - 1);
        }
        if (this.pageText) {
            this.pageText.setText(dataLoaded ? `${this.currentPage + 1}/${this.totalPages}` : '-/-');
        }
    }
    
    async handleBuyItem(item, targetContainer) {
        // Kiểm tra scene còn tồn tại không
        if (!this.sys || !this.sys.isActive()) {
            console.warn('ShopPopup: Scene đã bị destroy, bỏ qua handleBuyItem');
            return;
        }

        // Disable tất cả interaction trong lúc đang xử lý
        this.setShopInteractionEnabled(false);
        
        try {
            // Gọi API mua item thông qua APIManager
            const result = await APIManager.buyItem(item.id, item.price);
            
            // Kiểm tra lại sau khi await (scene có thể đã bị đóng trong lúc chờ API)
            if (!this.sys || !this.sys.isActive()) {
                console.warn('ShopPopup: Scene đã bị destroy sau khi mua item');
                return;
            }

            if (result.success) {
                // Mua thành công
                console.log(`Đã mua ${item.id} thành công!`, result.reward);

                // << [AUDIO] Phát âm thanh mua thành công >>
                const sfxVolume = AudioManager.getSoundVolume();
                if (sfxVolume > 0) {
                    this.sound.play(SOUND_KEYS.SPIN_COLLECT, { volume: sfxVolume });
                }
                
                // Thêm item vào danh sách đã mua
                this.purchasedItems.push(item.id);
                
                // Cập nhật hiển thị coin
                if (this.coinDisplay) {
                    this.coinDisplay.setText(`${PlayerDataManager.getCoin()}`);
                }
                
                // Cập nhật ResourceDisplay
                this.updateResourceDisplay();
                
                // Hiệu ứng bay icon từ vị trí item vừa click
                const startX = targetContainer ? targetContainer.x : this.scale.width / 2;
                const startY = targetContainer ? targetContainer.y : this.scale.height / 2;
                this.playRewardFlyAnimation(item, result.reward, startX, startY);
                
                // Render lại trang hiện tại để cập nhật màu xám
                this.renderPage(this.currentPage);
            } else {
                // Mua thất bại
                console.log(`Không thể mua ${item.id}: ${result.message}`);
                this.showErrorMessage(result.message);
                
                // Enable lại interaction nếu thất bại
                this.setShopInteractionEnabled(true);
            }
            
        } catch (error) {
            console.error('Lỗi khi mua item:', error);
            this.showErrorMessage(LanguageManager.t('error'));
            
            // Enable lại interaction nếu có lỗi
            this.setShopInteractionEnabled(true);
        }
    }
    
    setShopInteractionEnabled(enabled) {
        // Disable/enable tất cả item trong itemsLayer
        this.itemsLayer.each((container) => {
            // Tìm icon và priceBg theo tên đã đặt
            const icon = container.getByName('itemIcon');
            const priceBg = container.getByName('itemPriceBg');
            
            if (enabled) {
                // Chỉ enable nếu item chưa được mua
                const itemData = container.getData('itemData');
                if (itemData && !this.purchasedItems.includes(itemData.id)) {
                    if (icon) icon.setInteractive({ pixelPerfect: true, useHandCursor: true });
                    if (priceBg) priceBg.setInteractive({ useHandCursor: true });
                }
            } else {
                if (icon) icon.disableInteractive();
                if (priceBg) priceBg.disableInteractive();
            }
        });
        
        // Disable/enable nút prev/next
        if (this.prevBtn) {
            if (enabled && this.currentPage > 0) {
                this.prevBtn.setInteractive();
            } else {
                this.prevBtn.disableInteractive();
            }
        }
        
        if (this.nextBtn) {
            if (enabled && this.currentPage < this.totalPages - 1) {
                this.nextBtn.setInteractive();
            } else {
                this.nextBtn.disableInteractive();
            }
        }
    }
    
    showErrorMessage(message) {
        const { width, height } = this.scale;
        const messageText = this.add.text(width / 2, height / 2, message, {
            fontFamily: 'NABILA',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#ff0000',
            strokeThickness: 6,
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100);
        
        // Hiệu ứng scale + fade out
        this.tweens.add({
            targets: messageText,
            scale: 1.1,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                this.tweens.add({
                    targets: messageText,
                    alpha: 0,
                    duration: 500,
                    delay: 1000,
                    onComplete: () => messageText.destroy()
                });
            }
        });
    }
    
    showPurchaseSuccessMessage(item, reward) {
        const { width, height } = this.scale;
        
        // Tạo text động dựa trên reward
        let rewardText = '';
        if (reward) {
            if (reward.type === 'ticket') {
                rewardText = `\n+${reward.quantity} ${LanguageManager.t('tickets')}`;
            } else if (reward.type.startsWith('booster_')) {
                const boosterName = reward.type.replace('booster_', '').toUpperCase();
                rewardText = `\n+${reward.quantity} ${boosterName}`;
            } else if (reward.type === 'lives') {
                rewardText = `\n❤️ ${LanguageManager.t('lives')}`;
            } else if (reward.type === 'coins') {
                rewardText = `\n+${reward.quantity} ${LanguageManager.t('coins')}`;
            }
        }
        
        const messageText = this.add.text(width / 2, height / 2, `${LanguageManager.t('purchaseSuccess')}${rewardText}`, {
            fontFamily: 'NABILA',
            fontSize: '28px',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100);
        
        // Hiệu ứng bounce + fade out
        this.tweens.add({
            targets: messageText,
            scale: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true,
            onComplete: () => {
                this.tweens.add({
                    targets: messageText,
                    alpha: 0,
                    duration: 500,
                    delay: 1500,
                    onComplete: () => messageText.destroy()
                });
            }
        });
    }
    
    // Hiệu ứng bay icon khi mua thành công
    playRewardFlyAnimation(item, reward, startX, startY) {
        // Sử dụng icon của item làm texture bay
        const textureKey = item.icon;
        
        // Tạo icon bay
        const flyIcon = this.add.image(startX, startY, textureKey)
            .setOrigin(0.5)
            .setDepth(100);

        // --- Hiệu ứng Tween ---
        // Ban đầu scale nhỏ và mờ
        flyIcon.setScale(0.5);
        flyIcon.setAlpha(0);

        this.tweens.add({
            targets: flyIcon,
            alpha: 1,
            y: startY - 110, // Bay lên 150px
            scale: 1.05,      // Phóng to ra một chút
            duration: 700,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: flyIcon,
                    alpha: 0,
                    y: startY - 50, 
                    scale: 0.8,
                    duration: 400,
                    ease: 'Quad.In',
                    onComplete: () => flyIcon.destroy()
                });
            }
        });
    }
    
    updateResourceDisplay() {
        const mapScene = this.scene.get('MapScene');
        if (mapScene && mapScene.resourceDisplay) {
            mapScene.resourceDisplay.updateDisplay();
        }
    }

    close() {
        this.scene.stop();
    }
}


