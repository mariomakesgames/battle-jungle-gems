// src/ui/LevelNode.js
import Phaser from 'phaser';

// Mapping tọa độ cứng cho các số từ 1 đến 9 (và số mặc định)
// Bạn hãy tinh chỉnh từng số x, y ở đây cho đến khi vừa mắt trong game
const NUMBER_OFFSETS = {
    '1': { x: 0, y: -12 }, // Số 1 thường hẹp, có thể cần x thụt vào
    '2': { x: 0, y: -12 },
    '3': { x: 0, y: -14 },
    '4': { x: 0, y: -14 },
    '5': { x: 0, y: -13 },
    '6': { x: 0, y: -12 },
    '7': { x: 1, y: -13 },
    '8': { x: 0, y: -10 },
    '9': { x: 0, y: -11 },
    'default': { x: 0, y: -12 } // Dùng cho số > 9 hoặc số 0
};

export class LevelNode extends Phaser.GameObjects.Container {
    constructor(scene, x, y, levelId, isLocked = false, stars = 0, onSelect = null) {
        super(scene, x, y);
        
        this.onSelect = onSelect;
        this.levelId = levelId;
        this.isLocked = isLocked;
        this.stars = stars;
        this.button = null;
        this.levelText = null;
        this.starImages = [];
        
        this.createLevelNode();
        scene.add.existing(this);
    }
    
    createLevelNode() {
        // Chọn ảnh nền cho nút dựa vào trạng thái khóa/mở
        const buttonTexture = this.isLocked ? 'level_lock' : 'level_unlock';
        
        // Tạo button chính
        this.button = this.scene.add.image(0, 0, buttonTexture)
            .setScale(0.4);
        
        this.add(this.button);
        
        // Hiển thị số level (cho cả level khóa và mở)
        // KHÔNG set cứng tọa độ ở đây nữa, set 0,0 tạm
        this.levelText = this.scene.add.text(0, 0, String(this.levelId), {
            font: '28px NABILA',
            fill: '#ffffff',
            stroke: '#000000', // Thêm viền đen để nổi bật hơn
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10); // Tăng depth để đảm bảo hiển thị trên button
        
        this.add(this.levelText);
        
        // Gọi hàm cập nhật vị trí ngay khi khởi tạo
        this.updateTextPosition(this.levelId);
        
        // Nếu level đã mở, hiển thị các ngôi sao và thêm tương tác
        if (!this.isLocked) {
            // Hiển thị các ngôi sao đạt được
            this.createStars();
            
            // Thêm hiệu ứng và sự kiện click cho level đã mở
            this.button.setInteractive({ useHandCursor: true });
            this.addButtonEvents();
        }
        // Level bị khóa - KHÔNG thêm interactive, giữ như ảnh tĩnh
        // Chỉ hiển thị số level, không có ngôi sao và không thể click
    }
    
    createStars() {
        const starPositions = [
            { x: -25, y: -38 }, // Vị trí ngôi sao 1
            { x: -2, y: -49 },   // Vị trí ngôi sao 2
            { x: 23, y: -37 }   // Vị trí ngôi sao 3
        ];
        
        for (let i = 0; i < 3; i++) {
            if (this.stars >= i + 1) {
                const starTexture = `star_${i + 1}`;
                const star = this.scene.add.image(starPositions[i].x, starPositions[i].y, starTexture)
                    .setScale(0.4);
                
                this.starImages.push(star);
                this.add(star);
            }
        }
    }
    
    addButtonEvents() {
        this.button.on('pointerover', () => {
            this.button.setScale(0.42);
        });
        
        this.button.on('pointerout', () => {
            this.button.setScale(0.4);
        });
        
        if (this.onSelect) {
            this.button.on('pointerup', this.onSelect);
            return;
        }

        this.button.on('pointerdown', () => {
            // Load level data và mở Level Review Popup
            this.scene.load.json(`level_${this.levelId}`, `assets/levels/level_${this.levelId}.json`);
            this.scene.load.once('complete', () => {
                const levelData = this.scene.cache.json.get(`level_${this.levelId}`);
                this.scene.scene.launch('LevelReviewPopup', { 
                    levelId: this.levelId, 
                    levelData: levelData 
                });
            });
            this.scene.load.start();
        });
    }
    
    // Phương thức để cập nhật trạng thái level
    updateLevelState(isLocked, stars) {
        this.isLocked = isLocked;
        this.stars = stars;
        
        // Xóa các thành phần cũ
        this.removeAll(true);
        this.starImages = [];
        
        // Tạo lại level node với trạng thái mới
        this.createLevelNode();
        
        // Cập nhật lại vị trí text sau khi tạo lại
        if (this.levelText) {
            this.updateTextPosition(this.levelId);
        }
    }
    
    /**
     * Hàm mới: Tìm tọa độ cứng trong map và gán cho text
     */
    updateTextPosition(number) {
        // Lấy config từ map, nếu không có (ví dụ số 10, 11...) thì dùng default
        const offset = NUMBER_OFFSETS[String(number)] || NUMBER_OFFSETS['default'];
        
        // Gán tọa độ mới
        this.levelText.setPosition(offset.x, offset.y);
    }

    // Phương thức để lấy thông tin level
    getLevelInfo() {
        return {
            id: this.levelId,
            isLocked: this.isLocked,
            stars: this.stars
        };
    }

    /**
     * Hàm thực hiện hiệu ứng mở khóa
     */
    playUnlockAnimation() {
        if (!this.isLocked) return; // Nếu đã mở rồi thì thôi

        // 1. Hiệu ứng Rung lắc (Shake)
        this.scene.tweens.add({
            targets: this.button,
            angle: { from: -10, to: 10 }, // Lắc qua lại
            duration: 100,
            yoyo: true,
            repeat: 5, // Lắc 5 nhịp
            ease: 'Sine.easeInOut',
            onComplete: () => {
                // 2. Sau khi lắc xong -> Đổi texture và cập nhật trạng thái
                
                // Hiệu ứng scale nhẹ lúc đổi hình
                const originalScale = 0.4;
                this.scene.tweens.add({
                    targets: this.button,
                    scale: originalScale * 1.2, // Phóng to lên xíu
                    duration: 150,
                    yoyo: true,
                    onYoyo: () => {
                        // Tại đỉnh điểm của phóng to, ta đổi ảnh
                        this.isLocked = false;
                        this.button.setTexture('level_unlock');
                        this.button.setScale(originalScale); // Reset về scale ban đầu
                        
                        // Thêm tương tác
                        this.button.setInteractive({ useHandCursor: true });
                        this.addButtonEvents();
                        
                        // (Tùy chọn) Có thể thêm hạt particle nổ ở đây nếu muốn
                        console.log(`Level ${this.levelId} unlocked visually!`);
                    }
                });
            }
        });
    }
}
