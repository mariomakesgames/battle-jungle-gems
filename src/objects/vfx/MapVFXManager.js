// src/objects/vfx/MapVFXManager.js
import Phaser from 'phaser';
import AudioManager from '../../managers/AudioManager';

export class MapVFXManager {
    /**
     * @param {Phaser.Scene} scene
     * @param {Map<string, {image, offsetY, displayHeight}>} mapRegistry 
     */
    constructor(scene, mapRegistry) { // *** NHẬN mapRegistry ***
        /** @type {Phaser.Scene} */
        this.scene = scene;
        /** @type {Map<string, {image, offsetY, displayHeight}>} */
        this.mapRegistry = mapRegistry; // *** LƯU LẠI ***
        
        this.activeVFX = []; // Lưu trữ các đối tượng VFX đang hoạt động để dọn dẹp
        this.defaultScale = 1.0; // Scale mặc định (đã thay đổi từ 0.4 thành 1.0)
        
        // << [AUDIO SYSTEM] Lưu trữ các âm thanh đang phát để quản lý >>
        this.activeSounds = []; // Lưu các sound đang phát
        this.bgMusic = null; // Nhạc nền
        
        // << [AUDIO] Lắng nghe sự kiện thay đổi volume >>
        this.scene.game.events.on('musicVolumeChanged', this.onMusicVolumeChanged, this);
        this.scene.game.events.on('soundVolumeChanged', this.onSoundVolumeChanged, this);
    }

    /**
     * Chuyển đổi tọa độ local của map part thành tọa độ world.
     * @param {string} mapKey Key của map (ví dụ: 'map_part1')
     * @param {number} localX Tọa độ X local
     * @param {number} localY Tọa độ Y local (lấy từ bản demo với 0,0 là góc trên trái map)
     * @returns {{x: number, y: number}} Tọa độ World
     */
    getWorldCoords(mapKey, localX, localY) {
        const mapInfo = this.mapRegistry.get(mapKey);
        const offsetY = mapInfo ? mapInfo.offsetY : 0;
        
        // X hiện tại không đổi, Y = Y (Offset) + Y (Local)
        return {
            x: localX,
            y: offsetY + localY 
        };
    }

    /**
     * Tạo một animation lặp lại từ một mảng các key frame (ảnh riêng lẻ).
     * @param {number} x Tọa độ X
     * @param {number} y Tọa độ Y
     * @param {string} animKey Key duy nhất cho animation này (ví dụ: 'water_ripple_anim')
     * @param {string[]} frameKeys Mảng các key của ảnh texture dùng làm frame.
     * @param {number} frameRate Tốc độ animation (frames per second).
     * @param {object} spriteConfig Cấu hình thêm cho sprite (ví dụ: { scale: 0.5, depth: 1, angle: 0 }). Scale mặc định là this.defaultScale.
     * @returns {Phaser.GameObjects.Sprite | null} Sprite đã tạo hoặc null nếu frameKeys rỗng.
     */
    createLoopingAnimationFromFrames(x, y, animKey, frameKeys, frameRate, spriteConfig = {}) {
        if (!frameKeys || frameKeys.length === 0) {
            console.warn(`Animation key "${animKey}" received empty frameKeys.`);
            return null;
        }

        // Tạo key animation nếu chưa có
        if (!this.scene.anims.exists(animKey)) {
            // Tạo frame objects từ mảng key
            const frames = frameKeys.map(key => ({ key: key }));

            this.scene.anims.create({
                key: animKey,
                frames: frames,
                frameRate: frameRate || 10,
                repeat: -1 // Lặp vô hạn
            });
            console.log(`Created animation: ${animKey} with ${frames.length} frames.`);
        }

        // Tạo sprite và chạy animation (dùng frame đầu tiên làm texture ban đầu)
        const sprite = this.scene.add.sprite(x, y, frameKeys[0])
            .play(animKey);

        // Áp dụng cấu hình sprite
        sprite.setScale(spriteConfig.scale !== undefined ? spriteConfig.scale : this.defaultScale); // Dùng scale mặc định
        if (spriteConfig.depth !== undefined) sprite.setDepth(spriteConfig.depth);
        if (spriteConfig.alpha !== undefined) sprite.setAlpha(spriteConfig.alpha);
        if (spriteConfig.angle !== undefined) sprite.setAngle(spriteConfig.angle);
        if (spriteConfig.originX !== undefined) sprite.setOrigin(spriteConfig.originX, spriteConfig.originY !== undefined ? spriteConfig.originY : spriteConfig.originX);


        this.activeVFX.push(sprite); // Thêm vào danh sách để quản lý
        return sprite;
    }

    /**
     * Tạo hiệu ứng lấp lánh xuất hiện ngẫu nhiên trong một khu vực theo định kỳ.
     * @param {Phaser.Geom.Rectangle} area Khu vực hình chữ nhật để spawn hiệu ứng.
     * @param {string} textureKey Key của ảnh lấp lánh.
     * @param {object} timerConfig Cấu hình Timer (ví dụ: { delay: 500 }).
     * @param {object} tweenConfig Cấu hình Tween cho hiệu ứng (ví dụ: { scaleFactor: 1.5, duration: 300, alpha: 1 }). scaleFactor là hệ số nhân với scale ban đầu.
     * @param {object} spriteConfig Cấu hình sprite ban đầu (ví dụ: { initialScale: 0.1, depth: 2 }). Scale mặc định là this.defaultScale.
     */
    createPeriodicSparkle(area, textureKey, timerConfig, tweenConfig, spriteConfig = {}) {
        const initialScale = spriteConfig.initialScale !== undefined ? spriteConfig.initialScale : this.defaultScale;
        const targetScaleFactor = tweenConfig.scaleFactor !== undefined ? tweenConfig.scaleFactor : 1.5; // Scale lên gấp rưỡi

        const timer = this.scene.time.addEvent({
            delay: timerConfig.delay || 500,
            callback: () => {
                const sparkleX = Phaser.Math.Between(area.x, area.x + area.width);
                const sparkleY = Phaser.Math.Between(area.y, area.y + area.height);

                const sparkle = this.scene.add.image(sparkleX, sparkleY, textureKey)
                    .setScale(initialScale)
                    .setAlpha(0)
                    .setDepth(spriteConfig.depth !== undefined ? spriteConfig.depth : 2);

                this.scene.tweens.add({
                    targets: sparkle,
                    alpha: tweenConfig.alpha !== undefined ? tweenConfig.alpha : 1,
                    scale: initialScale * targetScaleFactor, // Scale tới giá trị đích
                    duration: tweenConfig.duration || 300,
                    yoyo: true,
                    ease: tweenConfig.ease || 'Cubic.easeOut',
                    onComplete: () => {
                        sparkle.destroy();
                    }
                });
            },
            callbackScope: this,
            loop: true
        });
        this.activeVFX.push(timer); // Lưu lại timer để có thể dừng sau này
    }

    /**
     * Tạo và trả về một Particle Emitter.
     * @param {number} x Tọa độ X của emitter (hoặc dùng trong config).
     * @param {number} y Tọa độ Y của emitter (hoặc dùng trong config).
     * @param {string} textureKey Key của particle texture.
     * @param {Phaser.Types.GameObjects.Particles.ParticleEmitterConfig} config Cấu hình chi tiết cho emitter.
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} Emitter đã tạo.
     */
    createParticleEmitter(x, y, textureKey, config) {
        // Áp dụng scale mặc định cho particle nếu chưa có
         if (config.scale === undefined) {
             config.scale = this.defaultScale;
         } else if (typeof config.scale === 'object' && config.scale !== null) {
             // Nếu là object {start, end}, áp dụng scale mặc định cho cả hai nếu chưa có
             if (config.scale.start === undefined) config.scale.start = this.defaultScale;
             if (config.scale.end === undefined) config.scale.end = this.defaultScale;
         }


        const emitter = this.scene.add.particles(x, y, textureKey, config);
        if (config.depth !== undefined) {
             emitter.setDepth(config.depth);
        }
        this.activeVFX.push(emitter); // Lưu lại emitter
        return emitter;
    }

    // --- HÀM TẠO 1 HIỆU ỨNG TĨNH (hoặc có tween đơn giản) ---
    /**
     * Tạo một ảnh tĩnh hoặc ảnh có tween đơn giản (ví dụ: alpha, vị trí)
     * @param {number} x
     * @param {number} y
     * @param {string} textureKey
     * @param {object} spriteConfig Cấu hình sprite { scale, depth, alpha, angle, originX, originY }
     * @param {object | null} tweenConfig Cấu hình tween (optional). Ví dụ: { props: { alpha: 0.5 }, duration: 1000, yoyo: true, repeat: -1 }
     */
    createStaticOrTweenedImage(x, y, textureKey, spriteConfig = {}, tweenConfig = null) {
        const image = this.scene.add.image(x, y, textureKey);

        // Apply sprite config
        image.setScale(spriteConfig.scale !== undefined ? spriteConfig.scale : this.defaultScale);
        if (spriteConfig.depth !== undefined) image.setDepth(spriteConfig.depth);
        if (spriteConfig.alpha !== undefined) image.setAlpha(spriteConfig.alpha);
        if (spriteConfig.angle !== undefined) image.setAngle(spriteConfig.angle);
        if (spriteConfig.originX !== undefined) image.setOrigin(spriteConfig.originX, spriteConfig.originY !== undefined ? spriteConfig.originY : spriteConfig.originX);

        this.activeVFX.push(image);

        // Apply tween if provided
        if (tweenConfig) {
            // THÊM DELAY NGẪU NHIÊN NHỎ ĐỂ TRÁNH GPU QUÁ TẢI (giảm từ 800ms xuống 100ms)
            const randomDelay = tweenConfig.delay !== undefined 
                ? tweenConfig.delay 
                : Phaser.Math.Between(0, 100); // Delay ngẫu nhiên 0-100ms (giảm xuống)
            
            const tween = this.scene.tweens.add({
                targets: image,
                ...tweenConfig.props, // e.g., alpha: 0.5, y: '+=10'
                duration: tweenConfig.duration || 1000,
                ease: tweenConfig.ease || 'Linear',
                yoyo: tweenConfig.yoyo !== undefined ? tweenConfig.yoyo : false,
                repeat: tweenConfig.repeat !== undefined ? tweenConfig.repeat : 0,
                delay: randomDelay
            });
            // Lưu tween để dừng nếu cần, mặc dù image đã được lưu
            this.activeVFX.push(tween);
        }

        return image;
    }

    /**
     * Tạo hiệu ứng thác nước chảy với base và các lớp animation đè lên
     * @param {string} mapKey Key của map (ví dụ: 'map_part2')
     * @param {number} localX Tọa độ X local
     * @param {number} localY Tọa độ Y local
     * @param {object} config Cấu hình { baseDepth: 5, effectDepth: 6, frameRate: 4 }
     * @returns {Array} Mảng chứa base image, animation sprite và frame 5 sprite
     */
    createWaterfallEffect(mapKey, localX, localY, config = {}) {
        const baseDepth = config.baseDepth !== undefined ? config.baseDepth : 5;
        const effectDepth = config.effectDepth !== undefined ? config.effectDepth : 6;
        const frameRate = config.frameRate !== undefined ? config.frameRate : 4;
        const scale = config.scale !== undefined ? config.scale : this.defaultScale;

        // Chuyển đổi tọa độ local sang world
        const coords = this.getWorldCoords(mapKey, localX, localY);

        // 1. Tạo base (luôn tồn tại, nền dưới)
        const baseImage = this.createStaticOrTweenedImage(
            coords.x, coords.y,
            'map_part2_steam_base',
            { depth: baseDepth, scale: scale }
        );

        // 2. Tạo animation từ các frame 0-4 (flow liên tục) đè lên base
        const animKey = `waterfall_flow_${mapKey}_${localX}_${localY}`;
        const sprite = this.createLoopingAnimationFromFrames(
            coords.x, coords.y,
            animKey,
            [
                'map_part2_steam_0',
                'map_part2_steam_1',
                'map_part2_steam_2',
                'map_part2_steam_3',
                'map_part2_steam_4'
            ],
            frameRate,
            { depth: effectDepth, scale: scale }
        );

        // 3. Tạo sprite riêng cho frame 5 (Nuoc chay 4) - tắt mở xen kẽ theo từng frame
        // Tính thời gian mỗi frame dựa trên frameRate
        const frameDuration = 3000 / frameRate; // ms per frame
        const frame5Sprite = this.scene.add.image(coords.x, coords.y, 'map_part2_steam_5')
            .setScale(scale)
            .setDepth(effectDepth + 1) // Đè lên animation chính
            .setAlpha(0); // Bắt đầu ẩn

        // Tween alpha để tắt mở xen kẽ - hiện/ẩn theo từng frame (tắt mở xen kẽ)
        const frame5Tween = this.scene.tweens.add({
            targets: frame5Sprite,
            alpha: 1, // Từ 0 lên 1
            duration: frameDuration,
            ease: 'Linear',
            yoyo: true, // Quay lại từ 1 xuống 0
            repeat: -1 // Lặp vô hạn
        });

        this.activeVFX.push(frame5Sprite); // Thêm vào danh sách quản lý
        this.activeVFX.push(frame5Tween); // Thêm tween vào danh sách quản lý

        console.log(`Created waterfall effect at World(${coords.x}, ${coords.y}) with scale ${scale}`);
        return [baseImage, sprite, frame5Sprite];
    }

    /**
     * Tạo hiệu ứng cá nhảy (cặp ảnh: cá + splash xuất hiện cùng lúc)
     * variant 1-3: dùng {n.1 (cá)}, {n.2 (splash)}
     * variant 4: dùng 4.1 (cá) và 4.2-4.4 (splash nối tiếp)
     */
    createFishJumpEffect(mapKey, localX, localY, variant = 1, config = {}) {
        const depth = config.depth !== undefined ? config.depth : 12;
        const scale = config.scale !== undefined ? config.scale : this.defaultScale;
        const duration = config.duration !== undefined ? config.duration : 900; // tổng thời gian nhảy

        const coords = this.getWorldCoords(mapKey, localX, localY);

        // Key ảnh theo variant
        const fishKey = variant === 4 ? 'map_part2_fish_4_1' : `map_part2_fish_${variant}_1`;
        const splashKeys = variant === 4
            ? ['map_part2_fish_4_2', 'map_part2_fish_4_3', 'map_part2_fish_4_4']
            : [`map_part2_fish_${variant}_2`];

        // Cá (chỉ hiển thị ảnh, không tween/di chuyển)
        const fish = this.scene.add.image(coords.x, coords.y, fishKey)
            .setScale(scale)
            .setDepth(depth + 1)
            .setAlpha(1);

        this.activeVFX.push(fish);

        // Splash cùng vị trí. Variant 1-3: 1 frame; Variant 4: 3 frame tuần tự
        let splash;
        if (variant === 4) {
            splash = this.scene.add.image(coords.x, coords.y, splashKeys[0])
                .setScale(scale)
                .setDepth(depth)
                .setAlpha(1);
            this.activeVFX.push(splash);

            // Thay texture tuần tự 4.2 -> 4.3 -> 4.4
            const step = Math.max(60, Math.floor(duration / splashKeys.length));
            let idx = 0;
            const seq = this.scene.time.addEvent({
                delay: step,
                repeat: splashKeys.length - 1,
                callback: () => {
                    idx = Math.min(idx + 1, splashKeys.length - 1);
                    splash.setTexture(splashKeys[idx]);
                },
                callbackScope: this,
                onComplete: () => {
                    // Tự hủy nhẹ nhàng
                    splash.destroy();
                    fish.destroy();
                }
            });
            this.activeVFX.push(seq);
        } else {
            splash = this.scene.add.image(coords.x, coords.y, splashKeys[0])
                .setScale(scale)
                .setDepth(depth)
                .setAlpha(1);
            this.activeVFX.push(splash);

            // Tự hủy sau duration, không tween
            const t = this.scene.time.addEvent({
                delay: duration,
                callback: () => {
                    splash.destroy();
                    fish.destroy();
                }
            });
            this.activeVFX.push(t);
        }

        return { fish, splash };
    }

    /**
     * Phát toàn bộ hoạt ảnh cá: 1 -> 2 -> 3 -> 4 theo thứ tự.
     * Mỗi bước chỉ thay texture: (n.1 cá + n.2 splash), riêng bước 4: (4.1 cá + 4.2->4.4 splash).
     */
    createFishJumpSequence(mapKey, localX, localY, config = {}) {
        const depth = config.depth !== undefined ? config.depth : 12;
        const scale = config.scale !== undefined ? config.scale : this.defaultScale;
        const step = config.step !== undefined ? config.step : 140; // ms mỗi bước

        // 1) Lưu tọa độ world gốc
        const coords = this.getWorldCoords(mapKey, localX, localY);

        // 2) Hai sprite cố định, sẽ thay texture và đặt lại vị trí mỗi frame
        const fish = this.scene.add.image(coords.x, coords.y, 'map_part2_fish_1_1')
            .setScale(scale).setDepth(depth + 1).setAlpha(1);
        const splash = this.scene.add.image(coords.x, coords.y, 'map_part2_fish_1_2')
            .setScale(scale).setDepth(depth).setAlpha(1);

        this.activeVFX.push(fish);
        this.activeVFX.push(splash);

        // 3) Chuỗi frame (f: fish texture, s: splash texture, fx/fy/sx/sy: offset)
        const sequence = [
            { f: 'map_part2_fish_1_1', s: 'map_part2_fish_1_2', fx: 0,  fy: 0},
            { f: 'map_part2_fish_2_1', s: 'map_part2_fish_2_2', fx: 0,  fy: 0},
            { f: 'map_part2_fish_3_1', s: 'map_part2_fish_3_2', fx: 15, fy: -30},
            { f: 'map_part2_fish_4_1', s: 'map_part2_fish_4_2', fx: 20, fy: -25 },
            { f: 'map_part2_fish_4_1', s: 'map_part2_fish_4_3', fx: 25, fy: -20 },
            { f: 'map_part2_fish_4_1', s: 'map_part2_fish_4_4', fx: 30, fy: -15}
        ];

        let idx = 0;
        const timer = this.scene.time.addEvent({
            delay: step,
            loop: true,
            callback: () => {
                const frame = sequence[idx];
                // 4) Cập nhật TEXTURE + POSITION theo offset từng frame
                fish.setTexture(frame.f);
                fish.setPosition(coords.x + frame.fx, coords.y + frame.fy);

                splash.setTexture(frame.s);
                splash.setPosition(coords.x + frame.fx, coords.y + frame.fy);

                // << [AUDIO] Phát âm thanh water-drop 2 lần: frame đầu và frame cuối >>
                if (idx === 0 || idx === sequence.length - 1) {
                    this.playSound('water-drop', 0.25); // water-drop.m4a - giảm volume
                }

                idx++;
                if (idx >= sequence.length) {
                    timer.remove();
                    fish.destroy();
                    splash.destroy();
                }
            }
        });

        this.activeVFX.push(timer);
        return { fish, splash, timer };
    }


    // ---------------------------------------------------
    // --- HÀM TRUNG TÂM ĐỂ KHỞI TẠO VFX CHO TẤT CẢ MAP ---
    // ---------------------------------------------------
    // ---------------------------------------------------
    // --- HỆ THỐNG ÂM THANH ---
    // ---------------------------------------------------
    
    /**
     * Phát nhạc nền (background music) với fade in
     * @param {string} soundKey Key của file âm thanh (ví dụ: 'background')
     * @param {number} baseVolume Âm lượng cơ bản (sẽ nhân với musicVolume từ AudioManager)
     */
    playBackgroundMusic(soundKey, baseVolume = 1.0) {
        // Dừng nhạc nền cũ nếu đang phát
        if (this.bgMusic) {
            this.bgMusic.stop();
            this.bgMusic = null;
        }
        
        // Kiểm tra xem sound có tồn tại không
        if (!this.scene.cache.audio.exists(soundKey)) {
            console.warn(`Audio "${soundKey}" not found in cache`);
            return;
        }
        
        // << [AUDIO] Lấy volume từ AudioManager >>
        const targetVolume = baseVolume * AudioManager.getMusicVolume();
        
        // Phát nhạc nền mới với fade in
        this.bgMusic = this.scene.sound.add(soundKey, {
            loop: true,
            volume: 0 // Bắt đầu từ 0 để fade in
        });
        this.bgMusic.play();
        
        // Lưu baseVolume để tính lại khi thay đổi volume
        this.bgMusic.baseVolume = baseVolume;
        
        // Fade in dần lên âm lượng mong muốn
        this.scene.tweens.add({
            targets: this.bgMusic,
            volume: targetVolume,
            duration: 2000,
            ease: 'Linear'
        });
        
        console.log(`🎵 Playing background music: ${soundKey} (volume: ${targetVolume})`);
    }
    
    /**
     * Phát âm thanh định kỳ theo chu kỳ
     * @param {string} soundKey Key của file âm thanh
     * @param {number} interval Chu kỳ phát (ms)
     * @param {number} baseVolume Âm lượng cơ bản (sẽ nhân với soundVolume từ AudioManager)
     * @returns {Phaser.Time.TimerEvent} Timer event
     */
    playPeriodicSound(soundKey, interval, baseVolume = 1.0) {
        const timer = this.scene.time.addEvent({
            delay: interval,
            loop: true,
            callback: () => {
                if (this.scene.cache.audio.exists(soundKey)) {
                    // << [AUDIO] Lấy volume từ AudioManager >>
                    const volume = baseVolume * AudioManager.getSoundVolume();
                    const sound = this.scene.sound.add(soundKey, { volume });
                    sound.play();
                    // Âm thanh sẽ tự động destroy sau khi phát xong
                    sound.once('complete', () => {
                        sound.destroy();
                    });
                }
            },
            callbackScope: this
        });
        
        this.activeVFX.push(timer);
        return timer;
    }
    
    /**
     * Phát âm thanh loop liên tục (ambient sound)
     * @param {string} soundKey Key của file âm thanh
     * @param {number} baseVolume Âm lượng cơ bản (sẽ nhân với soundVolume từ AudioManager)
     * @returns {Phaser.Sound.BaseSound} Sound object
     */
    playLoopingSound(soundKey, baseVolume = 1.0) {
        // Kiểm tra xem sound có tồn tại không
        if (!this.scene.cache.audio.exists(soundKey)) {
            console.warn(`Audio "${soundKey}" not found in cache`);
            return null;
        }
        
        // << [AUDIO] Lấy volume từ AudioManager >>
        const volume = baseVolume * AudioManager.getSoundVolume();
        
        // Phát âm thanh loop liên tục
        const sound = this.scene.sound.add(soundKey, {
            loop: true,
            volume: volume
        });
        sound.play();
        
        // Lưu baseVolume để tính lại khi thay đổi volume
        sound.baseVolume = baseVolume;
        
        // Lưu lại để quản lý
        this.activeSounds.push(sound);
        return sound;
    }
    
    /**
     * Phát âm thanh một lần
     * @param {string} soundKey Key của file âm thanh
     * @param {number} baseVolume Âm lượng cơ bản (sẽ nhân với soundVolume từ AudioManager)
     * @param {number} delay Delay trước khi phát (ms)
     */
    playSound(soundKey, baseVolume = 1.0, delay = 0) {
        if (!this.scene.cache.audio.exists(soundKey)) {
            console.warn(`Audio "${soundKey}" not found in cache`);
            return;
        }
        
        // << [AUDIO] Lấy volume từ AudioManager >>
        const volume = baseVolume * AudioManager.getSoundVolume();
        
        if (delay > 0) {
            this.scene.time.delayedCall(delay, () => {
                const sound = this.scene.sound.add(soundKey, { volume });
                sound.play();
                sound.once('complete', () => {
                    sound.destroy();
                });
            });
        } else {
            const sound = this.scene.sound.add(soundKey, { volume });
            sound.play();
            sound.once('complete', () => {
                sound.destroy();
            });
        }
    }

    /**
     * Khởi tạo VFX cho tất cả các map parts đã đăng ký - LOAD NGAY LẬP TỨC.
     */
    /**
     * << [AUDIO] Callback khi music volume thay đổi >>
     */
    onMusicVolumeChanged(newVolume) {
        if (this.bgMusic && this.bgMusic.isPlaying) {
            const baseVolume = this.bgMusic.baseVolume || 1.0;
            this.bgMusic.setVolume(baseVolume * newVolume);
            console.log(`🎵 Music volume updated: ${baseVolume * newVolume}`);
        }
    }
    
    /**
     * << [AUDIO] Callback khi sound volume thay đổi >>
     */
    onSoundVolumeChanged(newVolume) {
        // Cập nhật volume cho tất cả sound effects đang loop
        this.activeSounds.forEach(sound => {
            if (sound && sound.isPlaying) {
                const baseVolume = sound.baseVolume || 1.0;
                sound.setVolume(baseVolume * newVolume);
            }
        });
        console.log(`🔊 Sound effects volume updated: ${newVolume}`);
    }

    startAllMapVFX() {
        console.log("Starting All Map VFX (immediate load)...");
        
        // << [AUDIO] Phát nhạc nền >>
        this.playBackgroundMusic('background', 0.5); // background.ogg - baseVolume 0.5 (tăng lên để đủ nghe)
        
        // Load Map Part 2 ngay lập tức
        if (this.mapRegistry.has('map_part2')) {
            console.log("Loading Map Part 2 VFX...");
            this.startMapPart2VFX();
        }
        
        // Load Map Part 1 ngay sau đó (không delay)
        if (this.mapRegistry.has('map_part1')) {
            console.log("Loading Map Part 1 VFX...");
            this.startMapPart1VFX();
        }
        
        // Thêm: if (this.mapRegistry.has('map_part3')) { this.startMapPart3VFX(); }
    }

    // ---------------------------------------------------
    // --- HÀM VFX CHO MAP_PART1 (Tách ra từ hàm cũ) ---
    // ---------------------------------------------------
    startMapPart1VFX() {
        console.log("Starting Map Part 1 VFX...");
        const mapKey = 'map_part1'; // Chỉ định map key
        const { width, height } = this.scene.scale;

        // --- Tọa độ LOCAL (Lấy từ demo, 0,0 là góc trên trái của map_part1) ---
        const waterfallPos = { x: 120, y: 635 };
        const waterfallTopPos = { x: 115, y: 635 };
        const waterfallMidPos = { x: 128, y: 680 };
        const waterfallBasePos = { x: 115, y: 635 };
        const waterSurfacePos1 = { x: 115, y: 635 };
        const waterSurfacePos2 = { x: 115, y: 635 };
        const decanterSpoutPos = { x: 445, y: 622 };
        const decanterBasePos = { x: 445, y: 622 };
        const bambooPos = { x: 100, y: -22};
        const bananaTreePos = { x: width * 0.15, y: height * 1 };

        // --- Nhóm VFX Thác nước (Steam) ---

        // 1. Animation bọt nước bắn lên (4 frames)
        let coords = this.getWorldCoords(mapKey, waterfallBasePos.x, waterfallBasePos.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_water_bubbles', // Key animation
            [
                'vfx_steam_1_1_bot_nuoc',
                'vfx_steam_1_2_bot_nuoc',
                'vfx_steam_1_3_bot_nuoc',
                'vfx_steam_1_4_bot_nuoc'
            ],
            4, // Frame rate - chậm hơn
            { depth: 3 } // Cấu hình sprite
        );

        // 2. Animation mặt nước loang (vùng 1 - 4 frames)
        coords = this.getWorldCoords(mapKey, waterSurfacePos1.x, waterSurfacePos1.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_water_ripple_1',
            [
                'vfx_steam_10_mat_nuoc_loang_1',
                'vfx_steam_11_mat_nuoc_loang_1',
                'vfx_steam_mat_nuoc_loang_2', // Frame 12
                'vfx_steam_13_mat_nuoc_loang_3'
            ],
            3, // Chậm hơn
            { depth: 1 }
        );

        // 3. Animation mặt nước loang (vùng 2 - dùng frame 13 & 14)
        coords = this.getWorldCoords(mapKey, waterSurfacePos2.x, waterSurfacePos2.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_water_ripple_2',
            [
                'vfx_steam_13_mat_nuoc_loang_3',
                'vfx_steam_mat_nuoc_loang_4' // Frame 14
            ],
            2, // Chậm hơn
            { depth: 1, alpha: 0.8 } // Hơi mờ hơn
        );


        // 4. Animation nước chảy chân thác (2 frames)
        coords = this.getWorldCoords(mapKey, waterfallBasePos.x, waterfallBasePos.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_base_flow',
            [
                'vfx_steam_15_nuoc_chay_chan_thac',
                'vfx_steam_16_nuoc_chay_chan_thac'
            ],
            2, // Chậm hơn
            { depth: 2 }
        );

        // 5. Nước loang chân thác (ảnh tĩnh) - Có thể thêm tween alpha nhẹ
        coords = this.getWorldCoords(mapKey, waterfallBasePos.x, waterfallBasePos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_steam_17_nuoc_loang_chan_thac',
            { depth: 1, alpha: 0.7 },
            { props: { alpha: 0.9 }, duration: 4500, yoyo: true, repeat: -1 } // Tween alpha
        );

        // 6. Animation nước đầu ngọn thác (2 frames)
        coords = this.getWorldCoords(mapKey, waterfallTopPos.x, waterfallTopPos.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_top_flow',
            [
                'vfx_steam_3_nuoc_dau_ngon_thac',
                'vfx_steam_4_nuoc_dau_ngon_thac'
            ],
            3, // Chậm hơn
            { depth: 2 }
        );

        // 7. Giọt nước rơi từ ngọn thác (ảnh tĩnh) - Dùng Particle Emitter sẽ đẹp hơn
        // Tạm thời tạo ảnh tĩnh
        // this.createStaticOrTweenedImage(
        //     waterfallTopPos.x + 5, waterfallTopPos.y + 10,
        //     'vfx_steam_5_giot_nuoc_ngon_thac',
        //     { depth: 3 }
        // );
        // >> Thay bằng Particle Emitter cho giọt nước rơi <<
        //  this.createParticleEmitter(
        //     waterfallTopPos.x, waterfallTopPos.y, // Vị trí spawn
        //     'vfx_steam_5_giot_nuoc_ngon_thac', // Dùng ảnh giọt nước làm particle
        //     {
        //         lifespan: 800,
        //         speedY: { min: 80, max: 120 }, // Rơi xuống
        //         gravityY: 100, // Có trọng lực
        //         scale: { start: this.defaultScale, end: this.defaultScale * 0.8 }, // Nhỏ dần chút
        //         alpha: { start: 1, end: 0.5 },
        //         frequency: 300, // Tần suất rơi
        //         quantity: 1,
        //         depth: 3
        //     }
        // );


        // 8. Animation nước chảy giữa thác (4 frames)
        coords = this.getWorldCoords(mapKey, waterfallMidPos.x, waterfallMidPos.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'steam_mid_flow',
            [
                'vfx_steam_6_nuoc_chay_giua_ngon_thac',
                'vfx_steam_7_nuoc_chay_giua_angon_thac', // Chú ý tên file có thể sai chính tả
                'vfx_steam_8_nuoc_chay_giua_ngon_thac',
                'vfx_steam_9_nuoc_chay_giua_ngon_thac'
            ],
            3, // Chậm hơn
            { depth: 2 }
        );

        // 9. Ảnh tĩnh thác nước chính (có thể là phần nền)
        coords = this.getWorldCoords(mapKey, waterfallMidPos.x, waterfallMidPos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_steam_thac_nuoc',
            { depth: 0 } // Nằm dưới cùng
        );

        // --- Thêm props bổ sung trong khu vực thác nước (steam) ---
        // Bạn có thể tự chỉnh lại tọa độ dưới đây cho phù hợp
        let extra = this.getWorldCoords(mapKey, 125, 587);
        this.createStaticOrTweenedImage(
            extra.x, extra.y,
            'steam_cay_chuoi1',
            { 
                depth: 2,
                originX: 0.5,
                originY: 1.0
            },
            {
                props: { angle: 3 },
                duration: 2500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }
        );

        extra = this.getWorldCoords(mapKey, 70, 727);
        this.createStaticOrTweenedImage(
            extra.x, extra.y,
            'steam_cay_chuoi2',
            { 
                depth: 2,
                originX: 0.5,
                originY: 1.0
            },
            {
                props: { angle: -4 },
                duration: 3100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            }
        );

        extra = this.getWorldCoords(mapKey, 173, 702);
        this.createStaticOrTweenedImage(
            extra.x, extra.y,
            'steam_coc_go',
            { depth: 3 }
        );

        // 10. 4 giọt nước văng ra ngẫu nhiên quanh khu vực thác nước
        const steamDropletTextures = [
            'vfx_decanter_giot_nuoc_1',
            'vfx_decanter_giot_nuoc_2', 
            'vfx_decanter_giot_nuoc_3',
            'vfx_decanter_giot_nuoc_4'
        ];

        // Tạo timer để spawn giọt nước thác định kỳ
        const steamDropletTimer = this.scene.time.addEvent({
            delay: 800, // Spawn mỗi 800ms
            callback: () => {
                // Chọn ngẫu nhiên 1 trong 4 loại giọt nước
                const randomTexture = Phaser.Utils.Array.GetRandom(steamDropletTextures);
                
                // *** Quan trọng: Tính tọa độ World cho tâm văng ***
                const worldBasePos = this.getWorldCoords(mapKey, waterfallBasePos.x, waterfallBasePos.y);
                
                // Vị trí ngẫu nhiên quanh thác nước (trong vòng tròn bán kính 40px)
                const angle = Phaser.Math.Between(0, 360) * Math.PI / 180;
                const distance = Phaser.Math.Between(20, 100);
                const dropletX = worldBasePos.x + Math.cos(angle) * distance;
                const dropletY = worldBasePos.y + Math.sin(angle) * distance;

                // Tính hướng di chuyển từ tâm thác nước ra ngoài
                const deltaX = dropletX - worldBasePos.x; // Khoảng cách ngang từ tâm
                const deltaY = dropletY - worldBasePos.y; // Khoảng cách dọc từ tâm
                
                // Tính hướng di chuyển (bên phải chạy qua phải, bên trái chạy qua trái)
                const moveDirectionX = deltaX > 0 ? 1 : -1; // 1 = phải, -1 = trái
                const moveDistanceX = Math.abs(deltaX) * 0.5; // Di chuyển theo hướng với khoảng cách tương ứng
                const moveDistanceY = Phaser.Math.Between(30, 50); // Luôn rơi xuống

                // Tạo giọt nước
                const droplet = this.scene.add.image(dropletX, dropletY, randomTexture)
                    .setScale(this.defaultScale * Phaser.Math.Between(0.8, 2))
                    .setAlpha(0.8)
                    .setDepth(4);

                // Animation cho giọt nước: di chuyển theo hướng từ tâm ra ngoài
                this.scene.tweens.add({
                    targets: droplet,
                    x: dropletX + (moveDirectionX * moveDistanceX), // Tọa độ World
                    y: dropletY + moveDistanceY, // Tọa độ World
                    alpha: 0,
                    scale: this.defaultScale * 0.3, // Thu nhỏ dần
                    duration: Phaser.Math.Between(800, 1200), // Thời gian ngẫu nhiên
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        droplet.destroy(); // Xóa giọt nước sau khi animation xong
                    }
                });

                this.activeVFX.push(droplet); // Thêm vào danh sách quản lý
            },
            callbackScope: this,
            loop: true
        });

        this.activeVFX.push(steamDropletTimer); // Lưu timer để có thể dừng sau này

        // << [AUDIO] Âm thanh thác nước - chạy liên tục với volume nhỏ >>
        this.playLoopingSound('stream', 0.08); // volume 0.08 (giảm xuống)

        // --- Nhóm VFX Bình rót nước (Decanter) ---

        // 1. Ảnh tĩnh dòng nước chính
        coords = this.getWorldCoords(mapKey, decanterBasePos.x, decanterBasePos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_decanter_dong_nuoc_chinh',
            { depth: 2 }
        );

        // 1.5. Nước chảy 1 với opacity tăng giảm
        coords = this.getWorldCoords(mapKey, decanterBasePos.x, decanterBasePos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_decanter_nuoc_chay_1',
            { depth: 2.5, alpha: 0.3 }, // Bắt đầu với alpha thấp
            { props: { alpha: 1 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Tween alpha
        );

        // 2. Animation nước chảy từ miệng bình (4 frames)
        coords = this.getWorldCoords(mapKey, decanterSpoutPos.x, decanterSpoutPos.y);
        this.createLoopingAnimationFromFrames(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'decanter_spout_flow',
            [
                'vfx_decanter_nuoc_chay_2',
                'vfx_decanter_nuoc_chay_3',
                'vfx_decanter_nuoc_chay_4'
            ],
            6, // Chậm hơn
            { depth: 3 }
        );

        // 3. 4 giọt nước văng ra ngẫu nhiên quanh khu vực bình nước
        const dropletTextures = [
            'vfx_decanter_giot_nuoc_1',
            'vfx_decanter_giot_nuoc_2', 
            'vfx_decanter_giot_nuoc_3',
            'vfx_decanter_giot_nuoc_4'
        ];

        // Tạo timer để spawn giọt nước định kỳ
        const dropletTimer = this.scene.time.addEvent({
            delay: 800, // Spawn mỗi 800ms
            callback: () => {
                // Chọn ngẫu nhiên 1 trong 4 loại giọt nước
                const randomTexture = Phaser.Utils.Array.GetRandom(dropletTextures);
                
                // *** Quan trọng: Tính tọa độ World cho tâm văng ***
                const worldBasePos = this.getWorldCoords(mapKey, decanterBasePos.x, decanterBasePos.y);
                
                // Vị trí ngẫu nhiên quanh bình nước (trong vòng tròn bán kính 40px)
                const angle = Phaser.Math.Between(0, 360) * Math.PI / 180;
                const distance = Phaser.Math.Between(20, 40);
                const dropletX = worldBasePos.x + Math.cos(angle) * distance;
                const dropletY = worldBasePos.y + Math.sin(angle) * distance;

                // Tính hướng di chuyển từ tâm bình nước ra ngoài
                const deltaX = dropletX - worldBasePos.x; // Khoảng cách ngang từ tâm
                const deltaY = dropletY - worldBasePos.y; // Khoảng cách dọc từ tâm
                
                // Tính hướng di chuyển (bên phải chạy qua phải, bên trái chạy qua trái)
                const moveDirectionX = deltaX > 0 ? 1 : -1; // 1 = phải, -1 = trái
                const moveDistanceX = Math.abs(deltaX) * 0.5; // Di chuyển theo hướng với khoảng cách tương ứng
                const moveDistanceY = Phaser.Math.Between(30, 50); // Luôn rơi xuống

                // Tạo giọt nước
                const droplet = this.scene.add.image(dropletX, dropletY, randomTexture)
                    .setScale(this.defaultScale * 1)
                    .setAlpha(0.8)
                    .setDepth(4);

                // Animation cho giọt nước: di chuyển theo hướng từ tâm ra ngoài
                this.scene.tweens.add({
                    targets: droplet,
                    x: dropletX + (moveDirectionX * moveDistanceX), // Tọa độ World
                    y: dropletY + moveDistanceY, // Tọa độ World
                    alpha: 0,
                    scale: this.defaultScale * 0.3, // Thu nhỏ dần
                    duration: Phaser.Math.Between(800, 1200), // Thời gian ngẫu nhiên
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        droplet.destroy(); // Xóa giọt nước sau khi animation xong
                    }
                });

                this.activeVFX.push(droplet); // Thêm vào danh sách quản lý
            },
            callbackScope: this,
            loop: true
        });

        this.activeVFX.push(dropletTimer); // Lưu timer để có thể dừng sau này


        // --- Nhóm VFX Tre (Bamboo) ---

        // 1. Ảnh tĩnh cây tre (nền)
        coords = this.getWorldCoords(mapKey, bambooPos.x, bambooPos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_bambo_cay_tre',
            { depth: 3, originX: 0.5, originY: 0}, // Đặt origin lên trên để xoay đúng
            { props: { angle: 1 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Tween góc quay
        );

        // 2. Ảnh tĩnh mặt sau trống (nền)
        coords = this.getWorldCoords(mapKey, 93, 323); // Chỉnh vị trí
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_bambo_mat_sau_quai_trong_dong',
            { depth: 2 }
        );

        // 3. Ảnh trống đung đưa nhẹ (tween angle)
        coords = this.getWorldCoords(mapKey, 90, 347); // Chỉnh vị trí
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_bambo_quai_trong_dong_1',
            { depth: 4 }
        );
        
        coords = this.getWorldCoords(mapKey, 90, 347); // Chỉnh vị trí
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_bambo_quai_trong_dong_2',
            { depth: 1 }
        );


        // --- Nhóm VFX Chuối (Banana) ---

        // 1. Cây chuối lắc lư nhẹ (tween angle) - LAYER TRÊN
        coords = this.getWorldCoords(mapKey, bananaTreePos.x, bananaTreePos.y);
        const treeSprite = this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_banana_cay_chuoi',
            { depth: 2, originX: 0.5, originY: 0.9 }, // Đặt origin ở gốc cây
            { props: { angle: 5 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Lắc lư rõ hơn
        );

        // 2. Buồng chuối - vừa theo cây vừa lắc lư riêng - LAYER DƯỚI
        coords = this.getWorldCoords(mapKey, bananaTreePos.x + 30, bananaTreePos.y - 130); // Lệch lên trên bên phải
        const fruitSprite = this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'vfx_banana_buong_chuoi',
            { depth: 1, originX: 0.5, originY: 0 }, // Đặt origin lên trên
            null // Không tween ngay, sẽ tạo riêng
        );

        // Tạo tween cho quả chuối: vừa theo cây vừa lắc lư riêng
        if (fruitSprite) {
            // Tween theo chuyển động của cây (cùng góc và thời gian)
            this.scene.tweens.add({
                targets: fruitSprite,
                angle: 5, // Cùng góc với cây
                duration: 2500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Tween lắc lư riêng của quả (góc nhỏ hơn, nhanh hơn)
            this.scene.tweens.add({
                targets: fruitSprite,
                angle: '+=3', // Lắc lư thêm ±3 độ
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: 200 // Lệch pha một chút
            });
        }


        // --- Các hiệu ứng dùng hàm cũ (nếu muốn giữ lại) ---
        // Ví dụ: Hiệu ứng lấp lánh và nút "thở"
        const level3Area = new Phaser.Geom.Rectangle(width * 0.4, height * 0.45, width * 0.2, height * 0.1);
        // Tạm thời comment vì texture 'sparkle' chưa được load
        // this.createPeriodicSparkle(
        //      level3Area,
        //     'sparkle', // Texture đã load ở Preloader
        //      { delay: 700 },
        //      { scaleFactor: 1.5, duration: 400 }, // Dùng scaleFactor
        //      { initialScale: this.defaultScale * 0.5, depth: 3 } // initialScale nhỏ hơn
        //  );

        const levelButtons = this.scene.children.list.filter(child => child.type === 'Rectangle' && child.isFilled);
        levelButtons.forEach((button, index) => {
             const tween = this.scene.tweens.add({
                 targets: button,
                 scaleX: 1.05,
                 scaleY: 1.05,
                 duration: 800,
                 yoyo: true,
                 repeat: -1,
                 ease: 'Sine.easeInOut',
                 delay: index * 200
             });
             this.activeVFX.push(tween);
         });

         const title = this.scene.children.list.find(child => child.type === 'Text' && child.text === 'Chọn Map');
         if (title) {
            const tween = this.scene.tweens.add({
                 targets: title,
                 y: title.y - 10,
                 duration: 2000,
                 yoyo: true,
                 repeat: -1,
                 ease: 'Sine.easeInOut'
             });
             this.activeVFX.push(tween);
         }

        // << [AUDIO] Tiếng khỉ - phát định kỳ mỗi 12 giây >>
        this.playPeriodicSound('monkey', 12000, 0.15); // monkey.mp3 - volume 0.15 (giảm xuống)

        console.log(`Created ${this.activeVFX.length} VFX elements/timers/tweens for Map Part 1.`);
    }

    // ---------------------------------------------------
    // --- HÀM MỚI CHO MAP_PART2 ---
    // ---------------------------------------------------
    startMapPart2VFX() {
        console.log("Starting Map Part 2 VFX...");
        const mapKey = 'map_part2'; // Chỉ định map key
        const { width, height } = this.scene.scale;

        // --- Tọa độ LOCAL (Lấy từ demo, 0,0 là góc trên trái của map_part2) ---
        const cayChuoiPos = { x: 600, y: 950 };
        const chumBapPos = { x: 200, y: 650 };
        const laCayPos = { x: 590, y: 135 };
        const waterfallPos = { x: 243, y: 270 };
        const fishPos = { x: 230, y: 960 }; // Vị trí thác nước

        // --- Nhóm VFX Cây cối (Vegetation) ---

        // 1. Cây chuối lắc lư nhẹ (tween angle)
        let coords = this.getWorldCoords(mapKey, cayChuoiPos.x, cayChuoiPos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'map_part2_cay_chuoi',
            { depth: 12, originX: 1.0, originY: 0.5 }, // Đặt origin ở mép phải
            { props: { angle: 3 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Lắc lư
        );

        // 2. Chùm bắp lắc lư như quả treo (tween angle)
        coords = this.getWorldCoords(mapKey, chumBapPos.x, chumBapPos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'map_part2_chum_bap',
            { depth: 12, originX: 0.5, originY: 0 }, // Đặt origin ở trên cùng để xoay đúng
            { props: { angle: 5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Lắc mạnh hơn
        );

        // 3. Lá cây lắc lư như cành cây (tween angle)
        coords = this.getWorldCoords(mapKey, laCayPos.x, laCayPos.y);
        this.createStaticOrTweenedImage(
            coords.x, coords.y, // Dùng tọa độ World đã tính
            'map_part2_la_cay',
            { depth: 12, originX: 1.0, originY: 0.5 }, // Đặt origin ở mép phải (điểm nối)
            { props: { angle: -3 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' } // Lắc lư
        );

        // --- Nhóm VFX Thác nước chảy (Waterfall) ---
        // 4. Thác nước với base và animation (scale 0.4 mặc định)
        // Depth phải cao hơn map_part2 (depth 10) để hiển thị trên map
        this.createWaterfallEffect(
            mapKey,
            waterfallPos.x,
            waterfallPos.y,
            {
                baseDepth: 11,    // Base ở dưới nhưng cao hơn map_part2
                effectDepth: 12,  // Effect đè lên trên base
                frameRate: 4,     // 4 frame mỗi giây
                scale: 1.0        // Scale gốc (đã thay đổi từ 0.4)
            }
        );

        // 5. Cá nhảy ngẫu nhiên quanh khu vực thác (timer định kỳ)
        const fishTimer = this.scene.time.addEvent({
            delay: 7000, // Tăng lên 7 giây để tránh spam water-drop
            loop: true,
            callback: () => {
                this.createFishJumpSequence(mapKey, fishPos.x, fishPos.y, { depth: 20, scale: 1.0, step: 140 });
            },
            callbackScope: this
        });
        this.activeVFX.push(fishTimer);

        console.log(`Created ${this.activeVFX.length} VFX elements/timers/tweens for Map Part 2.`);
    }

    // Hàm dọn dẹp khi Scene bị shutdown
    shutdown() {
        console.log("Stopping Map VFX and Audio...");
        
        // << [AUDIO] Dọn dẹp event listeners >>
        this.scene.game.events.off('musicVolumeChanged', this.onMusicVolumeChanged, this);
        this.scene.game.events.off('soundVolumeChanged', this.onSoundVolumeChanged, this);
        
        // << [AUDIO] Dừng nhạc nền với fade out >>
        if (this.bgMusic && this.bgMusic.isPlaying) {
            this.scene.tweens.add({
                targets: this.bgMusic,
                volume: 0,
                duration: 1000,
                ease: 'Linear',
                onComplete: () => {
                    if (this.bgMusic) {
                        this.bgMusic.stop();
                        this.bgMusic.destroy();
                        this.bgMusic = null;
                    }
                }
            });
        }
        
        // Dừng tất cả âm thanh đang phát
        this.activeSounds.forEach(sound => {
            if (sound && sound.isPlaying) {
                sound.stop();
                sound.destroy();
            }
        });
        this.activeSounds = [];
        
        // Lặp ngược để tránh lỗi khi xóa phần tử khỏi mảng đang lặp
        for (let i = this.activeVFX.length - 1; i >= 0; i--) {
            const vfx = this.activeVFX[i];
            try {
                if (vfx instanceof Phaser.Time.TimerEvent) {
                    vfx.remove();
                } else if (vfx instanceof Phaser.Tweens.Tween) {
                    // Chỉ cần dừng tween, target của nó (nếu là GO) sẽ được xử lý riêng
                     vfx.stop();
                     // Không remove target ở đây nữa
                } else if (vfx instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
                    vfx.destroy(); // Emitter cần destroy
                } else if (vfx instanceof Phaser.GameObjects.GameObject && vfx.scene) {
                    // Chỉ destroy GameObject không phải là nút bấm hoặc tiêu đề
                     if (vfx.type !== 'Rectangle' && vfx.type !== 'Text') {
                         vfx.destroy();
                     }
                }
            } catch (error) {
                console.warn("Error shutting down VFX:", vfx, error);
            }
        }
        this.activeVFX = []; // Reset mảng
    }
}

