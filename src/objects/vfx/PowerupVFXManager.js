import { playGameSfx, sfxEventForKey } from '../../managers/GameSfx.js';
// src/objects/vfx/PowerupVFXManager.js

import AudioManager from '../../managers/AudioManager';
import { SOUND_KEYS } from '../../utils/SoundAssets';

export class PowerupVFXManager {
  constructor(scene, vfxLayer = null) {
    this.scene = scene;
    this.vfxLayer = vfxLayer; // Layer riêng cho VFX (không có mask)
  }

  // --- Helper để phát âm thanh: Thêm volumeScale và pitch ---
  // Mặc định tăng 1.5 lần so với âm gốc
  playSound(key, volumeScale = 1.5, pitch = 1.0) {
    const event = sfxEventForKey(key);
    if (event) return playGameSfx(this.scene, event, { strength: volumeScale / 1.5, rate: pitch });
    const sfxVolume = AudioManager.getSoundVolume();
    if (sfxVolume > 0 && this.scene.sound) {
      this.scene.sound.play(key, { 
        volume: sfxVolume * volumeScale,
        pitch: pitch
      });
    }
  }
  
  /**
   * Helper: Add sprite vào vfxLayer (nếu có) hoặc scene
   */
  addVFXSprite(x, y, texture) {
    if (this.vfxLayer) {
      return this.vfxLayer.add(this.scene.add.sprite(x, y, texture));
    }
    return this.scene.add.sprite(x, y, texture);
  }
  
  addVFXImage(x, y, texture) {
    if (this.vfxLayer) {
      return this.vfxLayer.add(this.scene.add.image(x, y, texture));
    }
    return this.scene.add.image(x, y, texture);
  }
  
  addVFXCircle(x, y, radius, fillColor, fillAlpha) {
    if (this.vfxLayer) {
      return this.vfxLayer.add(this.scene.add.circle(x, y, radius, fillColor, fillAlpha));
    }
    return this.scene.add.circle(x, y, radius, fillColor, fillAlpha);
  }
  
  addVFXGraphics() {
    if (this.vfxLayer) {
      return this.vfxLayer.add(this.scene.add.graphics());
    }
    return this.scene.add.graphics();
  }
  
  /**
   * Helper: Tắt mask của gemLayer để VFX zoom to không bị cắt
   * @returns originalMask để khôi phục sau
   */
  disableGemLayerMask() {
    const gemLayer = this.scene.gemLayer;
    if (!gemLayer) return null;
    const originalMask = gemLayer.mask;
    gemLayer.clearMask();
    return originalMask;
  }
  
  /**
   * Helper: Khôi phục mask của gemLayer
   */
  restoreGemLayerMask(originalMask) {
    const gemLayer = this.scene.gemLayer;
    if (originalMask && gemLayer) {
      gemLayer.setMask(originalMask);
    }
  }

  /**
   * Hiệu ứng cho Bomb (Match 4) - Đã cập nhật: Zoom -> Lắc -> Nổ
   * @param {object} bombGem - Đối tượng gem Bomb
   * @param {Set<object>} affectedGems - Set các gem bị ảnh hưởng bởi vụ nổ
   * @param {function} onComplete - Callback để gọi khi animation kết thúc
   */
  playBombEffect(bombGem, affectedGems, onComplete) {
    // << PHÁT ÂM THANH BOMB >>
    this.playSound(SOUND_KEYS.BOMB); // = 1.5x âm gốc

    const bombSprite = bombGem.sprite;
    
    // Dừng idleTween và glowFX trước khi chạy hiệu ứng nổ
    if (bombGem.idleTween) {
      bombGem.idleTween.stop();
      bombGem.idleTween = null;
    }
    if (bombGem.glowFX) {
      bombGem.glowFX = null;
    }

    // Đưa góc về 0 để tween lắc lư hoạt động ổn định
    if (bombSprite && bombSprite.active) {
      bombSprite.setAngle(0);
    }

    const layerMask = this.disableGemLayerMask(); // TẮT MASK CỦA LAYER

    // CHUỖI HIỆU ỨNG: ZOOM -> LẮC -> BIẾN MẤT
    this.scene.tweens.chain({
      targets: bombSprite,
      onStart: () => {
        bombSprite.setDepth(50); // Đưa lên trên cùng
        this.scene.game.events.emit('screenShake', { duration: 200, intensity: 0.004 });
      },
      tweens: [
        // 1. Phóng to nhanh hơn
        {
          scale: bombSprite.scale * 3.2,
          duration: 250,
          ease: 'Back.easeOut'
        },
        // 2. Lắc lư nhẹ (rút ngắn thời gian)
        {
          angle: { from: -10, to: 10 },
          duration: 120,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut'
        },
        // 3. Thu nhỏ
        {
          scale: 0,
          alpha: 0,
          duration: 180,
          ease: 'Quad.easeIn'
        }
      ],
      onComplete: () => {
        // Khôi phục trạng thái
        if (bombSprite && bombSprite.active) {
          bombSprite.setDepth(2);
          bombSprite.setAngle(0);
        }
        this.restoreGemLayerMask(layerMask); // KHÔI PHỤC MASK
        if (onComplete) onComplete();
      }
    });

    // Hiệu ứng rung các gem bị ảnh hưởng
    affectedGems.forEach(gem => {
      if (gem !== bombGem && gem.sprite && gem.sprite.active) {
        this.scene.tweens.add({
          targets: gem.sprite,
          angle: { from: -10, to: 10 },
          duration: 80,
          delay: 200,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (gem.sprite && gem.sprite.active) gem.sprite.setAngle(0);
          }
        });
      }
    });
  }

  /**
   * Hiệu ứng cho Color Bomb (Match 5)
   * @param {object} colorBombGem - Đối tượng gem Color Bomb
   * @param {Set<object>} affectedGems - Set các gem cùng màu bị hút
   * @param {function} onComplete - Callback
   */
  playColorBombEffect(colorBombGem, affectedGems, onComplete) {
    // 1. Kiểm tra Color Bomb chính còn sống không
    if (!colorBombGem || !colorBombGem.sprite || !colorBombGem.sprite.active) {
      if (onComplete) onComplete();
      return;
    }

    // 2. Lọc danh sách bị hút: Chỉ giữ gem còn sprite hợp lệ
    const validAffectedGems = new Set();
    if (affectedGems) {
      affectedGems.forEach(gem => {
        if (gem && gem.sprite && gem.sprite.active) {
          validAffectedGems.add(gem);
        }
      });
    }

    const colorBombSprite = colorBombGem.sprite;
    
    // Dừng các tween cũ
    if (colorBombGem.idleTween) colorBombGem.idleTween.stop();
    colorBombGem.idleTween = null;
    colorBombGem.glowFX = null;
    colorBombSprite.setAngle(0);

    const targetPos = { x: colorBombSprite.x, y: colorBombSprite.y };
    const gemsToSuck = new Set(validAffectedGems);
    gemsToSuck.delete(colorBombGem);

    const layerMask = this.disableGemLayerMask();

    // CHUỖI VFX: Zoom -> Đổi Texture -> Lắc -> Hút
    this.scene.tweens.chain({
      targets: colorBombSprite,
      onStart: () => {
        colorBombSprite.setDepth(50);
        this.scene.game.events.emit('screenShake', { duration: 180, intensity: 0.003 });
      },
      tweens: [
        {
          scale: colorBombSprite.scale * 3,
          duration: 320,
          ease: 'Quad.easeOut'
        },
        {
          angle: 5,
          duration: 200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: 1
        }
      ],
      onComplete: () => {
        if (!colorBombSprite.active) {
          this.restoreGemLayerMask(layerMask);
          if (onComplete) onComplete();
          return;
        }

        // Đổi texture và lắc mạnh trước khi hút
        colorBombSprite.setTexture(this.scene.pieceTexture?.('color_bomb_op') || 'gem_color_bomb_op');
        
        this.scene.tweens.add({
          targets: colorBombSprite,
          angle: { from: -8, to: 8 },
          duration: 100,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.startSuckingGems(gemsToSuck, targetPos, colorBombSprite, () => {
              if (colorBombSprite.active) {
                colorBombSprite.setDepth(2);
                colorBombSprite.setAngle(0);
              }
              this.restoreGemLayerMask(layerMask);
              if (onComplete) onComplete();
            });
          }
        });
      }
    });
  }

  startSuckingGems(affectedGems, targetPos, mainSprite, onComplete) {
    // Lọc lại một lần nữa cho chắc chắn
    const validGems = Array.from(affectedGems || []).filter(gem => gem && gem.sprite && gem.sprite.active);
    const totalGems = validGems.length;

    // Trường hợp không có gem nào bị hút
    if (totalGems === 0) {
      if (mainSprite && mainSprite.active) {
        this.scene.tweens.add({
          targets: mainSprite,
          scale: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => { if (onComplete) onComplete(); }
        });
      } else {
        if (onComplete) onComplete();
      }
      return;
    }

    let maxDelay = 0;
    const duration = 480; // Hút nhanh hơn (cũ 800ms)

    // Tạo animation hút cho tất cả các gem hợp lệ
    validGems.forEach(gem => {
      const delay = Math.random() * 180 + 60;
      if (delay > maxDelay) {
        maxDelay = delay;
      }

      this.scene.tweens.add({
        targets: gem.sprite,
        x: targetPos.x,
        y: targetPos.y,
        scale: 0,
        alpha: 0,
        duration,
        delay,
        ease: 'Cubic.easeIn',
      });
    });

    const totalAnimationTime = duration + maxDelay;

    playGameSfx(this.scene, 'color');

    // Sau khi hút xong -> Thu nhỏ Color Bomb -> Mới gọi onComplete
    this.scene.time.delayedCall(totalAnimationTime, () => {
      if (mainSprite && mainSprite.active) {
        this.scene.tweens.add({
          targets: mainSprite,
          scale: 0,
          alpha: 0,
          duration: 250,
          ease: 'Back.easeIn',
          onComplete: () => {
            if (onComplete) onComplete();
          }
        });
      } else {
        if (onComplete) onComplete();
      }
    });
  }

  // << THÊM HÀM MỚI NÀY VÀO CUỐI CLASS >>
  // << THAY THẾ TOÀN BỘ HÀM NÀY >>
  /**
   * Hiệu ứng cho COMBO Bomb + Bomb (Nổ 5x5)
   * @param {object} selectedBomb - Quả bomb được chọn ban đầu (sẽ phóng to)
   * @param {object} targetBomb - Quả bomb ở vị trí đích (sẽ bay vào)
   * @param {Set<object>} affectedGems - Set các gem bị ảnh hưởng bởi vụ nổ
   * @param {function} onComplete - Callback
   */
  playDoubleBombEffect(selectedBomb, targetBomb, affectedGems, onComplete) {
    // [YÊU CẦU] Thêm âm thanh Bomb
    this.playSound(SOUND_KEYS.BOMB, 2.0, 0.8);  // > 1.5x, combo đôi uy lực hơn

    const selectedSprite = selectedBomb.sprite
    const targetSprite = targetBomb.sprite

    // Dừng idleTween và glowFX của cả 2 bomb trước khi combo nổ
    if (selectedBomb.idleTween) {
      selectedBomb.idleTween.stop();
      selectedBomb.idleTween = null;
    }
    if (selectedBomb.glowFX) {
      selectedBomb.glowFX = null;
    }
    if (targetBomb.idleTween) {
      targetBomb.idleTween.stop();
      targetBomb.idleTween = null;
    }
    if (targetBomb.glowFX) {
      targetBomb.glowFX = null;
    }
    if (selectedSprite && selectedSprite.active) {
      selectedSprite.setAngle(0);
    }
    if (targetSprite && targetSprite.active) {
      targetSprite.setAngle(0);
    }

    // 1. Bay vào chậm hơn (300ms)
    this.scene.tweens.add({
      targets: targetSprite,
      x: selectedSprite.x,
      y: selectedSprite.y,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => {
        targetSprite.setVisible(false)
      }
    })

    // 2. Phóng to chậm rãi (500ms) – giữ bomb sáng rõ như bomb đơn
    const layerMask9 = this.disableGemLayerMask();
    
    this.scene.tweens.add({
      targets: selectedSprite,
      scale: selectedSprite.scale * 4.5,
      duration: 350, // Cũ 350
      delay: 250,    // Đợi lâu hơn xíu sau khi va chạm
      ease: 'Quad.easeOut',
      onStart: () => {
        selectedSprite.setDepth(50)
        this.scene.game.events.emit('screenShake', { duration: 400, intensity: 0.012 })
      },
      onComplete: () => {
        // Khôi phục mask rồi tạo sóng nổ
        this.restoreGemLayerMask(layerMask9);
        this.createExplosionWave(selectedSprite.x, selectedSprite.y, onComplete);

        // Đồng thời thu nhỏ bomb chính (Zoom Out + Fade Out)
        this.scene.tweens.add({
          targets: selectedSprite,
          scale: 0,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeIn'
          // Không cần onComplete ở đây vì createExplosionWave sẽ gọi onComplete chính
        });
      }
    })

    // 3. Rung gem chậm rãi
    affectedGems.forEach(gem => {
      if (gem !== selectedBomb && gem !== targetBomb) {
        this.scene.tweens.add({
          targets: gem.sprite,
          angle: { from: -10, to: 10 },
          duration: 100, // Cũ 80
          delay: 400 + Math.random() * 200, // Delay theo nhịp mới
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (gem.sprite && gem.sprite.active) gem.sprite.setAngle(0);
          }
        })
      }
    })
  }

  // << THÊM CẢ HÀM HELPER NÀY VÀO >>
  // Hàm này dùng để vẽ vòng tròn sóng nổ lan ra
  createExplosionWave(x, y, onComplete) {
    const wave = this.addVFXCircle(x, y, this.scene.board.cellSize * 0.5, 0xffffff, 0.7)
    wave.setStrokeStyle(4, 0xFFD700)
    wave.setDepth(9)

    this.scene.tweens.add({
      targets: wave,
      radius: this.scene.board.cellSize * 2.5,
      alpha: 0,
      duration: 500, // Lan ra trong 0.5s (cũ 350ms)
      ease: 'Quad.easeOut',
      onComplete: () => {
        wave.destroy()
        if (onComplete) onComplete()
      }
    })
  }

  playStripeEffect(stripeGem, affectedGems, onComplete) {
    // << PHÁT ÂM THANH STRIPE >>
    this.playSound(SOUND_KEYS.STRIPE); // = 1.5x âm gốc

    const stripeSprite = stripeGem.sprite;
    
    // Dừng idleTween và glowFX trước khi chạy hiệu ứng Stripe
    if (stripeGem.idleTween) {
      stripeGem.idleTween.stop();
      stripeGem.idleTween = null;
    }
    if (stripeGem.glowFX) {
      stripeGem.glowFX = null;
    }

    if (!stripeSprite || !stripeSprite.active) {
      if (onComplete) onComplete();
      return;
    }
    stripeSprite.setAngle(0);
    const startPos = { x: stripeSprite.x, y: stripeSprite.y };
    const stripeRow = stripeSprite.getData('row');

    const originalDepth = stripeSprite.depth;
    const layerMask3 = this.disableGemLayerMask();
    stripeSprite.setDepth(20);

    // Phóng to, rồi thu nhỏ (yoyo)
    this.scene.tweens.add({
      targets: stripeSprite,
      scale: stripeSprite.scale * 2.0,
      duration: 300, // Cũ 200
      ease: 'Quad.easeOut',
      yoyo: true, // Tự thu nhỏ về lại kích thước cũ
      onComplete: () => {
        // Khi tween phóng to xong thì khôi phục depth/mask luôn
        if (stripeSprite && stripeSprite.active) {
          stripeSprite.setDepth(originalDepth);
          this.restoreGemLayerMask(layerMask3);
        }
      }
    });
    this.scene.tweens.add({
      targets: stripeSprite,
      angle: { from: -5, to: 5 },
      duration: 200, // Lắc chậm
      yoyo: true,
      repeat: 4,
      delay: 150
    });
    
    const isHorizontal = Array.from(affectedGems).some(g => g.sprite.getData('row') === stripeRow && g !== stripeGem);
    const noteKeys = Phaser.Utils.Array.Shuffle(['note1', 'note2', 'note3', 'note4', 'note1', 'note2', 'note3', 'note4']);

    const createNoteWave = (directionVector) => {
        for (let i = 0; i < 4; i++) {
            const noteKey = noteKeys.pop();
            if (!noteKey) continue;

            const note = this.addVFXImage(startPos.x, startPos.y, noteKey)
                .setScale(0.4)
                .setDepth(15)
                .setAlpha(0.9);

            // Nốt nhạc bay vừa phải và ra hết rìa board
            const travelDuration = Phaser.Math.Between(1000, 1200);
            const maxDistance = this.scene.board.cellSize * (8 + Math.random() * 2); // Bay ra hết rìa
            const offset = (Math.random() - 0.5) * this.scene.board.cellSize * 0.8;

            this.scene.tweens.add({
                targets: note,
                x: startPos.x + directionVector.x * maxDistance + (isHorizontal ? 0 : offset),
                y: startPos.y + directionVector.y * maxDistance + (isHorizontal ? offset : 0),
                alpha: 0,
                scale: 1.1,
                duration: travelDuration,
                delay: i * 80, // Liên tục hơn
                ease: 'Quad.easeOut',
                onComplete: () => note.destroy()
            });
        }
    };

    if (isHorizontal) {
        createNoteWave({ x: 1, y: 0 });
        createNoteWave({ x: -1, y: 0 });
    } else {
        createNoteWave({ x: 0, y: 1 });
        createNoteWave({ x: 0, y: -1 });
    }

    // Gọi onComplete sớm hơn và độc lập với tween phóng to
    this.scene.time.delayedCall(800, () => {
      if (onComplete) onComplete();
    });

    // Gem rung nhanh hơn, khớp với nốt nhạc bay nhanh
    affectedGems.forEach(gem => {
        if (!gem || !gem.sprite || !gem.sprite.active || gem === stripeGem) return;
        const gemSprite = gem.sprite;
        const distance = Phaser.Math.Distance.Between(startPos.x, startPos.y, gemSprite.x, gemSprite.y);
        const effectDelay = distance * 1.5; // Giảm hệ số delay để rung sớm hơn

        this.scene.time.delayedCall(effectDelay, () => {
             if (!gemSprite.active) return;
             this.scene.tweens.add({
                 targets: gemSprite,
                 angle: { from: -12, to: 12 },
                 duration: 80,
                 yoyo: true,
                 repeat: 1,
                 onComplete: () => {
                   if (gemSprite && gemSprite.active) gemSprite.setAngle(0);
                 }
             });
        });
    });

  }

  /**
   * Hiệu ứng cho COMBO Color Bomb + Stripe (Dàn dựng theo 3 bước)
   * @param {object} colorBombGem - Quả color bomb
   * @param {object} stripeGem - Quả stripe
   * @param {Set<object>} gemsToTransform - Set các gem CÙNG MÀU MỤC TIÊU (sẽ bị hút và biến hình)
   * @param {Set<object>} affectedGems - Set TẤT CẢ gem bị ảnh hưởng (bao gồm cả gemsToTransform và các gem trên hàng/cột)
   * @param {function} onComplete - Callback
   */
  playColorBombStripeComboEffect(colorBombGem, stripeGem, gemsToTransform, affectedGems, onComplete) {
    if (!colorBombGem || !colorBombGem.sprite || !stripeGem || !stripeGem.sprite) {
      if (onComplete) onComplete()
      return
    }

    const colorBombSprite = colorBombGem.sprite
    const stripeSprite = stripeGem.sprite

    // Dừng idleTween và glowFX cho cả Color Bomb và Stripe trước khi combo
    if (colorBombGem.idleTween) {
      colorBombGem.idleTween.stop();
      colorBombGem.idleTween = null;
    }
    if (colorBombGem.glowFX) {
      colorBombGem.glowFX = null;
    }
    if (stripeGem.idleTween) {
      stripeGem.idleTween.stop();
      stripeGem.idleTween = null;
    }
    if (stripeGem.glowFX) {
      stripeGem.glowFX = null;
    }
    if (colorBombSprite && colorBombSprite.active) {
      colorBombSprite.setAngle(0);
    }
    if (stripeSprite && stripeSprite.active) {
      stripeSprite.setAngle(0);
    }
    const centerPos = { x: colorBombSprite.x, y: colorBombSprite.y }

    // 1. Stripe bay vào chậm
    this.scene.tweens.add({
      targets: stripeSprite,
      x: centerPos.x,
      y: centerPos.y,
      scale: stripeSprite.scale * 0.5,
      alpha: 0,
      duration: 350, // Cũ 250
      ease: 'Quad.easeIn',
      onComplete: () => stripeSprite.setVisible(false)
    })

    // 2. Color Bomb phóng to nhẹ (ĐÃ BỎ LẮC LƯ VÀ SCREENSHAKE)
    const layerMask2 = this.disableGemLayerMask();
    this.scene.tweens.add({
      targets: colorBombSprite,
      scale: colorBombSprite.scale * 3, // Chỉ phóng to nhẹ, không quá lớn
      duration: 600,
      ease: 'Quad.easeOut',
      onStart: () => {
        colorBombSprite.setDepth(50)
        // ĐÃ BỎ: this.scene.game.events.emit('screenShake', ...)
      },
      onComplete: () => {
        // ĐỔI TEXTURE SANG color_bomb_op VÀ LẮC LƯ
        colorBombSprite.setTexture(this.scene.pieceTexture?.('color_bomb_op') || 'gem_color_bomb_op');
        
        this.scene.tweens.add({
          targets: colorBombSprite,
          angle: { from: -8, to: 8 },
          duration: 150,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.restoreGemLayerMask(layerMask2);
          }
        });
      }
    })

    const originalPositions = new Map()
    gemsToTransform.forEach(gem => {
      if (gem && gem.sprite) {
        originalPositions.set(gem, {
          x: gem.sprite.x,
          y: gem.sprite.y,
          scale: gem.sprite.scale
        })
      }
    })

    gemsToTransform.delete(colorBombGem)
    gemsToTransform.delete(stripeGem)

    // Hút chậm hơn (tăng từ 700 -> 900)
    let maxSuckDelay = 0
    const suckDuration = 900
    let gemsSuckedCount = 0
    const totalGemsToSuck = gemsToTransform.size

    if (totalGemsToSuck === 0) {
      this.scene.time.delayedCall(800, onComplete)
      return
    }

    gemsToTransform.forEach(gem => {
      if (!gem || !gem.sprite || !gem.sprite.active) {
        gemsSuckedCount++
        return
      }

      const delay = Math.random() * 250 + 150
      if (delay > maxSuckDelay) maxSuckDelay = delay

      this.scene.tweens.add({
        targets: gem.sprite,
        x: centerPos.x,
        y: centerPos.y,
        scale: 0,
        alpha: 0.5,
        duration: suckDuration,
        delay,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          gemsSuckedCount++
          if (gemsSuckedCount === totalGemsToSuck) {
            this.startSpitBackStripes(gemsToTransform, originalPositions, affectedGems, centerPos, onComplete)
          }
        }
      })
    })
  }

  /**
   * [HELPER] Bước 2 & 3: Nhả gem về, biến hình và kích hoạt VFX nốt nhạc
   */
  startSpitBackStripes(gemsToSpit, originalPositions, affectedGems, centerPos, onComplete) {
    let maxSpitDelay = 0
    const spitDuration = 800 // Tăng từ 600 -> 800 (bay chậm hơn)
    let gemsSpitCount = 0
    const totalGemsToSpit = gemsToSpit.size

    gemsToSpit.forEach(gem => {
      if (!gem || !gem.sprite) {
        gemsSpitCount++
        return
      }

      const oldPos = originalPositions.get(gem)
      if (!oldPos) {
        gemsSpitCount++
        return
      }

      // Tăng range delay để âm thanh kéo dài (200 -> 500)
      const delay = Math.random() * 500
      if (delay > maxSpitDelay) maxSpitDelay = delay

      gem.sprite.setPosition(centerPos.x, centerPos.y)
      gem.sprite.setTexture(this.scene.pieceTexture?.('stripe') || 'gem_stripe')
      gem.sprite.setAlpha(1)
      gem.sprite.setScale(oldPos.scale * 0.5)
      this.scene.tweens.add({
        targets: gem.sprite,
        x: oldPos.x,
        y: oldPos.y,
        scale: oldPos.scale,
        duration: spitDuration,
        delay,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (gem.sprite && gem.sprite.active) {
            // >>> PHÁT ÂM THANH KHI GEM BIẾN HÌNH THÀNH STRIPE <<<
            this.playSound(SOUND_KEYS.STRIPE, 1.7, 0.95) // > 1.5x cho combo Color Bomb + Stripe
            
            const isHorizontal = Phaser.Math.RND.pick([true, false])
            this.playStripeNoteWave(gem.sprite, isHorizontal)
          }
          gemsSpitCount++
          if (gemsSpitCount === totalGemsToSpit) {
            this.finishComboDestruction(affectedGems, onComplete)
          }
        }
      })
    })
  }

  /**
   * [HELPER] Bước 4 & 5: Rung gem và gọi onComplete (KHÔNG xóa sprite)
   */
  finishComboDestruction(affectedGems, onComplete) {
    // Rung kết thúc chậm
    affectedGems.forEach(gem => {
      if (!gem || !gem.sprite || !gem.sprite.active) return
      const delay = 800 + Math.random() * 300 // Delay lâu hơn
      this.scene.tweens.add({
        targets: gem.sprite,
        angle: { from: -15, to: 15 },
        duration: 120,
        yoyo: true,
        repeat: 2,
        delay,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (gem.sprite && gem.sprite.active) gem.sprite.setAngle(0);
        }
      })
    })
    this.scene.time.delayedCall(800, onComplete)
  }

  /**
   * [HELPER] Tạo sóng nốt nhạc bay ra từ 1 stripe (không phá gem)
   */
  playStripeNoteWave(stripeSprite, isHorizontal) {
    if (!stripeSprite || !stripeSprite.active) return

    const startPos = { x: stripeSprite.x, y: stripeSprite.y }
    const noteKeys = Phaser.Utils.Array.Shuffle(['note1', 'note2', 'note3', 'note4', 'note1', 'note2', 'note3', 'note4'])

    const createNoteWave = (directionVector) => {
      for (let i = 0; i < 4; i++) {
        const noteKey = noteKeys.pop()
        if (!noteKey) continue

        const note = this.addVFXImage(startPos.x, startPos.y, noteKey)
          .setScale(0.4)
          .setDepth(15)
          .setAlpha(0.9)

        // Nốt nhạc bay vừa phải và ra hết rìa board
        const travelDuration = Phaser.Math.Between(1000, 1200)
        const maxDistance = this.scene.board.cellSize * (8 + Math.random() * 2) // Bay ra hết rìa
        const offset = (Math.random() - 0.5) * this.scene.board.cellSize * 0.8

        this.scene.tweens.add({
          targets: note,
          x: startPos.x + directionVector.x * maxDistance + (isHorizontal ? 0 : offset),
          y: startPos.y + directionVector.y * maxDistance + (isHorizontal ? offset : 0),
          alpha: 0,
          scale: 1.1,
          duration: travelDuration,
          delay: i * 80, // Liên tục hơn
          ease: 'Quad.easeOut',
          onComplete: () => note.destroy()
        })
      }
    }

    if (isHorizontal) {
      createNoteWave({ x: 1, y: 0 })
      createNoteWave({ x: -1, y: 0 })
    } else {
      createNoteWave({ x: 0, y: 1 })
      createNoteWave({ x: 0, y: -1 })
    }

    const originalDepth = stripeSprite.depth
    const layerMask4 = this.disableGemLayerMask();
    stripeSprite.setDepth(20)
    this.scene.tweens.add({
      targets: stripeSprite,
      scale: stripeSprite.scale * 1.5,
      duration: 300, // Cũ 200
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        this.scene.time.delayedCall(800, () => {
          if (stripeSprite && stripeSprite.active) {
            stripeSprite.setDepth(originalDepth);
            this.restoreGemLayerMask(layerMask4);
          }
        })
      }
    })
    this.scene.tweens.add({
      targets: stripeSprite,
      angle: { from: -5, to: 5 },
      duration: 200, // Cũ 150
      yoyo: true,
      repeat: 4,
      delay: 800
    })
  }

  /**
   * [VFX MỚI] Hiệu ứng cho COMBO Stripe + Stripe (Dấu + rộng 1 ô)
   * @param {object} stripe1_tam_gem - Stripe ở "vị trí 2" (tâm)
   * @param {object} stripe2_bayvao_gem - Stripe ở "vị trí 1" (bay vào)
   * @param {Set<object>} affectedGems - Set các gem bị ảnh hưởng
   * @param {function} onComplete - Callback
   */
  playDoubleStripeEffect(stripe1_tam_gem, stripe2_bayvao_gem, affectedGems, onComplete) {
    // [YÊU CẦU] Thêm âm thanh Stripe
    this.playSound(SOUND_KEYS.STRIPE, 1.8, 0.9); // > 1.5x, stripe đôi nổi bật hơn

    const stripe1_tam = stripe1_tam_gem.sprite
    const stripe2_bayvao = stripe2_bayvao_gem.sprite

    // Dừng idleTween và glowFX của cả 2 stripe trước khi combo
    if (stripe1_tam_gem.idleTween) {
      stripe1_tam_gem.idleTween.stop();
      stripe1_tam_gem.idleTween = null;
    }
    if (stripe1_tam_gem.glowFX) {
      stripe1_tam_gem.glowFX = null;
    }
    if (stripe2_bayvao_gem.idleTween) {
      stripe2_bayvao_gem.idleTween.stop();
      stripe2_bayvao_gem.idleTween = null;
    }
    if (stripe2_bayvao_gem.glowFX) {
      stripe2_bayvao_gem.glowFX = null;
    }
    if (stripe1_tam && stripe1_tam.active) {
      stripe1_tam.setAngle(0);
    }
    if (stripe2_bayvao && stripe2_bayvao.active) {
      stripe2_bayvao.setAngle(0);
    }

    if (!stripe1_tam || !stripe2_bayvao) { if (onComplete) onComplete(); return }
    const centerPos = { x: stripe1_tam.x, y: stripe1_tam.y }
    const impactDelay = 300 // Bay vào chậm hơn

    // 1) Stripe 2 bay vào chậm
    this.scene.tweens.add({
      targets: stripe2_bayvao,
      x: centerPos.x,
      y: centerPos.y,
      scale: stripe2_bayvao.scale * 0.5,
      alpha: 0,
      duration: impactDelay,
      ease: 'Quad.easeIn',
      onComplete: () => stripe2_bayvao.setVisible(false)
    })

    // 2) Stripe 1 phóng to chậm
    const layerMask5 = this.disableGemLayerMask();
    this.scene.tweens.add({
      targets: stripe1_tam,
      scale: stripe1_tam.scale * 4.5,
      alpha: { from: 1, to: 0.5 },
      duration: 500, // Cũ 350
      delay: impactDelay - 50,
      ease: 'Quad.easeOut',
      onStart: () => {
        stripe1_tam.setDepth(50)
        this.scene.game.events.emit('screenShake', { duration: 400, intensity: 0.012 })
      },
      onComplete: () => {
        this.restoreGemLayerMask(layerMask5);

        // Thu nhỏ Stripe chính trước khi kết thúc
        this.scene.tweens.add({
          targets: stripe1_tam,
          scale: 0,
          alpha: 0,
          duration: 200
          // onComplete tổng thể vẫn do delayedCall cuối hàm xử lý
        });
      }
    })

    // 3) Kích hoạt nốt nhạc
    this.scene.time.delayedCall(impactDelay, () => {
      if (stripe1_tam && stripe1_tam.active) {
        this.playStripeNoteWave(stripe1_tam, true)
        this.playStripeNoteWave(stripe1_tam, false)
      }
    })

    // 4) Rung gem
    affectedGems.forEach(gem => {
      if (!gem || !gem.sprite || !gem.sprite.active) return
      if (gem === stripe1_tam_gem || gem === stripe2_bayvao_gem) return
      const gemSprite = gem.sprite
      const distance = Phaser.Math.Distance.Between(centerPos.x, centerPos.y, gemSprite.x, gemSprite.y)
      const effectDelay = (distance * 6) + impactDelay // Delay lâu hơn
      this.scene.time.delayedCall(effectDelay, () => {
        if (!gemSprite.active) return
        this.scene.tweens.add({
          targets: gemSprite,
          angle: { from: -15, to: 15 },
          duration: 120,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            if (gemSprite && gemSprite.active) gemSprite.setAngle(0);
          }
        })
      })
    })

    // 5) Hoàn tất
    this.scene.time.delayedCall(1200 + impactDelay, onComplete)
  }

  /**
   * [VFX ĐÃ SỬA LỖI TEXTURE] Hiệu ứng cho COMBO Bomb + Stripe 
   * -> Biến thành "BIG STRIPE" (Nốt nhạc khổng lồ)
   */
  playBombStripeComboEffect(powerupAtPos2, powerupAtPos1, direction, affectedGems, onComplete) {
    // [YÊU CẦU] Thêm âm thanh Stripe (cho hiệu ứng Big Stripe)
    this.playSound(SOUND_KEYS.STRIPE, 2.0, 0.85); // Big Stripe to nhất

    const sprite1_tam = powerupAtPos2.sprite;    // Gem đứng yên (tâm)
    const sprite2_bayvao = powerupAtPos1.sprite; // Gem bay vào

    // Dừng idleTween và glowFX của cả Bomb và Stripe trước khi combo
    if (powerupAtPos2.idleTween) {
      powerupAtPos2.idleTween.stop();
      powerupAtPos2.idleTween = null;
    }
    if (powerupAtPos2.glowFX) {
      powerupAtPos2.glowFX = null;
    }
    if (powerupAtPos1.idleTween) {
      powerupAtPos1.idleTween.stop();
      powerupAtPos1.idleTween = null;
    }
    if (powerupAtPos1.glowFX) {
      powerupAtPos1.glowFX = null;
    }
    if (sprite1_tam && sprite1_tam.active) {
      sprite1_tam.setAngle(0);
    }
    if (sprite2_bayvao && sprite2_bayvao.active) {
      sprite2_bayvao.setAngle(0);
    }

    const centerPos = { x: sprite1_tam.x, y: sprite1_tam.y };

    const impactDelay = 300; // Bay vào chậm

    // 1. Gem bay vào (Bay xong thì ẩn đi)
    this.scene.tweens.add({
        targets: sprite2_bayvao,
        x: centerPos.x,
        y: centerPos.y,
        scale: sprite2_bayvao.scale * 0.5,
        alpha: 0,
        duration: impactDelay,
        ease: 'Quad.easeIn',
        onComplete: () => sprite2_bayvao.setVisible(false)
    });

    // 2. Gem tâm biến hình thành Big Stripe (chậm rãi)
    const layerMask6 = this.disableGemLayerMask();
    
    // [FIX LỖI] Đã xóa dòng sprite1_tam.setTexture(this.scene.pieceTexture?.('stripe') || 'gem_stripe') ở đây
    // để tránh bị đổi hình trước khi va chạm.

    this.scene.tweens.add({
        targets: sprite1_tam,
        scale: sprite1_tam.scale * 4.0,
        duration: 500, // Cũ 300
        delay: impactDelay, // Đợi gem kia bay vào xong mới biến hình
        ease: 'Back.easeOut',
        onStart: () => {
            // [FIX LỖI] Chỉ đổi texture TẠI THỜI ĐIỂM BẮT ĐẦU PHÓNG TO (sau delay)
            sprite1_tam.setTexture(this.scene.pieceTexture?.('stripe') || 'gem_stripe');
            
            sprite1_tam.setDepth(50);
            this.scene.game.events.emit('screenShake', { duration: 400, intensity: 0.012 });
        },
        onComplete: () => {
            this.spawnGiantNotes(centerPos, direction);
            
            // Mờ dần chậm
            this.scene.tweens.add({
                targets: sprite1_tam,
                alpha: 0,
                duration: 300,
                onComplete: () => this.restoreGemLayerMask(layerMask6)
            });
        }
    });

    // 3. Rung các gem bị ảnh hưởng (Logic giữ nguyên)
    let maxGemFadeDelay = 0;
    affectedGems.forEach(gem => {
        if (!gem || !gem.sprite || !gem.sprite.active) return;
        if (gem === powerupAtPos1 || gem === powerupAtPos2) return;
        const gemSprite = gem.sprite;
        
        let dist = 0;
        if (direction === 'horizontal') {
            dist = Math.abs(gemSprite.x - centerPos.x);
        } else {
            dist = Math.abs(gemSprite.y - centerPos.y);
        }
        
        // Sóng lan chậm hơn
        const waveDelay = impactDelay + 300 + (dist * 0.8);

        this.scene.tweens.add({
            targets: gemSprite,
            x: gemSprite.x + (Math.random() > 0.5 ? 5 : -5),
            y: gemSprite.y + (Math.random() > 0.5 ? 5 : -5),
            duration: 80,
            yoyo: true,
            repeat: 5,
            delay: waveDelay,
            onComplete: () => {
                if (gemSprite && gemSprite.active) {
                    gemSprite.setAngle(0);
                }
            }
        });

        if (waveDelay > maxGemFadeDelay) maxGemFadeDelay = waveDelay;
    });

    // 4. Kết thúc
    const totalDuration = maxGemFadeDelay + 1000;
    this.scene.time.delayedCall(totalDuration, onComplete);
  }

  /**
   * [HELPER MỚI] Tạo nốt nhạc KHỔNG LỒ bay ra (Dùng cho Combo Bomb + Stripe)
   */
  spawnGiantNotes(startPos, direction) {
    const noteKeys = ['note1', 'note2', 'note3', 'note4'];
    const isHorizontal = (direction === 'horizontal');

    // Hàm tạo 1 luồng nốt nhạc khổng lồ
    const createGiantStream = (dirX, dirY) => {
        for (let i = 0; i < 5; i++) {
            const noteKey = Phaser.Utils.Array.GetRandom(noteKeys);
            
            const note = this.addVFXImage(startPos.x, startPos.y, noteKey)
                .setScale(0)
                .setDepth(45)
                .setAlpha(1);

            const travelDuration = 1100; // Bay vừa phải
            const maxDistance = this.scene.board.getBoardDimensions().width; // Bay ra hết rìa

            this.scene.tweens.add({
                targets: note,
                x: startPos.x + dirX * maxDistance,
                y: startPos.y + dirY * maxDistance,
                scale: 1.5,
                rotation: Math.random() * 6,
                duration: travelDuration,
                delay: i * 100, // Bay nối đuôi nhanh hơn
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: note,
                        scale: 2.0,
                        alpha: 0,
                        duration: 200,
                        onComplete: () => note.destroy()
                    });
                }
            });
        }
    };

    if (isHorizontal) {
        createGiantStream(-1, 0);
        createGiantStream(1, 0);
    } else {
        createGiantStream(0, -1);
        createGiantStream(0, 1);
    }
  }

  /**
   * [HELPER] Kích hoạt VFX nổ 3x3 cho 1 quả bomb (không phá gem)
   */
  playSingleBombVFX(bombSprite) {
    if (!bombSprite || !bombSprite.active) return;
    const originalDepth = bombSprite.depth;
    const layerMask7 = this.disableGemLayerMask();
    this.scene.tweens.add({
      targets: bombSprite,
      scale: bombSprite.scale * 3,
      duration: 350, // Cũ 200
      ease: 'Quad.easeOut',
      yoyo: true,
      onStart: () => {
        bombSprite.setDepth(50);
        this.scene.game.events.emit('screenShake', { duration: 200, intensity: 0.005 });
      },
      onComplete: () => {
        if (bombSprite && bombSprite.active) {
          bombSprite.setDepth(originalDepth);
          this.restoreGemLayerMask(layerMask7);
        }
      }
    });
  }

  /**
   * Hàm chính: Combo Color Bomb + Bomb
   */
  playColorBombBombComboEffect(colorBombGem, bombGem, gemsToTransform, affectedGems, onComplete) {
    if (!colorBombGem || !colorBombGem.sprite || !bombGem || !bombGem.sprite) {
      if (onComplete) onComplete();
      return;
    }

    const colorBombSprite = colorBombGem.sprite;
    const bombSprite = bombGem.sprite;

     // Dừng idleTween và glowFX của cả Color Bomb và Bomb trước khi combo
    if (colorBombGem.idleTween) {
      colorBombGem.idleTween.stop();
      colorBombGem.idleTween = null;
    }
    if (colorBombGem.glowFX) {
      colorBombGem.glowFX = null;
    }
    if (bombGem.idleTween) {
      bombGem.idleTween.stop();
      bombGem.idleTween = null;
    }
    if (bombGem.glowFX) {
      bombGem.glowFX = null;
    }
    if (colorBombSprite && colorBombSprite.active) {
      colorBombSprite.setAngle(0);
    }
    if (bombSprite && bombSprite.active) {
      bombSprite.setAngle(0);
    }

    const centerPos = { x: colorBombSprite.x, y: colorBombSprite.y };

    // Bomb bay vào chậm
    this.scene.tweens.add({
      targets: bombSprite,
      x: centerPos.x,
      y: centerPos.y,
      scale: bombSprite.scale * 0.5,
      alpha: 0,
      duration: 350, // Cũ 250
      ease: 'Quad.easeIn',
      onComplete: () => bombSprite.setVisible(false)
    });

    // Color Bomb phóng to chậm
    const layerMask8 = this.disableGemLayerMask();
    this.scene.tweens.add({
      targets: colorBombSprite,
      scale: colorBombSprite.scale * 3,
      duration: 600, // Cũ 400
      ease: 'Quad.easeOut',
      onStart: () => {
        colorBombSprite.setDepth(50);
        this.scene.game.events.emit('screenShake', { duration: 400, intensity: 0.005 });
      },
      onComplete: () => {
        // ĐỔI TEXTURE SANG color_bomb_op VÀ LẮC LƯ
        colorBombSprite.setTexture(this.scene.pieceTexture?.('color_bomb_op') || 'gem_color_bomb_op');
        
        this.scene.tweens.add({
          targets: colorBombSprite,
          angle: { from: -8, to: 8 },
          duration: 150,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.restoreGemLayerMask(layerMask8);
          }
        });
      }
    });

    const originalPositions = new Map();
    gemsToTransform.forEach(gem => {
      if (gem && gem.sprite) {
        originalPositions.set(gem, { x: gem.sprite.x, y: gem.sprite.y, scale: gem.sprite.scale });
      }
    });

    gemsToTransform.delete(colorBombGem);
    gemsToTransform.delete(bombGem);

    // Hút vào chậm hơn (tăng từ 700 -> 900)
    let maxSuckDelay = 0;
    const suckDuration = 900;
    let sucked = 0;
    const total = gemsToTransform.size;
    if (total === 0) {
      this.scene.time.delayedCall(500, onComplete);
      return;
    }
    gemsToTransform.forEach(gem => {
      if (!gem || !gem.sprite || !gem.sprite.active) { sucked++; return; }
      const delay = Math.random() * 250 + 150;
      if (delay > maxSuckDelay) maxSuckDelay = delay;
      this.scene.tweens.add({
        targets: gem.sprite,
        x: centerPos.x,
        y: centerPos.y,
        scale: 0,
        alpha: 0.5,
        duration: suckDuration,
        delay,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          sucked++;
          if (sucked === total) {
            this.startSpitBackBombs(gemsToTransform, originalPositions, affectedGems, centerPos, onComplete);
          }
        }
      });
    });
  }

  /**
   * Hiệu ứng cho COMBO Color Bomb + Color Bomb (Hút tất cả gems trên board)
   * @param {object} colorBomb1 - Color Bomb thứ nhất
   * @param {object} colorBomb2 - Color Bomb thứ hai
   * @param {Set<object>} affectedGems - Set TẤT CẢ gem trên board (trừ 2 color bomb)
   * @param {function} onComplete - Callback
   */
  playDoubleColorBombEffect(colorBomb1, colorBomb2, affectedGems, onComplete) {
    if (!colorBomb1 || !colorBomb1.sprite || !colorBomb2 || !colorBomb2.sprite) {
      if (onComplete) onComplete();
      return;
    }

    // Phát âm thanh Color Bomb cực mạnh
    this.playSound(SOUND_KEYS.BOMB, 2.5, 0.7); // Combo mạnh nhất

    const sprite1 = colorBomb1.sprite;
    const sprite2 = colorBomb2.sprite;

    // Dừng idleTween và glowFX của cả 2 color bomb
    if (colorBomb1.idleTween) {
      colorBomb1.idleTween.stop();
      colorBomb1.idleTween = null;
    }
    if (colorBomb1.glowFX) {
      colorBomb1.glowFX = null;
    }
    if (colorBomb2.idleTween) {
      colorBomb2.idleTween.stop();
      colorBomb2.idleTween = null;
    }
    if (colorBomb2.glowFX) {
      colorBomb2.glowFX = null;
    }
    if (sprite1 && sprite1.active) {
      sprite1.setAngle(0);
    }
    if (sprite2 && sprite2.active) {
      sprite2.setAngle(0);
    }

    // Tính điểm giữa 2 color bomb
    const centerPos = {
      x: (sprite1.x + sprite2.x) / 2,
      y: (sprite1.y + sprite2.y) / 2
    };

    const layerMask = this.disableGemLayerMask();

    // 1. Cả 2 color bomb bay vào nhau (chậm rãi)
    this.scene.tweens.add({
      targets: sprite1,
      x: centerPos.x,
      y: centerPos.y,
      scale: sprite1.scale * 2,
      duration: 400,
      ease: 'Quad.easeIn',
      onStart: () => {
        sprite1.setDepth(50);
      }
    });

    this.scene.tweens.add({
      targets: sprite2,
      x: centerPos.x,
      y: centerPos.y,
      scale: sprite2.scale * 2,
      duration: 400,
      ease: 'Quad.easeIn',
      onStart: () => {
        sprite2.setDepth(50);
      },
      onComplete: () => {
        // Sau khi va chạm, ẩn sprite2 và để sprite1 tiếp tục hiệu ứng
        sprite2.setVisible(false);

        // 2. Sprite1 phóng to cực lớn
        this.scene.tweens.add({
          targets: sprite1,
          scale: sprite1.scale * 2.5, // Tổng cộng x5
          duration: 500,
          ease: 'Back.easeOut',
          onStart: () => {
            this.scene.game.events.emit('screenShake', { 
              duration: 600, 
              intensity: 0.015 
            });
          },
          onComplete: () => {
            // 3. Đổi sang color_bomb_op và lắc lư mạnh
            sprite1.setTexture(this.scene.pieceTexture?.('color_bomb_op') || 'gem_color_bomb_op');
            
            this.scene.tweens.add({
              targets: sprite1,
              angle: { from: -12, to: 12 },
              duration: 120,
              yoyo: true,
              repeat: 3,
              ease: 'Sine.easeInOut',
              onComplete: () => {
                // 4. Bắt đầu hút TẤT CẢ gems vào
                this.startMassiveSuck(affectedGems, centerPos, sprite1, () => {
                  sprite1.setDepth(2);
                  this.restoreGemLayerMask(layerMask);
                  if (onComplete) onComplete();
                });
              }
            });
          }
        });
      }
    });
  }

  /**
   * [HELPER] Hút hàng loạt gems vào (dùng cho Double Color Bomb)
   */
  startMassiveSuck(affectedGems, centerPos, mainSprite, onComplete) {
    const totalGems = affectedGems.size;

    if (totalGems === 0) {
      if (mainSprite && mainSprite.active) {
        this.scene.tweens.add({
          targets: mainSprite,
          scale: 0,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => { if (onComplete) onComplete(); }
        });
      } else {
        if (onComplete) onComplete();
      }
      return;
    }

    let maxDelay = 0;
    const duration = 600; // Hút nhanh và mạnh mẽ

    // Tạo animation hút cho tất cả gems
    affectedGems.forEach(gem => {
      if (!gem || !gem.sprite || !gem.sprite.active) return;

      const delay = Math.random() * 300 + 100; // Random delay để tạo hiệu ứng sóng
      if (delay > maxDelay) maxDelay = delay;

      // Tạo hiệu ứng particles khi gem bay vào
      const gemSprite = gem.sprite;
      
      this.scene.tweens.add({
        targets: gemSprite,
        x: centerPos.x,
        y: centerPos.y,
        scale: 0,
        alpha: 0,
        rotation: Math.random() * Math.PI * 2, // Xoay ngẫu nhiên
        duration,
        delay,
        ease: 'Cubic.easeIn'
      });
    });

    const totalAnimationTime = duration + maxDelay;

    // Âm thanh hút gem liên tục
    playGameSfx(this.scene, 'color');

    // Tạo vòng tròn sóng năng lượng lan ra
    this.createEnergyWaves(centerPos, totalAnimationTime);

    // Sau khi hút xong -> Thu nhỏ Color Bomb -> Gọi onComplete
    this.scene.time.delayedCall(totalAnimationTime, () => {
      if (mainSprite && mainSprite.active) {
        this.scene.tweens.add({
          targets: mainSprite,
          scale: 0,
          alpha: 0,
          duration: 400,
          ease: 'Back.easeIn',
          onStart: () => {
            // Flash sáng trước khi biến mất
            this.scene.tweens.add({
              targets: mainSprite,
              alpha: { from: 1, to: 0 },
              duration: 400,
              ease: 'Quad.easeOut'
            });
          },
          onComplete: () => {
            if (onComplete) onComplete();
          }
        });
      } else {
        if (onComplete) onComplete();
      }
    });
  }

  /**
   * [HELPER] Tạo sóng năng lượng lan ra (dùng cho Double Color Bomb)
   */
  createEnergyWaves(centerPos, duration) {
    const numWaves = 3;
    const waveInterval = duration / numWaves;

    for (let i = 0; i < numWaves; i++) {
      this.scene.time.delayedCall(i * waveInterval, () => {
        const wave = this.addVFXCircle(
          centerPos.x, 
          centerPos.y, 
          this.scene.board.cellSize * 0.3, 
          0xFFFFFF, 
          0.8
        );
        wave.setStrokeStyle(6, 0xFF00FF); // Màu tím sáng
        wave.setDepth(45);

        this.scene.tweens.add({
          targets: wave,
          radius: this.scene.board.cellSize * 5,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => wave.destroy()
        });
      });
    }
  }

  /**
   * Helper: nhả về và phát nổ đơn
   */
  startSpitBackBombs(gemsToSpit, originalPositions, affectedGems, centerPos, onComplete) {
    let maxSpitDelay = 0;
    const spitDuration = 800; // Tăng từ 600 -> 800 (bay chậm hơn)
    let done = 0;
    const total = gemsToSpit.size;
    gemsToSpit.forEach(gem => {
      if (!gem || !gem.sprite) { done++; return; }
      const oldPos = originalPositions.get(gem);
      if (!oldPos) { done++; return; }
      // Tăng range delay để âm thanh kéo dài (200 -> 500)
      const delay = Math.random() * 500;
      if (delay > maxSpitDelay) maxSpitDelay = delay;
      gem.sprite.setPosition(centerPos.x, centerPos.y);
      gem.sprite.setTexture(this.scene.pieceTexture?.('bomb') || 'gem_bomb');
      gem.sprite.setAlpha(1);
      gem.sprite.setScale(oldPos.scale * 0.5);
      this.scene.tweens.add({
        targets: gem.sprite,
        x: oldPos.x,
        y: oldPos.y,
        scale: oldPos.scale,
        duration: spitDuration,
        delay,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (gem.sprite && gem.sprite.active) {
            // >>> PHÁT ÂM THANH KHI GEM BIẾN HÌNH THÀNH BOMB <<<
            this.playSound(SOUND_KEYS.BOMB, 1.7, 0.9); // > 1.5x cho combo Color Bomb + Bomb
            
            this.playSingleBombVFX(gem.sprite);
          }
          done++;
          if (done === total) {
            // Rung kết thúc chậm
            affectedGems.forEach(g => {
              if (!g || !g.sprite || !g.sprite.active) return;
              const d = 800 + Math.random() * 300;
              this.scene.tweens.add({
                targets: g.sprite,
                angle: { from: -10, to: 10 },
                duration: 100,
                delay: d,
                yoyo: true,
                repeat: 2,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                  if (g.sprite && g.sprite.active) g.sprite.setAngle(0);
                }
              });
            });
            this.scene.time.delayedCall(1500, onComplete);
          }
        }
      });
    });
  }

}
