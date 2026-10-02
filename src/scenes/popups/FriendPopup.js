import { localizeButton } from '../../ui/LocalizedUI';
// src/scenes/popups/FriendPopup.js
import Phaser from 'phaser';
import APIManager from '../../managers/APIManager';

export class FriendPopup extends Phaser.Scene {
    constructor() {
        super({ key: 'FriendPopup' });
        this.friends = [];
        this.listContainer = null;
        this.isSelectAll = false;
        this.tickIcon = null;
        
        // Các biến lưu giới hạn scroll
        this.minY = 0;
        this.maxY = 0;
        this.viewportY = 0; // Đỉnh vùng hiển thị list
    }

    create() {
        const { width, height } = this.scale;

        // 1. Pause Scene nền
        if (this.scene.isActive('MapScene')) this.scene.pause('MapScene');

        // 2. Overlay tối màu
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0).setInteractive().setDepth(1);

        // 3. UI Background chính
        const bg = this.add.image(width / 2, height / 2, 'friend_ui_bg')
            .setOrigin(0.5).setDepth(2).setScale(0.4); 


        // 5. Nút đóng (X)
        const closeButton = this.add.image(470, 270, 'pause_exit')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(5); // Tăng depth

        closeButton.on('pointerdown', () => {
            this.closePopup();
        });

        // 6. KHỞI TẠO DANH SÁCH (Scroll View)
        this.createFriendList(bg);

        // 7. PHẦN BOTTOM (Cover + Select All + Send All)
        this.createBottomPanel(bg);

        // Load dữ liệu
        this.loadFriends();
    }

    createFriendList(bg) {
        // --- CẤU HÌNH VÙNG HIỂN THỊ ---
        const listWidth = 450; 
        const listHeight = 400; // Chiều cao vùng nhìn thấy

        // Tính toán vị trí dựa trên BG
        const listX = bg.x - listWidth / 2;

        // Canh đỉnh vùng hiển thị khớp với khung beige
        this.viewportY = bg.y - 190;

        // 1. Tạo Mask (Mặt nạ)
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(listX, this.viewportY, listWidth, listHeight);
        const mask = maskShape.createGeometryMask();

        // 2. Tạo Container chứa danh sách
        this.listContainer = this.add.container(listX + listWidth / 2, this.viewportY);
        this.listContainer.setDepth(3);
        this.listContainer.setMask(mask);

        // 3. Vùng tương tác Scroll (Zone)
        // QUAN TRỌNG: Depth phải để 20 để nằm đè lên mọi thứ khác
        const scrollZone = this.add.zone(listX + listWidth / 2, this.viewportY + listHeight / 2, listWidth, listHeight)
            .setOrigin(0.5)
            .setInteractive({ draggable: true })
            .setDepth(2.5); // Trên overlay (1) nhưng dưới list items (3) để không chặn hover

        // --- LOGIC SCROLL TỐI ƯU (Dùng sự kiện Drag) ---
        scrollZone.on('drag', (pointer, dragX, dragY) => {
            const deltaY = pointer.y - pointer.prevPosition.y;
            this.listContainer.y += deltaY;

            // Clamp giới hạn
            const clampedY = Phaser.Math.Clamp(this.listContainer.y, this.minY, this.maxY);
            
            // QUAN TRỌNG: Làm tròn số để CHỮ KHÔNG BỊ MỜ
            this.listContainer.y = Math.round(clampedY);
        });
        
        // Hỗ trợ lăn chuột
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            // Kiểm tra xem chuột có đang nằm trong vùng scroll không
            if (scrollZone.getBounds().contains(pointer.x, pointer.y)) {
                this.listContainer.y -= deltaY * 0.5;
                const clampedY = Phaser.Math.Clamp(this.listContainer.y, this.minY, this.maxY);
                this.listContainer.y = Math.round(clampedY);
            }
        });
    }

    async loadFriends() {
        try {
            this.friends = await APIManager.getFriendsList();
            this.renderFriends();
        } catch (e) {
            console.error("Lỗi load friends", e);
        }
    }

    renderFriends() {
        this.listContainer.removeAll(true);
        
        const itemHeight = 115; 
        
        // QUAN TRỌNG: Làm tròn số offset để text sắc nét
        // 115 / 2 = 57.5 -> Math.floor -> 57
        const startOffset = Math.floor(itemHeight / 2); 

        this.friends.forEach((friend, index) => {
            const yPos = startOffset + (index * itemHeight);
            
            // Container con cũng đặt ở tọa độ chẵn
            const itemContainer = this.add.container(0, Math.floor(yPos));

            const itemBg = this.add.image(0, 0, 'friend_item_bg').setOrigin(0.5).setScale(0.4);
            const avt = this.add.image(-115, 0, friend.avatar).setScale(0.4);
            
            const nameText = this.add.text(-70, -22, friend.name, {
                fontFamily: 'UTMCookies', fontSize: '14px', color: '#ffffff', stroke: '#b43827', strokeThickness: 2
            }).setOrigin(0, 0.5);
            const levelText = this.add.text(-15, 0, `${friend.level}`, {
                fontFamily: 'UTMCookies', fontSize: '16px', color: '#FFD700', stroke: '#b43827', strokeThickness: 3
            }).setOrigin(0, 0.5);
            const idText = this.add.text(-45, 25, `${friend.id}`, {
                fontFamily: 'UTMCookies', fontSize: '16px', color: '#FFD700', stroke: '#b43827', strokeThickness: 3
            }).setOrigin(0, 0.5);

            // Button Message (giữ hover/click)
            const msgBtn = this.add.image(130, 0, 'friend_msg_icon')
                .setScale(1).setInteractive({ useHandCursor: true });
            
            msgBtn.on('pointerover', () => {
                this.tweens.add({ targets: msgBtn, scale: 1.1, duration: 100, ease: 'Sine.easeInOut' });
            });
            msgBtn.on('pointerout', () => {
                this.tweens.add({ targets: msgBtn, scale: 1, duration: 100, ease: 'Sine.easeInOut' });
            });
            msgBtn.on('pointerdown', () => {
                console.log(`Message to ${friend.name}`);
                this.tweens.add({ targets: msgBtn, scale: 0.9, yoyo: true, duration: 50 });
            });

            itemContainer.add([itemBg, avt, nameText, levelText, idText, msgBtn]);
            this.listContainer.add(itemContainer);
        });

        // --- CẬP NHẬT GIỚI HẠN SCROLL ---
        const totalContentHeight = this.friends.length * itemHeight;
        const viewHeight = 400; // Phải khớp với listHeight ở trên
        
        this.maxY = this.viewportY;

        if (totalContentHeight > viewHeight) {
            this.minY = this.viewportY - (totalContentHeight - viewHeight) - 20; 
        } else {
            this.minY = this.viewportY;
        }
        
        this.listContainer.y = this.maxY;
    }

    createBottomPanel(bg) {
        // Vị trí phần dưới cùng của bảng
        const bottomY = bg.y + bg.displayHeight/2 - 50; 

        // 1. Cover (Hình nền phần dưới, che phần list trôi xuống)
        // Nó cần nằm đè lên listContainer nhưng dưới các nút bấm
        const cover = this.add.image(bg.x, 765, 'friend_cover')
            .setOrigin(0.5).setDepth(4).setScale(0.4); 

        // Decor nằm đè lên cover
        // Dùng chung toạ độ (bg.x, 765) và scale (0.4) với cover
        this.add.image(260, 785, 'friend_decor')
            .setOrigin(0.5).setDepth(4).setScale(0.4);

        // 2. Select All Checkbox
        // Khung checkbox (giả sử nằm trong ảnh cover hoặc vẽ thêm nếu cần)
        // Text "Select All" (Dùng ảnh bạn cung cấp)
        const selectAllText = this.add.image(bg.x, 735, 'friend_select_all_text')
            .setOrigin(0.5).setDepth(5).setScale(0.4);
        localizeButton(this, selectAllText, 'selectAll');

        // Checkbox logic (Tick xanh)
        // Vị trí tick bên trái chữ Select All

        // Vẽ một hình chữ nhật tàng hình để làm vùng bấm cho checkbox
        const checkboxZone = this.add.rectangle(246, 735, 150, 50, 0x000000, 0)
            .setInteractive({ useHandCursor: true }).setDepth(5);

        // Ảnh tick xanh (mặc định ẩn)
        this.tickIcon = this.add.image(246, 735, 'friend_tick')
            .setOrigin(0.5).setDepth(5).setScale(0.4).setVisible(false);

        checkboxZone.on('pointerdown', () => {
            this.isSelectAll = !this.isSelectAll;
            this.tickIcon.setVisible(this.isSelectAll);
            // Hiệu ứng scale nhẹ
            this.tweens.add({ targets: this.tickIcon, scale: { from: 0, to: 0.4 }, duration: 100 });
        });

        // 3. Send All Button
        const sendBtn = this.add.image(bg.x, 790, 'friend_send_button')
            .setScale(0.4).setInteractive({ useHandCursor: true }).setDepth(5);
        localizeButton(this, sendBtn, 'sendAll');

        sendBtn.on('pointerdown', () => {
            this.handleSendAll();
            this.tweens.add({ targets: sendBtn, scale: 0.4 * 0.9, yoyo: true, duration: 100 });
        });
    }

    handleSendAll() {
        if (!this.isSelectAll) return;
        // Gọi API gửi quà ở đây
        this.closePopup();
    }

    closePopup() {
        if (this.scene.isPaused('MapScene')) this.scene.resume('MapScene');
        this.scene.stop();
    }
}

