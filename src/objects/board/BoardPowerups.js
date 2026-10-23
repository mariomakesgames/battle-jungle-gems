import { playGameSfx, sfxEventForKey } from '../../managers/GameSfx.js';
// src/objects/board/BoardPowerups.js
import { GEM_TYPES } from '../../utils/constants'
import { SOUND_KEYS } from '../../utils/SoundAssets' // <--- Import Sound Assets
import AudioManager from '../../managers/AudioManager' // <--- Import Audio Manager

export class BoardPowerups {
  // ... (Giữ nguyên các hàm isPowerup, transformIntoPowerup không đổi)

  isPowerup(gemObject) {
    if (!gemObject) return false
    const value = gemObject.value
    return value === GEM_TYPES.BOMB || value === GEM_TYPES.COLOR_BOMB || value === GEM_TYPES.STRIPE
  }

  transformIntoPowerup(gemObject, powerupType) {
    gemObject.type = 'gem'
    gemObject.value = powerupType
    gemObject.sprite.setTexture(this.scene.pieceTexture?.(powerupType) || `gem_${powerupType}`)
    gemObject.sprite.setData('type', powerupType)
    console.log(`Transformed gem into ${powerupType} power-up`)

    // Kích hoạt hiệu ứng Idle cho powerup ngay sau khi biến hình
    if (this.startPowerupIdle) {
      this.startPowerupIdle(gemObject)
    }
  }

  // Hàm helper để phát âm thanh nhanh gọn
  playSound(key, volumeScale = 1.0) {
    const event = sfxEventForKey(key);
    if (event) return playGameSfx(this.scene, event, { strength: volumeScale });
    const sfxVolume = AudioManager.getSoundVolume()
    if (sfxVolume > 0 && this.scene && this.scene.sound) {
      this.scene.sound.play(key, { volume: sfxVolume * volumeScale })
    }
  }

  // --- 1. COMBO CƠ BẢN (Bomb+Bomb, CB+CB) ---
  activatePowerupCombo(powerup1, powerup2) {
    const type1 = powerup1.value
    const type2 = powerup2.value
    const allGemsToExplode = new Set([powerup1, powerup2])

    // Case: Bomb + Bomb
    if (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.BOMB) {
      this.playSound(SOUND_KEYS.BOMB) // <--- Âm thanh
      const explosion1 = this.getGemsInArea(powerup1.sprite.getData('row'), powerup1.sprite.getData('col'), 2)
      explosion1.forEach(gem => allGemsToExplode.add(gem))
      
      // Xử lý VFX nếu có
      if (this.powerupVFXManager) {
        this.powerupVFXManager.playDoubleBombEffect(powerup1, powerup2, allGemsToExplode, () => {
           this.removeGemSprites(allGemsToExplode)
           this.applyGravityAndRefill()
        })
        return // <--- Return sớm để VFX lo việc xóa
      }

    } else if (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.COLOR_BOMB) {
      // Case: CB + CB
      this.playSound(SOUND_KEYS.BOMB, 1.2) // <--- Âm thanh to hơn
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          if (this.grid[r][c] && this.grid[r][c].type === 'gem') {
            allGemsToExplode.add(this.grid[r][c])
          }
        }
      }
      // Hiện tại chưa có VFX CB+CB riêng, chạy logic cũ
    } else {
      // Case khác (ít gặp ở hàm này)
      const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerup1 : powerup2
      const bomb = (colorBomb === powerup1) ? powerup2 : powerup1
      const targetColor = this.levelData.availableGems[0] || GEM_TYPES.RED
      const bombsToActivate = [bomb]
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const gem = this.grid[r][c]
          if (gem && gem.type === 'gem' && gem.value === targetColor) {
            this.transformIntoPowerup(gem, GEM_TYPES.BOMB)
            bombsToActivate.push(gem)
          }
        }
      }
      bombsToActivate.forEach(b => this.activateBomb(b, allGemsToExplode))
    }

    // Logic gốc (Fallback cho các case không có VFX)
    this.removeGemSprites(allGemsToExplode)
    this.scene.time.delayedCall(300, () => this.applyGravityAndRefill())
  }

  // --- 2. KÍCH HOẠT POWERUP (Chính) ---
  activatePowerup(powerupGem, otherGem) {
    if (this.boardBusy) return
    this.boardBusy = true
    this.scene.input.enabled = false
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('boardBusy', true)
    }

    const powerupType = powerupGem.value
    const otherType = otherGem.value

    // Case: Dính dáng đến Color Bomb -> Chuyển sang hàm riêng
    if (powerupType === GEM_TYPES.COLOR_BOMB || otherType === GEM_TYPES.COLOR_BOMB) {
      const colorBomb = (powerupType === GEM_TYPES.COLOR_BOMB) ? powerupGem : otherGem
      const other = (colorBomb === powerupGem) ? otherGem : powerupGem
      this.activateColorBomb(colorBomb, other)
      return
    }

    // Case: Bomb + Bomb
    if (powerupType === GEM_TYPES.BOMB && otherType === GEM_TYPES.BOMB) {
      const allGemsToExplode = new Set()
      this.activateBomb(powerupGem, allGemsToExplode)
      this.activateBomb(otherGem, allGemsToExplode)

      // [FIX] Thêm VFX và Âm thanh
      if (this.powerupVFXManager) {
        // playSound đã được gọi bên trong VFX Manager (hoặc gọi ở đây cho chắc)
        this.powerupVFXManager.playDoubleBombEffect(powerupGem, otherGem, allGemsToExplode, () => {
          this.removeGemSprites(allGemsToExplode)
          this.applyGravityAndRefill()
        })
      } else {
        // Fallback Code 2
        this.removeGemSprites(allGemsToExplode)
        this.scene.time.delayedCall(300, () => this.applyGravityAndRefill())
      }

    } 
    // Case: Single Bomb
    else if (powerupType === GEM_TYPES.BOMB) {
      const allGemsToExplode = new Set()
      this.activateBomb(powerupGem, allGemsToExplode)

      // [FIX] Thêm VFX và Âm thanh
      if (this.powerupVFXManager) {
        this.powerupVFXManager.playBombEffect(powerupGem, allGemsToExplode, () => {
          this.removeGemSprites(allGemsToExplode)
          this.applyGravityAndRefill()
        })
      } else {
        // Fallback Code 2
        this.removeGemSprites(allGemsToExplode)
        this.scene.time.delayedCall(300, () => this.applyGravityAndRefill())
      }
    }
  }

  // (Hàm activateBomb giữ nguyên logic Code 2)
  activateBomb(bombObject, alreadyExploded = new Set()) {
    if (alreadyExploded.has(bombObject)) return
    alreadyExploded.add(bombObject)
    const bombRow = bombObject.sprite.getData('row')
    const bombCol = bombObject.sprite.getData('col')
    for (let r = bombRow - 1; r <= bombRow + 1; r++) {
      for (let c = bombCol - 1; c <= bombCol + 1; c++) {
        const destroyedGem = this.damageCell(r, c)
        if (destroyedGem) {
          alreadyExploded.add(destroyedGem)
        }
      }
    }
    const chainReactionBombs = Array.from(alreadyExploded).filter(gem => 
      gem.value === GEM_TYPES.BOMB && 
      gem !== bombObject
    )
    chainReactionBombs.forEach(nextBomb => {
      this.activateBomb(nextBomb, alreadyExploded)
    })
  }

  // --- 3. KÍCH HOẠT COLOR BOMB (Sửa để thêm VFX) ---
  activateColorBomb(colorBombObject, swappedObject) {
    if (!this.boardBusy) {
      this.boardBusy = true
      this.scene.input.enabled = false
      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('boardBusy', true)
      }
    }
    
    const gemsToRemove = new Set()
    const swappedObjectType = swappedObject.value

    // Case 1: CB + CB (Clear All)
    if (swappedObjectType === GEM_TYPES.COLOR_BOMB) {
      this.playSound(SOUND_KEYS.BOMB, 1.5) // Âm thanh lớn
      
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const destroyedGem = this.damageCell(r, c)
          if (destroyedGem) {
            gemsToRemove.add(destroyedGem)
          }
        }
      }
      // Chưa có VFX đặc biệt cho CB+CB -> Giữ nguyên Code 2
      this.removeGemSprites(gemsToRemove)
      this.scene.time.delayedCall(500, () => this.applyGravityAndRefill())

    } 
    // Case 2: CB + Bomb
    else if (swappedObjectType === GEM_TYPES.BOMB) {
      const allGemsToExplode = new Set()
      allGemsToExplode.add(colorBombObject)
      allGemsToExplode.add(swappedObject)
      
      const availableGems = this.levelData.availableGems || Object.values(GEM_TYPES).filter(t => ![GEM_TYPES.BOMB, GEM_TYPES.COLOR_BOMB].includes(t))
      const targetColor = Phaser.Math.RND.pick(availableGems)
      
      // [FIX] Tách bước: Tìm gem -> VFX -> Biến hình & Nổ
      const gemsToTransform = new Set()
      
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const gem = this.grid[r][c]
          if (gem && gem.type === 'gem' && gem.value === targetColor) {
            // Thay vì biến hình ngay, ta đưa vào danh sách để VFX xử lý (bay về)
            gemsToTransform.add(gem)
          }
        }
      }

      if (this.powerupVFXManager) {
        // Gọi VFX Combo
        this.powerupVFXManager.playColorBombBombComboEffect(colorBombObject, swappedObject, gemsToTransform, allGemsToExplode, () => {
            // CALLBACK SAU KHI VFX XONG:
            // 1. Thực sự biến hình và kích hoạt nổ logic
            gemsToTransform.forEach(gem => {
                this.transformIntoPowerup(gem, GEM_TYPES.BOMB)
                this.activateBomb(gem, allGemsToExplode)
            })
            // 2. Xóa và Gravity
            this.removeGemSprites(allGemsToExplode)
            this.applyGravityAndRefill()
        })
      } else {
        // Fallback Code 2 cũ
        gemsToTransform.forEach(gem => {
            this.transformIntoPowerup(gem, GEM_TYPES.BOMB)
            this.activateBomb(gem, allGemsToExplode)
        })
        this.addWiggleEffect(Array.from(allGemsToExplode), () => {
            this.removeGemSprites(allGemsToExplode)
            this.scene.time.delayedCall(300, () => this.applyGravityAndRefill())
        })
      }
      return

    } 
    // Case 3: CB + Gem Thường (Hút màu)
    else {
      const targetColor = swappedObjectType
      gemsToRemove.add(colorBombObject)
      
      // [FIX] Tách bước: Tìm gem -> VFX -> Xóa
      const affectedGems = new Set()

      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const gem = this.grid[r][c]
          if (gem && gem.type === 'gem' && (gem.value === targetColor || gem === swappedObject)) {
             // Thu thập gem bị ảnh hưởng
             affectedGems.add(gem)
          }
        }
      }

      if (this.powerupVFXManager) {
        // Gọi VFX Hút
        this.powerupVFXManager.playColorBombEffect(colorBombObject, affectedGems, () => {
            // CALLBACK SAU KHI HÚT XONG:
            // Duyệt lại để gây damage (tính điểm, phá blocker) và đưa vào list xóa
            affectedGems.forEach(gem => {
                const r = gem.sprite.getData('row')
                const c = gem.sprite.getData('col')
                const destroyedGem = this.damageCell(r, c) // Quan trọng: Gọi damageCell để xử lý logic game
                if (destroyedGem) gemsToRemove.add(destroyedGem)
            })
            // Đảm bảo color bomb cũng bị xóa
            gemsToRemove.add(colorBombObject)

            this.removeGemSprites(gemsToRemove)
            this.applyGravityAndRefill()
        })
      } else {
        // Fallback Code 2 cũ
        this.playSound(SOUND_KEYS.SPIN_COLLECT)
        affectedGems.forEach(gem => {
            const r = gem.sprite.getData('row')
            const c = gem.sprite.getData('col')
            const destroyedGem = this.damageCell(r, c)
            if (destroyedGem) gemsToRemove.add(destroyedGem)
        })
        this.addWiggleEffect(Array.from(gemsToRemove), () => {
          this.removeGemSprites(gemsToRemove)
          this.scene.time.delayedCall(300, () => {
            this.applyGravityAndRefill()
          })
        })
      }
    }
  }
  
  // ... (Giữ nguyên các hàm damageCell, damageCellIgnoreBlocker, forceDestroyCell...)
  
  damageCell(row, col) {
    if (!this.isValidCell || !this.isValidCell(row, col)) return null
    const blocker = this.blockerGrid?.[row]?.[col]
    if (blocker) {
      const blockerDestroyed = blocker.takeDamage()
      if (blockerDestroyed) {
        this.blockerGrid[row][col] = null
        if (blocker.type) {
          this.updateObjectiveProgress && this.updateObjectiveProgress('blocker', blocker.type)
        }
        if (blocker.type === 'rope') this.ropeDestroyedThisTurn = true
      } else {
        return null
      }
    }
    const gem = this.grid[row]?.[col]
    if (gem && gem.type === 'gem') {
      return gem
    }
    return null
  }

  damageCellIgnoreBlocker(row, col) {
    if (!this.isValidCell || !this.isValidCell(row, col)) return null
    const blocker = this.blockerGrid?.[row]?.[col]
    if (blocker) {
      const blockerDestroyed = blocker.takeDamage()
      if (blockerDestroyed) {
        this.blockerGrid[row][col] = null
        if (blocker.type) {
          this.updateObjectiveProgress && this.updateObjectiveProgress('blocker', blocker.type)
        }
        if (blocker.type === 'rope') this.ropeDestroyedThisTurn = true
      }
    }
    const gem = this.grid[row]?.[col]
    if (gem && gem.type === 'gem') {
      return gem
    }
    return null
  }

  forceDestroyCell(row, col) {
    if (!this.isValidCell(row, col)) return;
    const blocker = this.blockerGrid[row]?.[col];
    if (blocker) {
      playGameSfx(this.scene, blocker.type === 'rope' ? 'rope' : 'stone_break');
      if (blocker.type) {
        this.updateObjectiveProgress('blocker', blocker.type);
      }
      this.blockerGrid[row][col] = null; 
      if (blocker.type === 'rope') {
        this.ropeDestroyedThisTurn = true;
      }
      this.scene.tweens.add({
        targets: blocker,
        scale: 0,
        alpha: 0,
        duration: 200,
        onComplete: () => blocker.destroy()
      });
      if (!this.turnStats) this.turnStats = { gemCounts: {}, powerups: [] };
      this.turnStats.blockerTouched = true;
    }
    const gem = this.grid[row]?.[col];
    if (gem && gem.sprite) {
      this.scene.events.emit('gemsCleared', [{ x: gem.sprite.x, y: gem.sprite.y }]);
      const isPowerup = gem.value === GEM_TYPES.BOMB || gem.value === GEM_TYPES.STRIPE || gem.value === GEM_TYPES.COLOR_BOMB
      if (isPowerup) {
        const map = { [GEM_TYPES.BOMB]: 'bomb', [GEM_TYPES.STRIPE]: 'stripe', [GEM_TYPES.COLOR_BOMB]: 'color_bomb' }
        const key = map[gem.value] || String(gem.value).toLowerCase()
        this.updateObjectiveProgress('powerup', key, 1)
      } else {
        this.updateObjectiveProgress('gem', gem.value, 1)
      }
      this.grid[row][col] = null; 
      this.scene.tweens.add({
        targets: gem.sprite,
        scale: 0,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          if (gem.sprite) gem.sprite.destroy();
        }
      });
      if (!this.turnStats) this.turnStats = { gemCounts: {}, powerups: [] };
      const color = gem.value;
      this.turnStats.gemCounts[color] = (this.turnStats.gemCounts[color] || 0) + 1;
    }
  }

  useHammer(row, col) {
    if (this.boardBusy) return;
    this.boardBusy = true;
    this.scene.input.enabled = false;
    this.turnStats = { gemCounts: {}, powerups: [] };
    playGameSfx(this.scene, 'hammer');
    this.forceDestroyCell(row, col);
    this.scene.time.delayedCall(250, () => {
        this.recalculateBlockerCounts();
        if (this.scene && this.scene.game && this.scene.game.events) {
          this.scene.game.events.emit('matchSummary', {
            gemCounts: this.turnStats.gemCounts,
            blockerCounts: this.blockerCounts || {},
            powerups: this.turnStats.powerups
          })
        }
        this.applyGravityAndRefill();
    });
  }
  
  useRocket(row, col) { 
    if (this.boardBusy) return;
    this.boardBusy = true;
    this.scene.input.enabled = false;
    this.turnStats = { gemCounts: {}, powerups: [] };
    const affectedColumns = [col]; 
    if (col > 0) affectedColumns.push(col - 1);
    if (col < this.gridSize - 1) affectedColumns.push(col + 1);
    const gemsToRemove = new Set();
    affectedColumns.forEach(currentCol => {
      for (let r = 0; r < this.gridSize; r++) {
        const destroyedGem = this.damageCell(r, currentCol);
        if (destroyedGem) {
          gemsToRemove.add(destroyedGem);
        }
      }
    });
    this.removeGemSprites(gemsToRemove);
    this.scene.time.delayedCall(250, () => {
      const gemCounts = {};
      gemsToRemove.forEach(gem => {
        if (gem && gem.value && !this.isPowerup(gem)) {
          gemCounts[gem.value] = (gemCounts[gem.value] || 0) + 1;
        }
      });
      for (const type in gemCounts) {
        this.updateObjectiveProgress('gem', type, gemCounts[type]);
      }
      this.recalculateBlockerCounts();
      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('matchSummary', {
          gemCounts: gemCounts,
          blockerCounts: this.blockerCounts || {},
          powerups: this.turnStats.powerups || []
        })
      }
      this.applyGravityAndRefill();
    });
  }

  useSwap(gem1, gem2) {
    if (this.boardBusy) return
    this.swapGems(gem1, gem2, { isBooster: true })
  }

  useShuffle() {
    if (this.boardBusy) return
    this.boardBusy = true
    this.scene.input.enabled = false
    const allGems = []
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c] && this.grid[r][c].type === 'gem') {
          allGems.push(this.grid[r][c])
        }
      }
    }
    Phaser.Utils.Array.Shuffle(allGems)
    let idx = 0
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c] && this.grid[r][c].type === 'gem') {
          const g = allGems[idx++]
          this.grid[r][c] = g
          g.sprite.setData({ row: r, col: c })
          this.scene.tweens.add({
            targets: g.sprite,
            x: this.offsetX + c * this.cellSize + this.cellSize / 2,
            y: this.offsetY + r * this.cellSize + this.cellSize / 2,
            duration: 500,
            ease: 'Power2'
          })
        }
      }
    }
  }
  
  damageBlockerAt(row, col) {
    const blocker = this.blockerGrid?.[row]?.[col]
    if (!blocker) return
    const destroyed = blocker.takeDamage()
    if (destroyed) {
      this.blockerGrid[row][col] = null
      if (blocker.type === 'rope') this.ropeDestroyedThisTurn = true
    }
  }

  getGemsInArea(centerRow, centerCol, radius) {
    const gemsInArea = []
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
          const gem = this.grid[r][c]
          if (gem) gemsInArea.push(gem)
        }
      }
    }
    return gemsInArea
  }
}
