import { startAssetStream } from './AssetStreamScene';
import LanguageManager from '../i18n/LanguageManager';
// src/scenes/MapScene.js
import Phaser from 'phaser';
import PlayerDataManager from '../managers/PlayerDataManager';
import { MapVFXManager } from '../objects/vfx/MapVFXManager';
import { LevelNode } from '../ui/LevelNode';
import { ResourceDisplay } from '../ui/ResourceDisplay';

export class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
        // this.mapContainer = null; // <-- BỎ DÒNG NÀY
        this.vfxManager = null;
        this.targetUnlockNode = null; // Biến lưu node cần animation
        
        /** 
         * Sổ đăng ký map, lưu trữ thông tin vị trí của mỗi map part
         * @type {Map<string, {image: Phaser.GameObjects.Image, offsetY: number, displayHeight: number}>} 
         */
        this.mapRegistry = new Map();
    }

    /**
     * Nhận dữ liệu từ WinPopup
     */
    init(data) {
        // Ép kiểu parseInt để đảm bảo luôn là số (tránh lỗi String vs Number trên Host)
        this.readyEffects = new Set();
        this.mapMusicStarted = false;
        this.assetStream = null;
        this.streamingGroup = null;
        this.effectsReadyAt = 0;
        this.completedLevelId = (data && data.completedLevelId) ? parseInt(data.completedLevelId, 10) : null;
        console.log(`[MapScene Init] CompletedLevelID: ${this.completedLevelId} (Type: ${typeof this.completedLevelId})`);
    }

    /**
     * Hàm tiện ích để lấy vị trí Y bắt đầu (offset) của một map part
     * @param {string} key Key của map (ví dụ: 'map_part1')
     * @returns {number} Tọa độ Y (world) bắt đầu của map part đó
     */
    getMapOffsetY(key) {
        const mapInfo = this.mapRegistry.get(key);
        return mapInfo ? mapInfo.offsetY : 0;
    }

    create() {
        const { width, height } = this.scale;
        const playerData = PlayerDataManager.getProgression();
        const fullPlayerData = PlayerDataManager.getUserData();

        // << [AUDIO] Dừng tất cả âm thanh từ các scene khác (đặc biệt là GameScene) >>
        // Khi quay về MapScene, cần đảm bảo nhạc từ GameScene không còn chạy
        this.sound.stopAll();
        console.log('[MapScene] Stopped all sounds from previous scenes');
        
        // Nếu GameScene đang chạy, dừng nó
        if (this.scene.isActive('GameScene')) {
            this.scene.stop('GameScene');
            console.log('[MapScene] Stopped GameScene');
        }
        // ---------------------------------------------------------------

        // --- FADE IN ĐỂ CHE FRAME ĐẦU TIÊN TRONG KHI VFX ĐANG KHỞI TẠO ---
        this.cameras.main.fadeIn(300, 0, 0, 0);
        // ---------------------------------------------------------------

        this.events.on('wake', () => {
            this.completedLevelId = null;
            this.targetUnlockNode = null;
        });

        // --- ĐOẠN CODE ĐÃ SỬA: ÉP KIỂU VÀ DEBUG ---
        
        // Tính toán level cần mở khóa hiệu ứng
        let nextLevelIdToAnimate = -1;
        
        if (this.completedLevelId) {
            // Ép kiểu số cho chắc chắn (đề phòng)
            const completedId = parseInt(this.completedLevelId, 10);
            const potentialNextLevel = completedId + 1;
            const highestUnlocked = parseInt(playerData.highestLevelUnlocked, 10);
            
            // Debug log để kiểm tra trên Host
            console.log(`[DEBUG HOST] Completed: ${completedId} (Type: ${typeof completedId})`);
            console.log(`[DEBUG HOST] Highest: ${highestUnlocked} (Type: ${typeof highestUnlocked})`);
            console.log(`[DEBUG HOST] Potential: ${potentialNextLevel}`);
            console.log(`[DEBUG HOST] So sánh: ${potentialNextLevel} === ${highestUnlocked} => ${potentialNextLevel === highestUnlocked}`);
            
            // LOGIC MỚI: Chỉ chạy animation nếu level tiếp theo CHÍNH LÀ level cao nhất hiện tại (tức là mới mở khóa)
            // Nếu potentialNextLevel < highestLevelUnlocked, nghĩa là level đó đã mở từ lâu rồi -> Bỏ qua
            if (potentialNextLevel === highestUnlocked) {
                nextLevelIdToAnimate = potentialNextLevel;
                console.log(`[DEBUG HOST] Animation sẽ chạy cho Level ${nextLevelIdToAnimate}`);
            }
            
            this.completedLevelId = null;
        }
        // ---------------------------

        // this.mapContainer = this.add.container(0, 0); // <-- BỎ DÒNG NÀY

        // --- 1. XÂY DỰNG MAP ĐỘNG VÀ TẠO REGISTRY ---

        // *** FIX 1: Đảo ngược thứ tự. map_part2 ở trên, map_part1 ở dưới. ***
        const mapPartKeys = [
            'map_part2', // Map ở trên cùng (Offset Y = 0)
            'map_part1'  // Map ở dưới (Offset Y = map2.displayHeight)
        ]; 
        
        let currentY = 0; // Vị trí Y (world) để đặt map part tiếp theo

        mapPartKeys.forEach((key, index) => {
            // Preserve the original logical geometry for all level/VFX coordinates.
            const displayHeight = key === 'map_part2' ? width * 1067 / 600 : width * 2668 / 1500;
            const depth = key === 'map_part2' ? 10 : 0;
            const mapImage = this.textures.exists(key)
                ? this.add.image(width / 2, currentY, key).setOrigin(0.5, 0).setDisplaySize(width, displayHeight)
                : this.add.rectangle(width / 2, currentY, width, displayHeight, 0x315031).setOrigin(0.5, 0);
            mapImage.setDepth(depth);
            const label = this.textures.exists(key) ? null : this.add.text(width / 2, currentY + displayHeight / 2,
                LanguageManager.t('loading', { percent: 0 }), {
                    fontFamily: 'UTMCookies, Arial, sans-serif', fontSize: '24px', color: '#fff5df'
                }).setOrigin(0.5).setDepth(depth + 1);
            this.mapRegistry.set(key, { image: mapImage, label, offsetY: currentY, displayHeight });
            console.log(`Map part '${key}' đã được đặt tại Y offset: ${currentY} với depth: ${mapImage.depth}`);
            // Cập nhật Y cho map part tiếp theo
            currentY += displayHeight;
        });

        const totalHeight = currentY; // Tổng chiều cao của toàn bộ map
        console.log(`=== MAP INFO ===`);
        console.log(`Total map height: ${totalHeight}`);

        // --- 2. TẠO LEVEL NODE VỚI TỌA ĐỘ LOCAL ---
        
        // *** FIX 2: Lấy offset của map_part1 (map ở dưới cùng) ***
        const map1Offset = this.getMapOffsetY('map_part1'); 
        console.log(`Map part 'map_part1' bắt đầu tại Y: ${map1Offset}, Height: ${this.mapRegistry.get('map_part1').displayHeight}`);

        // *** Dữ liệu vị trí level MỚI (dùng tọa độ local) ***
        // Tọa độ world cũ (1164-1990) rõ ràng là thuộc về map_part1.
        // y_local = y_world_cũ - offset_của_map_part1
        
        // Lấy offset của map_part2
        const map2Offset = this.getMapOffsetY('map_part2');
        console.log(`Map part 'map_part2' bắt đầu tại Y: ${map2Offset}, Height: ${this.mapRegistry.get('map_part2').displayHeight}`);
        console.log(`=== LEVEL NODES ===`);
        
        const localLevelPositions = [
            // Map Part 1 - Level 1 đến 4
            { id: 1, mapKey: 'map_part1', x: 223, y: (1990 - map1Offset) },
            { id: 2, mapKey: 'map_part1', x: 297, y: (1752 - map1Offset) },
            { id: 3, mapKey: 'map_part1', x: 296, y: (1563 - map1Offset) },
            { id: 4, mapKey: 'map_part1', x: 286, y: (1164 - map1Offset) }, // Level 4 lên vị trí cũ của level 5
            
            // Map Part 2 - Level 5 đến 9
            { id: 5, mapKey: 'map_part2', x: 215, y: (900 - map2Offset) },
            { id: 6, mapKey: 'map_part2', x: 310, y: (730 - map2Offset) },
            { id: 7, mapKey: 'map_part2', x: 295, y: (520 - map2Offset) },
            { id: 8, mapKey: 'map_part2', x: 320, y: (350 - map2Offset) },
            { id: 9, mapKey: 'map_part2', x: 362, y: (180 - map2Offset) }
        ];

        // Reset biến lưu node cần animate
        this.targetUnlockNode = null;

        localLevelPositions.forEach(level => {
            // Logic kiểm tra khóa gốc
            let isLocked = level.id > playerData.highestLevelUnlocked;
            const stars = playerData.levelStars[level.id] || 0;
            
            // === LOGIC MỚI: XỬ LÝ HIỆU ỨNG UNLOCK ===
            // Nếu level này chính là level cần mở khóa (về mặt logic nó đã được mở trong Data, 
            // nhưng ta muốn hiển thị nó Khóa lúc đầu để chạy animation)
            if (level.id === nextLevelIdToAnimate && level.id <= playerData.highestLevelUnlocked) {
                isLocked = true; // Cưỡng ép hiển thị Khóa ban đầu
                console.log(`Level ${level.id} will be animated to unlock!`);
            }
            // ========================================
            
            // *** TÍNH TOÁN TỌA ĐỘ WORLD ***
            const mapOffsetY = this.getMapOffsetY(level.mapKey);
            const worldX = level.x; // X không đổi
            const worldY = mapOffsetY + level.y; // Y (World) = Y (Offset) + Y (Local)
            
            console.log(`Level ${level.id} (${level.mapKey}): Local Y=${level.y}, Map Offset=${mapOffsetY}, World Y=${worldY}, Locked=${isLocked}`);
            
            const levelNode = new LevelNode(this, worldX, worldY, level.id, isLocked, stars);
            
            // Lưu lại node cần animate
            if (level.id === nextLevelIdToAnimate) {
                this.targetUnlockNode = levelNode;
            }
            
            // Đặt depth cho LevelNode dựa trên map
            // Map_part1 (depth 0): LevelNode depth 5
            // Map_part2 (depth 10): LevelNode depth 15 để hiển thị trên map_part2
            if (level.mapKey === 'map_part2') {
                levelNode.setDepth(15);
            } else {
                levelNode.setDepth(5);
            }
            
            // *** SỬA Ở ĐÂY: Thêm levelNode trực tiếp vào Scene ***
            // Giả sử LevelNode là một GameObject, dùng this.add.existing
            this.add.existing(levelNode); 
            // this.mapContainer.add(levelNode); // <-- THAY DÒNG NÀY
        });

        // --- KÍCH HOẠT ANIMATION NẾU CÓ ---
        if (this.targetUnlockNode) {
            this.time.delayedCall(500, () => {
                if (this.targetUnlockNode && this.targetUnlockNode.active) {
                    this.targetUnlockNode.playUnlockAnimation();
                }
                this.completedLevelId = null;
                this.targetUnlockNode = null;
            });
        }

        // --- 3. CAMERA VÀ INPUT ---
        this.cameras.main.setBounds(0, 0, width, totalHeight);
        this.cameras.main.scrollY = totalHeight - height;
        
        // Chức năng kéo để cuộn
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y);
            }
        });

        // Chức năng cuộn bằng nút lăn chuột
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const scrollSpeed = 1; // Tốc độ cuộn (có thể điều chỉnh)
            this.cameras.main.scrollY += deltaY * scrollSpeed;
            
            // Giới hạn cuộn trong phạm vi cho phép
            this.cameras.main.scrollY = Phaser.Math.Clamp(
                this.cameras.main.scrollY, 
                0, 
                totalHeight - height
            );
        });

        // --- 4. XỬ LÝ WEBGL CONTEXT LOST/RESTORED ---
        
        // Off listener cũ trước để tránh trùng lặp
        this.game.renderer.off('contextlost', this.handleContextLost, this);
        this.game.renderer.off('contextrestored', this.handleContextRestored, this);
        
        // Bind các hàm handler để có thể off sau này
        this.handleContextLost = () => {
            console.warn("⚠️ WebGL Context Lost! Game đang bị treo...");
        };
        
        this.handleContextRestored = () => {
            console.log("✅ WebGL Context Restored! Đang tải lại...");
            
            // Dừng tất cả VFX hiện tại để tránh lỗi
            if (this.vfxManager) {
                this.vfxManager.shutdown();
                this.vfxManager = null;
            }
            
            // Restart lại scene để load lại mọi thứ từ đầu
            this.time.delayedCall(100, () => {
                this.scene.restart();
            });
        };
        
        // Lắng nghe sự kiện mất và phục hồi WebGL context
        this.game.renderer.on('contextlost', this.handleContextLost, this);
        this.game.renderer.on('contextrestored', this.handleContextRestored, this);
        
        // --- 5. KHỞI TẠO VFX VỚI HỆ THỐNG MAPPING ---
        
        // *** Truyền mapRegistry cho VFXManager ***
        this.vfxManager = new MapVFXManager(this, this.mapRegistry); 
        
        // Khởi tạo VFX cho TẤT CẢ các map (đã tối ưu load từ từ)
        this.effectsReadyAt = this.time.now + 2000;
        this.lastMapScroll = this.cameras.main.scrollY;
        this.events.on('pause', this.cancelMapStream, this);
        this.events.on('resume', this.deferMapEffects, this);
        
        // --- 6. TẠO UI OVERLAY HIỂN THỊ COIN VÀ HEART ---
        
        // Tạo ResourceDisplay ở góc trên bên trái màn hình
        this.resourceDisplay = new ResourceDisplay(this, 20, 20, fullPlayerData);
        
        // --- 7. TẠO NÚT SPIN VÀ STORE ---
        // Vị trí (góc dưới bên trái và dưới bên phải)
        const iconScale = 1; // Tùy chỉnh scale của icon
        const iconDepth = 1000; // Đặt depth cao để nổi lên trên

        // Tạo nút Spin (Vòng quay) - Góc dưới bên trái
        const spinButton = this.add.image(50, 120, 'spin')
            .setScale(iconScale)
            .setInteractive({ useHandCursor: true })
            .setDepth(iconDepth)
            .setScrollFactor(0); // <-- Đây là chìa khóa để "dính" vào màn hình

        spinButton.on('pointerdown', () => {
            console.log('Spin button clicked!');
            this.scene.launch('SpinPopup');
        });

        // Tạo nút Store (Cửa hàng) - Góc dưới bên phải
        const storeButton = this.add.image(50, 190, 'store')
            .setScale(iconScale)
            .setInteractive({ useHandCursor: true })
            .setDepth(iconDepth)
            .setScrollFactor(0); // <-- Đây là chìa khóa để "dính" vào màn hình

        storeButton.on('pointerdown', () => {
            console.log('Store button clicked!');
            this.scene.launch('ShopPopup');
        });

        // Tạo nút Friend - Góc dưới (hoặc vị trí bạn muốn)
        const friendButton = this.add.image(50, 260, 'friend_button') // Dùng tạm icon msg làm nút mở
            .setScale(1)
            .setInteractive({ useHandCursor: true })
            .setDepth(iconDepth)
            .setScrollFactor(0);

        friendButton.on('pointerdown', () => {
            this.scene.launch('FriendPopup');
        });

        // (Tùy chọn) Thêm hiệu ứng hover giống nút settings
        [spinButton, storeButton, friendButton].forEach(button => {
            button.on('pointerover', () => {
                this.tweens.add({ targets: button, scale: 1.1, duration: 100 });
            });

            button.on('pointerout', () => {
                this.tweens.add({ targets: button, scale: 1, duration: 100 });
            });
        });
        
        // Dọn dẹp VFX khi scene shutdown
        this.events.once('shutdown', () => {
            this.cancelMapStream();
            this.events.off('pause', this.cancelMapStream, this);
            this.events.off('resume', this.deferMapEffects, this);
            this.completedLevelId = null;
            this.targetUnlockNode = null;

            if (this.vfxManager) {
                this.vfxManager.shutdown();
            }
            
            // Dọn dẹp listener WebGL
            if (this.handleContextLost) {
                this.game.renderer.off('contextlost', this.handleContextLost, this);
            }
            if (this.handleContextRestored) {
                this.game.renderer.off('contextrestored', this.handleContextRestored, this);
            }
        });
    }

    deferMapEffects() { this.effectsReadyAt = this.time.now + 2000; }

    cancelMapStream() {
        this.assetStream?.cancel();
        this.assetStream = null;
        this.streamingGroup = null;
        this.deferMapEffects();
    }

    update() {
        const top = this.cameras.main.scrollY;
        const bottom = top + this.scale.height;
        if (top !== this.lastMapScroll || this.input.activePointer.isDown) {
            this.deferMapEffects();
            this.lastMapScroll = top;
        }
        const area2 = this.mapRegistry.get('map_part2');
        if (area2 && top < area2.offsetY + area2.displayHeight && bottom > area2.offsetY && !this.textures.exists('map_part2')) {
            if (this.streamingGroup === 'mapArea2') return;
            this.cancelMapStream();
            this.streamMapBatch('mapArea2', () => {
                area2.image.destroy();
                area2.label?.destroy();
                area2.label = null;
                area2.image = this.add.image(this.scale.width / 2, area2.offsetY, 'map_part2')
                    .setOrigin(0.5, 0).setDisplaySize(this.scale.width, area2.displayHeight).setDepth(10);
            }, value => area2.label?.setText(LanguageManager.t('loading', { percent: Math.floor(value * 100) })));
            return;
        }
        if (this.assetStream || this.time.now < this.effectsReadyAt) return;
        for (const [key, area] of this.mapRegistry) {
            if (top >= area.offsetY + area.displayHeight || bottom <= area.offsetY) continue;
            if (!this.readyEffects.has(key)) {
                this.streamMapBatch(key === 'map_part1' ? 'mapEffects1' : 'mapEffects2', () => {
                    this.readyEffects.add(key);
                    if (key === 'map_part1') this.vfxManager.startMapPart1VFX();
                    else this.vfxManager.startMapPart2VFX();
                });
                return;
            }
        }
        if (!this.mapMusicStarted) {
            this.streamMapBatch('mapMusic', () => {
                this.mapMusicStarted = true;
                this.vfxManager.playBackgroundMusic('background', 0.5);
            });
        }
    }

    streamMapBatch(group, onComplete, onProgress) {
        this.streamingGroup = group;
        this.assetStream = startAssetStream(this, {
            groups: [group], onProgress,
            onComplete: () => {
                this.assetStream = null;
                this.streamingGroup = null;
                if (this.scene.isActive()) onComplete();
            }
        });
    }

}