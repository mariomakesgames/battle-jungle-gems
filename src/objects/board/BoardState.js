// src/objects/board/BoardState.js
import Phaser from 'phaser'
import { GEM_TYPES, GRID_SIZE, SCORE_VALUES } from '../../utils/constants'
import AudioManager from '../../managers/AudioManager'
import { SOUND_KEYS } from '../../utils/SoundAssets'

export class BoardState {
  initGrid() {
    this.grid = []
    this.blockerGrid = []
    this.isGravityEffectRunning = false // Cờ chặn auto match khi gravity effect đang chạy
    this.objectives = {}; // << THÊM: Biến theo dõi nhiệm vụ
    // Theo dõi bổ sung
    this.powerupActivations = {}; // { bomb: n, stripe: n, color_bomb: n }
    this.blockerCounts = {}; // { stone: n, rope: n, ... }
    this.levelWon = false; // Cờ thắng để tránh emit nhiều lần
    // Theo dõi move
    this.movesRemaining = null;
    this.isMoveBasedLevel = false;
    this.levelFailed = false; // Cờ thua để tránh emit nhiều lần
    this.chainLevel = 1; // Đếm chuỗi phản ứng hiện tại
    // << [AUTO SHUFFLE FIX] Đếm số lần shuffle thất bại liên tiếp để tránh vòng lặp vô hạn >>
    this.consecutiveShuffleFailures = 0;
    // << THÊM MỚI: Hàng đợi power-up chain reaction >>
    this.powerupChainQueue = []; // Lưu các power-up cần kích hoạt sau
    this.isProcessingPowerupChain = false; // Cờ đang xử lý chain
    for (let row = 0; row < GRID_SIZE; row++) {
      this.grid[row] = []
      this.blockerGrid[row] = []
      for (let col = 0; col < GRID_SIZE; col++) {
        this.grid[row][col] = null
        this.blockerGrid[row][col] = null
      }
    }
  }


  clearBoard() {
    this.gems.forEach(gem => { if (gem && gem.destroy) gem.destroy() })
    this.gems = []
    this.blockers.forEach(blocker => { if (blocker && blocker.destroy) blocker.destroy() })
    this.blockers = []
    // Hủy các blocker OOP trong blockerGrid nếu còn
    if (this.blockerGrid) {
      for (let r = 0; r < this.blockerGrid.length; r++) {
        for (let c = 0; c < this.blockerGrid[r].length; c++) {
          const b = this.blockerGrid[r][c]
          if (b && b.destroy) b.destroy()
        }
      }
    }
    this.scene.children.list.forEach(child => {
      if (child.getData && child.getData('isCell')) child.destroy()
    })
    this.selectionFrame && this.selectionFrame.setVisible(false)
    this.selectedGem = null
    // << [AUTO SHUFFLE FIX] Reset bộ đếm shuffle thất bại khi clear board >>
    this.consecutiveShuffleFailures = 0
    this.initGrid()
  }

  // << THÊM HÀM MỚI: Khởi tạo bộ theo dõi nhiệm vụ >>
  initializeObjectives(levelData) {
    this.objectives = {};
    if (!levelData) return;

    const levelObjectives = levelData.objectives;
    if (levelObjectives) {
      levelObjectives.forEach(obj => {
        const key = `${obj.target}_${obj.type}`;
        this.objectives[key] = { ...obj, remaining: obj.count };
      });
      console.log('Objectives initialized:', this.objectives);
    }

    // Khởi tạo move-based level nếu có maxMoves
    if (levelData.maxMoves !== undefined && levelData.maxMoves !== null) {
      this.movesRemaining = levelData.maxMoves;
      this.isMoveBasedLevel = true;
      console.log('Move-based level initialized with', this.movesRemaining, 'moves');
      
      // --- XÓA HOẶC COMMENT ĐOẠN NÀY ĐỂ TRÁNH LỖI ---
      // Lý do: UIScene đã tự lấy giá trị ban đầu khi khởi tạo (create).
      // Việc emit ở đây gây xung đột khi Scene chưa sẵn sàng render.
      
      /* if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('moveUpdated', this.movesRemaining);
      }
      */
      // -----------------------------------------------
    }

    // Cập nhật đếm blocker hiện có trên bảng ngay khi khởi tạo mục tiêu
    this.recalculateBlockerCounts();
  }

  // << THÊM HÀM MỚI: Cập nhật tiến trình và phát sự kiện >>
  updateObjectiveProgress(target, type, count = 1) {
    const key = `${target}_${type}`;
    if (this.objectives[key] && this.objectives[key].remaining > 0) {
      this.objectives[key].remaining -= count;
      
      // Đảm bảo không bị số âm
      if (this.objectives[key].remaining < 0) {
        this.objectives[key].remaining = 0;
      }

      console.log(`Objective updated: ${key}, remaining: ${this.objectives[key].remaining}`);
      
      // Phát sự kiện toàn cục để UIScene lắng nghe
      this.scene.game.events.emit('objectiveUpdated', {
        key: key,
        remaining: this.objectives[key].remaining
      });
      // KHÔNG kiểm tra thắng ở đây - chỉ kiểm tra ở endOfTurn khi board rảnh
    }
  }

  // Xác định xem tất cả mục tiêu đã hoàn thành chưa
  areAllObjectivesCompleted() {
    if (!this.objectives) return false;
    return Object.values(this.objectives).every(obj => (obj?.remaining ?? 0) <= 0);
  }

  // Tính lại số lượng blocker CÒN TRÊN MAP và đồng bộ vào objective (remaining = 0 mới hoàn thành)
  recalculateBlockerCounts() {
    const counts = {};
    for (let r = 0; r < this.blockerGrid.length; r++) {
      for (let c = 0; c < this.blockerGrid[r].length; c++) {
        const b = this.blockerGrid[r][c];
        if (b && b.type) {
          counts[b.type] = (counts[b.type] || 0) + 1;
        }
      }
    }
    // Đảm bảo blockerCounts có cả các type có objective dù còn 0 (để UI/matchSummary đúng)
    const objectiveBlockerTypes = (this.objectives && Object.keys(this.objectives).filter(k => k.startsWith('blocker_')).map(k => k.replace('blocker_', ''))) || [];
    objectiveBlockerTypes.forEach(t => { if (counts[t] === undefined) counts[t] = 0; });
    this.blockerCounts = counts;
    // Đồng bộ objective blocker theo số còn trên map (dây leo sinh sôi thì remaining tăng)
    const typesToSync = new Set([...Object.keys(counts), ...objectiveBlockerTypes]);
    typesToSync.forEach(type => {
      const remaining = counts[type] || 0;
      const key = `blocker_${type}`;
      if (this.objectives && this.objectives[key]) {
        this.objectives[key].remaining = remaining;
        if (this.scene && this.scene.game && this.scene.game.events) {
          this.scene.game.events.emit('objectiveUpdated', { key, remaining });
        }
      }
      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('blockerCountUpdated', { type, remaining });
      }
    });
  }

  // Ghi nhận MỘT LẦN KÍCH HOẠT power-up và CẬP NHẬT NHIỆM VỤ ngay lập tức
  trackPowerupActivation(powerupType) {
    if (!powerupType) return;
    const map = {
      [GEM_TYPES.BOMB]: 'bomb',
      [GEM_TYPES.STRIPE]: 'stripe',
      [GEM_TYPES.COLOR_BOMB]: 'color_bomb'
    };
    const key = map[powerupType] || String(powerupType).toLowerCase();

    // 1. Cập nhật vào bộ theo dõi (giữ nguyên)
    this.powerupActivations[key] = (this.powerupActivations[key] || 0) + 1;
    
    // << LOGIC MỚI: CẬP NHẬT NHIỆM VỤ NGAY TẠI ĐÂY >>
    // Đây là nơi duy nhất chúng ta đếm power-up được kích hoạt.
    console.log(`[Objective] Power-up ACTIVATED, updating objective for: ${key}`);
    this.updateObjectiveProgress('powerup', key, 1);

    // 2. Phát sự kiện (giữ nguyên)
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('powerupActivated', { type: key, count: this.powerupActivations[key] });
    }
  }

  // -----------------------------------------------------------------------
  // [NEW LOGIC] AUTO SHUFFLE
  // -----------------------------------------------------------------------

  /**
   * [AUTO SHUFFLE FIX] Thực hiện xáo trộn logic dữ liệu cho đến khi tìm được bảng có nước đi.
   * Không có hiệu ứng hình ảnh ở đây, chỉ xử lý data.
   * 
   * BẢN SỬA LỖI:
   * - Tăng số lần thử lên 50 (từ 20)
   * - Ưu tiên tìm board tĩnh (không có match ngay)
   * - Sau 40 lần thử mà vẫn không tìm được, chấp nhận board có match để tránh deadlock
   * 
   * @returns {boolean} true nếu tìm được board hợp lệ, false nếu thất bại
   */
  shuffleGridLogic() {
    const allGems = []

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const gem = this.grid[r][c]
        const blocker = this.blockerGrid?.[r]?.[c]
        const isSolidStone = blocker && blocker.type === 'stone' && blocker.health === 2
        if (gem && gem.type === 'gem' && !isSolidStone) {
          allGems.push(gem)
        }
      }
    }

    if (allGems.length === 0) {
      console.warn('Shuffle: No gems to shuffle!')
      return false
    }

    let attempt = 0
    let validBoardFound = false

    while (!validBoardFound && attempt < 50) { // Tăng lên 50 lần thử
      Phaser.Utils.Array.Shuffle(allGems)
      let idx = 0

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const blocker = this.blockerGrid?.[r]?.[c]
          const isSolidStone = blocker && blocker.type === 'stone' && blocker.health === 2
          const currentObj = this.grid[r][c]
          if (currentObj && currentObj.type === 'gem' && !isSolidStone) {
            const newGem = allGems[idx++]
            this.grid[r][c] = newGem
          }
        }
      }

      const matchGroups = this.findAllMatches() // Check match tĩnh
      const hasMoves = typeof this.hasPossibleMoves === 'function' ? this.hasPossibleMoves() : false

      // ĐIỀU KIỆN CHUẨN: Có nước đi VÀ Không tự nổ (ưu tiên tuyệt đối)
      if (hasMoves && matchGroups.length === 0) {
        validBoardFound = true
      }
      // Nếu quá bí (thử 40 lần không được), đành chấp nhận có match nổ ngay
      // để tránh game bị tắc, nhưng vẫn yêu cầu phải có nước đi
      else if (attempt >= 40 && hasMoves) {
        console.warn(`Shuffle: Accepting board with matches after ${attempt} attempts to avoid deadlock`)
        validBoardFound = true
      }

      attempt++
    }

    if (!validBoardFound) {
      console.error('⚠️ Shuffle: Could not find valid board after 50 attempts! Potential deadlock.')
      return false
    }

    console.log(`✅ Shuffle logic completed after ${attempt} attempts (matches: ${this.findAllMatches().length})`)
    return true
  }

  /**
   * Đồng bộ vị trí sprite thật theo dữ liệu lưới sau khi shuffle.
   */
  applyShuffleResultsToSprites() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const gem = this.grid[r][c]
        if (gem && gem.sprite) {
          const targetX = this.offsetX + c * this.cellSize + this.cellSize / 2
          const targetY = this.offsetY + r * this.cellSize + this.cellSize / 2
          gem.sprite.setData({ row: r, col: c, type: gem.value, isGem: true })
          gem.sprite.x = targetX
          gem.sprite.y = targetY
          gem.sprite.setVisible(true)
          gem.sprite.setDisplaySize(this.cellSize * 0.85, this.cellSize * 0.85)
        }
      }
    }
  }

  /**
   * [AUTO SHUFFLE FIX] Kích hoạt quy trình Auto Shuffle: Khóa bảng -> VFX -> Logic Shuffle -> Cập nhật Sprite
   * 
   * BẢN SỬA LỖI:
   * - Kiểm tra lại sau khi shuffle xem có nước đi không
   * - Đếm số lần thất bại liên tiếp
   * - Nếu thất bại 3 lần liên tiếp -> Game Over (tránh vòng lặp vô hạn)
   */
  triggerAutoShuffle() {
    console.log('⚠️ No moves left! Triggering Auto Shuffle... (Attempt #' + (this.consecutiveShuffleFailures + 1) + ')')

    this.boardBusy = true
    if (this.scene && this.scene.input) {
      this.scene.input.enabled = false
    }
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('boardBusy', true)
    }

    const allGemSprites = []
    const allBlockerSprites = []

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const gem = this.grid[r]?.[c]
        if (gem && gem.sprite) {
          allGemSprites.push(gem.sprite)
        }

        const blocker = this.blockerGrid[r]?.[c]
        if (blocker) {
          allBlockerSprites.push(blocker)
        }
      }
    }

    const finalizeShuffle = () => {
      // Thực hiện shuffle logic và kiểm tra kết quả
      const shuffleSuccess = this.shuffleGridLogic()
      
      if (!shuffleSuccess) {
        console.error('❌ Shuffle logic failed!')
      }
      
      // Áp dụng kết quả shuffle lên sprite
      this.applyShuffleResultsToSprites()
      allBlockerSprites.forEach(blocker => {
        if (blocker && blocker.setVisible) blocker.setVisible(true)
      })
      
      // << LOGIC MỚI: Kiểm tra lại sau shuffle >>
      // Delay một chút để người chơi thấy animation xong rồi mới check
      this.scene.time.delayedCall(300, () => {
        if (!this.hasPossibleMoves()) {
          this.consecutiveShuffleFailures++
          console.error(`❌ Shuffle failed! No valid moves after shuffle. (Failure #${this.consecutiveShuffleFailures})`)
          
          // Nếu thất bại 3 lần liên tiếp -> Game Over
          if (this.consecutiveShuffleFailures >= 3) {
            console.error('💀 GAME OVER: Cannot generate valid moves after 3 shuffle attempts!')
            
            // Mở khóa board để tránh UI bị treo
            this.boardBusy = false
            if (this.scene && this.scene.input) {
              this.scene.input.enabled = true
            }
            if (this.scene && this.scene.game && this.scene.game.events) {
              this.scene.game.events.emit('boardBusy', false)
              // Phát sự kiện thua game
              this.scene.game.events.emit('levelFailed')
            }
            return
          }
          
          // Thử shuffle lại (đệ quy có kiểm soát)
          console.log('🔄 Retrying shuffle...')
          this.scene.time.delayedCall(500, () => this.triggerAutoShuffle())
          return
        }
        
        // Nếu shuffle thành công, reset bộ đếm thất bại
        if (this.consecutiveShuffleFailures > 0) {
          console.log(`✅ Shuffle successful after ${this.consecutiveShuffleFailures + 1} attempts! Resetting failure counter.`)
        }
        this.consecutiveShuffleFailures = 0
        
        // Tiếp tục game bình thường
        this.checkForNewMatches()
      })
    }

    if (this.scene?.boosterVFXManager?.playFakeShuffleEffect) {
      this.scene.boosterVFXManager.playFakeShuffleEffect(allGemSprites, allBlockerSprites, finalizeShuffle)
    } else {
      finalizeShuffle()
    }
  }

  createGem(row, col, gemType) {
    const gemSprite = this.createGemAt(row, col, gemType)
    this.grid[row][col] = { type: 'gem', value: gemType, sprite: gemSprite }
  }

  createGemAt(row, col, gemType, startY) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = startY !== undefined ? startY : this.offsetY + row * this.cellSize + this.cellSize / 2
    console.log(`Creating gem ${gemType} at row:${row}, col:${col}, x:${x}, y:${y}`)
    const gemTextureKey = `gem_${gemType}`
    
    const gem = this.gemLayer.add(
      this.scene.make.image({ x, y, key: gemTextureKey, add: false })
    )
    gem.setDisplaySize(this.cellSize * 0.85, this.cellSize * 0.85)
      .setInteractive()
      .setDepth(2)
    gem.setData({ row, col, type: gemType, isGem: true })
    // Input click được xử lý tập trung tại GameScene (tap/swipe router)
    // Vô hiệu hóa handler cũ để tránh dẫm chân nhau
    // gem.on('pointerdown', () => {
    //   const currentRow = gem.getData('row')
    //   const currentCol = gem.getData('col')
    //   this.handleGemClick(currentRow, currentCol)
    // })
    this.gems.push(gem)
    return gem
  }

  fillEmptyCells() {
    const availableGems = this.levelData.availableGems || Object.values(GEM_TYPES)
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.grid[row][col] && this.grid[row][col].type === 'empty') {
          const randomGemType = availableGems[Math.floor(Math.random() * availableGems.length)]
          this.createGem(row, col, randomGemType)
        }
      }
    }
  }

  updateGridAfterSwap(gem1, gem2) {
    const gem1Row = gem1.sprite.getData('row')
    const gem1Col = gem1.sprite.getData('col')
    const gem2Row = gem2.sprite.getData('row')
    const gem2Col = gem2.sprite.getData('col')
    this.grid[gem1Row][gem1Col] = gem2
    this.grid[gem2Row][gem2Col] = gem1
    gem1.sprite.setData({ row: gem2Row, col: gem2Col })
    gem2.sprite.setData({ row: gem1Row, col: gem1Col })
  }

  swapGems(gem1, gem2, options = {}) {
    if (this.boardBusy) return
    this.boardBusy = true
    this.scene.input.enabled = false

    // << [AUDIO] Phát âm thanh swap - kiểm tra volume từ Setting >>
    const sfxVolume = AudioManager.getSoundVolume()
    if (sfxVolume > 0 && this.scene && this.scene.sound) {
      this.scene.sound.play(SOUND_KEYS.SWAP_GEM, { volume: sfxVolume })
    }

    // Báo cho UI biết board đang bận xử lý
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('boardBusy', true)
    }
    this.selectedGem = null
    this.selectionFrame.setVisible(false)
    const gem1Sprite = gem1.sprite
    const gem2Sprite = gem2.sprite
    const gem1InitialX = gem1Sprite.x
    const gem1InitialY = gem1Sprite.y
    // Ghi nhớ vị trí ĐÍCH: vị trí ban đầu của gem2 (gem1 sẽ di chuyển tới đây)
    const swapPosition = { row: gem2Sprite.getData('row'), col: gem2Sprite.getData('col') }
    this.scene.tweens.add({ targets: gem1Sprite, x: gem2Sprite.x, y: gem2Sprite.y, duration: 300, ease: 'Power2' })
    this.scene.tweens.add({
      targets: gem2Sprite,
      x: gem1InitialX,
      y: gem1InitialY,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.updateGridAfterSwap(gem1, gem2)
        this.decideActionAfterSwap(gem1, gem2, swapPosition, options)
      }
    })
  }

  // Hoán đổi trả lại khi không có match/power-up được kích hoạt
  swapBack(gem1, gem2) {
    const gem1Sprite = gem1.sprite
    const gem2Sprite = gem2.sprite
    const gem1CurrentX = gem1Sprite.x
    const gem1CurrentY = gem1Sprite.y
    const gem2CurrentX = gem2Sprite.x
    const gem2CurrentY = gem2Sprite.y
    // Đưa sprite quay về vị trí ban đầu (đang là vị trí của sprite còn lại)
    this.scene.tweens.add({ targets: gem1Sprite, x: gem2CurrentX, y: gem2CurrentY, duration: 250, ease: 'Power2' })
    this.scene.tweens.add({
      targets: gem2Sprite,
      x: gem1CurrentX,
      y: gem1CurrentY,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        // Cập nhật lại grid về trạng thái trước swap
        this.updateGridAfterSwap(gem1, gem2)
        // Mở khóa ngay, KHÔNG tính là kết thúc lượt
        this.boardBusy = false
        this.scene.input.enabled = true
        if (this.scene && this.scene.game && this.scene.game.events) {
          this.scene.game.events.emit('boardBusy', false)
        }
      }
    })
  }

  decideActionAfterSwap(gem1, gem2, swapPosition, options = {}) {
    let powerupToActivate = null
    let otherGem = null

    // Sau khi cập nhật grid, lấy lại 2 viên ở vị trí mới
    const gem1AtNewPos = this.grid[gem1.sprite.getData('row')][gem1.sprite.getData('col')]
    const gem2AtNewPos = this.grid[gem2.sprite.getData('row')][gem2.sprite.getData('col')]

    // Luôn xác định match sau swap
    const matchGroups = this.findAllMatches()

    // Chỉ xác định power-up cần kích hoạt nếu KHÔNG phải booster swap
    if (!options.isBooster) {
      if (this.isPowerup(gem1AtNewPos)) {
        powerupToActivate = gem1AtNewPos
        otherGem = gem2AtNewPos
      } else if (this.isPowerup(gem2AtNewPos)) {
        powerupToActivate = gem2AtNewPos
        otherGem = gem1AtNewPos
      }
    }

    // Chỉ swap back khi không có match và không kích hoạt power-up, và không phải booster
    if (matchGroups.length === 0 && !powerupToActivate && !options.isBooster) {
      this.swapBack(gem1, gem2)
      return
    }

    // Swap hợp lệ: trừ move (nếu không phải booster)
    if (!options.isBooster) {
      this.decrementMove();
    }

    // << [AUTO SHUFFLE FIX] Reset bộ đếm shuffle thất bại khi người chơi thực hiện swap hợp lệ >>
    this.consecutiveShuffleFailures = 0;

    this.chainLevel = 1;

    this.scene.events.emit('swapAccepted', { special: matchGroups.some(group => group.length >= 4) });
    this.startActionChain(matchGroups, powerupToActivate, otherGem, swapPosition)
  }

  startActionChain(initialMatchGroups, powerupToActivate, otherGem, swapPosition) {
    let allGemsToRemove = new Set()
    let powerupsToCreate = []
    const activatedPowerups = new Set()
    
    // [FIX 1] Tạo biến riêng để lưu gem từ Match-3 thường
    const matchGemsToRemove = new Set()
    
    // Giữ lại tham chiếu đến các gem bị nổ bởi power-up
    let explosionSet = new Set()

    // Luôn xử lý match và lên kế hoạch tạo power-up
    if (initialMatchGroups.length > 0) {
      const { gemsRemoved, powerupsCreated } = this.processMatchGroups(initialMatchGroups, swapPosition)
      gemsRemoved.forEach(gem => {
          allGemsToRemove.add(gem)
          matchGemsToRemove.add(gem) // [FIX 2] Lưu gem match-3 vào đây
      })
      powerupsToCreate = powerupsCreated
    }

    // Luôn xử lý kích hoạt power-up
    if (powerupToActivate) {
      explosionSet = this.getPowerupActivationSet(powerupToActivate, otherGem)
      explosionSet.forEach(gem => allGemsToRemove.add(gem))
    }
    
    let isActionChainCompleted = false
    const onVFXComplete = () => {
      if (isActionChainCompleted) return

      // --- BƯỚC MỚI: Thực hiện damageCell cho các vùng đã lưu SAU VFX ---
      let finalGemsToRemove = new Set()
      
      // Xử lý Bomb+Bomb combo
      const isBombCombo = powerupToActivate && otherGem && powerupToActivate.value === GEM_TYPES.BOMB && otherGem.value === GEM_TYPES.BOMB
      if (isBombCombo && this.bombComboCenter) {
        const center = this.bombComboCenter
        for (let r = center.row - 2; r <= center.row + 2; r++) {
          for (let c = center.col - 2; c <= center.col + 2; c++) {
            const destroyedGem = this.damageCell(r, c)
            if (destroyedGem) finalGemsToRemove.add(destroyedGem)
          }
        }
        finalGemsToRemove.add(powerupToActivate)
        finalGemsToRemove.add(otherGem)
        this.bombComboCenter = null
      }
      // Xử lý các power-up combo và đơn lẻ khác
      else if (this.damageAreasAfterVFX) {
        const area = this.damageAreasAfterVFX
        
        switch (area.type) {
          case 'stripe_stripe': {
            const { row, col } = area
            for (let c = 0; c < GRID_SIZE; c++) {
              const destroyedGem = this.damageCell(row, c)
              if (destroyedGem) finalGemsToRemove.add(destroyedGem)
            }
            for (let r = 0; r < GRID_SIZE; r++) {
              if (r === row) continue
              const destroyedGem = this.damageCell(r, col)
              if (destroyedGem) finalGemsToRemove.add(destroyedGem)
            }
            break
          }
          case 'bomb_stripe': {
            const { row, col, direction } = area
            if (direction === 'horizontal') {
              for (let r = row - 1; r <= row + 1; r++) {
                if (r < 0 || r >= GRID_SIZE) continue
                for (let c = 0; c < GRID_SIZE; c++) {
                  const destroyedGem = this.damageCell(r, c)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            } else {
              for (let c = col - 1; c <= col + 1; c++) {
                if (c < 0 || c >= GRID_SIZE) continue
                for (let r = 0; r < GRID_SIZE; r++) {
                  const destroyedGem = this.damageCell(r, c)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            }
            break
          }
          case 'colorbomb_stripe': {
            const { gems, directions } = area
            gems.forEach(gem => {
              const row = gem.sprite.getData('row')
              const col = gem.sprite.getData('col')
              const isHorizontal = directions.get(gem)
              if (isHorizontal) {
                for (let c = 0; c < GRID_SIZE; c++) {
                  const destroyedGem = this.damageCell(row, c)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              } else {
                for (let r = 0; r < GRID_SIZE; r++) {
                  const destroyedGem = this.damageCell(r, col)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            })
            break
          }
          case 'colorbomb_bomb': {
            const { gems } = area
            gems.forEach(gem => {
              const r = gem.sprite.getData('row')
              const c = gem.sprite.getData('col')
              for (let rr = r - 1; rr <= r + 1; rr++) {
                for (let cc = c - 1; cc <= c + 1; cc++) {
                  const destroyedGem = this.damageCell(rr, cc)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            })
            break
          }
          case 'bomb_single': {
            const { row, col } = area
            for (let rr = row - 1; rr <= row + 1; rr++) {
              for (let cc = col - 1; cc <= col + 1; cc++) {
                if (rr === row && cc === col) continue
                const destroyedGem = this.damageCell(rr, cc)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            }
            break
          }
          case 'colorbomb_single': {
            const { targetColor, otherGem } = area
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const gem = this.grid[r][c]
                if (gem && gem.type === 'gem' && !this.isPowerup(gem) && gem.value === targetColor) {
                  const destroyedGem = this.damageCellIgnoreBlocker(r, c)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            }

            // [FIX] Chỉ xử lý otherGem nếu sprite còn hợp lệ
            if (otherGem && otherGem.sprite && otherGem.sprite.active) {
              const dRow = otherGem.sprite.getData('row')
              const dCol = otherGem.sprite.getData('col')
              const destroyedOtherGem = this.damageCellIgnoreBlocker(dRow, dCol)
              if (destroyedOtherGem) finalGemsToRemove.add(destroyedOtherGem)
            }
            break
          }
          case 'stripe_single': {
            const { row, col, isHorizontal } = area
            if (isHorizontal) {
              for (let c = 0; c < GRID_SIZE; c++) {
                if (c === col) continue
                const destroyedGem = this.damageCell(row, c)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            } else {
              for (let r = 0; r < GRID_SIZE; r++) {
                if (r === row) continue
                const destroyedGem = this.damageCell(r, col)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            }
            break
          }
        }
        
        // Thêm các power-up gốc vào danh sách xóa
        if (powerupToActivate) finalGemsToRemove.add(powerupToActivate)
        if (otherGem && this.isPowerup(otherGem)) finalGemsToRemove.add(otherGem)
        
        // [FIX 3] QUAN TRỌNG: Gộp gem Match-3 vào danh sách xóa cuối cùng
        matchGemsToRemove.forEach(gem => finalGemsToRemove.add(gem))
        
        this.damageAreasAfterVFX = null
      }
      // Không có power-up, chỉ có match thường
      else {
        finalGemsToRemove = allGemsToRemove
      }

      // << CHAIN REACTION >> Giữ lại các power-up bị phá cho chain, không xóa ngay
      if (this.destroyedPowerupsThisActivation && this.destroyedPowerupsThisActivation.length > 0) {
        this.destroyedPowerupsThisActivation.forEach(info => {
          if (info && info.gem) {
            finalGemsToRemove.delete(info.gem)
          }
        })
      }
      
      isActionChainCompleted = true

      // --- Đếm gem thường để cập nhật objective ---
      const gemCounts = {}
      const countedGems = new Set()
      if (initialMatchGroups.length > 0) {
        initialMatchGroups.forEach(group => {
          group.forEach(gem => {
            if (gem && gem.value && !this.isPowerup(gem)) {
              gemCounts[gem.value] = (gemCounts[gem.value] || 0) + 1
              countedGems.add(gem)
            }
          })
        })
      }
      finalGemsToRemove.forEach(gem => {
        if (gem && gem.value && !countedGems.has(gem) && !this.isPowerup(gem)) {
          gemCounts[gem.value] = (gemCounts[gem.value] || 0) + 1
        }
      })
      for (const type in gemCounts) {
        this.updateObjectiveProgress('gem', type, gemCounts[type])
      }

      // --- Tính điểm cho lượt hiện tại ---
      let pointsThisTurn = 0
      const multiplier = Math.pow(SCORE_VALUES.CHAIN_MULTIPLIER, Math.max(0, this.chainLevel - 1))
      const totalGemsRemoved = Object.values(gemCounts).reduce((sum, value) => sum + value, 0)

      pointsThisTurn += totalGemsRemoved * SCORE_VALUES.GEM_MATCH * multiplier

      if (powerupToActivate) {
        if (otherGem && this.isPowerup(otherGem)) {
          pointsThisTurn += SCORE_VALUES.POWERUP_ACTIVATE_COMBO * multiplier
        } else {
          pointsThisTurn += SCORE_VALUES.POWERUP_ACTIVATE_SINGLE * multiplier
        }
      }

      if (pointsThisTurn > 0 && this.scene && this.scene.game && this.scene.game.events) {
        console.log(`Chain ${this.chainLevel}: Adding ${pointsThisTurn} points! (Gems: ${totalGemsRemoved}, Multiplier: x${multiplier})`)
        this.scene.game.events.emit('addScore', pointsThisTurn)
      }

      // Xóa sprite theo tập cuối cùng
      this.removeGemSprites(finalGemsToRemove)
      this.createPowerupsAfterWiggle(powerupsToCreate)
      this.recalculateBlockerCounts()

      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('matchSummary', {
          gemCounts,
          blockerCounts: this.blockerCounts || {},
          powerups: Array.from(activatedPowerups).map(p => p.value)
        })
      }

      // << THÊM MỚI: Đưa các power-up bị phá vào hàng đợi chain reaction >>
      if (this.destroyedPowerupsThisActivation && this.destroyedPowerupsThisActivation.length > 0) {
        console.log(`⚡ Chain Reaction: ${this.destroyedPowerupsThisActivation.length} power-ups destroyed, adding to queue`)
        this.destroyedPowerupsThisActivation.forEach(info => {
          if (info && info.gem && info.gem.sprite && info.gem.sprite.active) {
            this.powerupChainQueue.push(info)
          }
        })
        this.destroyedPowerupsThisActivation = []
      }
      this.scene.time.delayedCall(150, () => { this.applyGravityAndRefill() })
    }

    if (powerupToActivate) {
      this.trackPowerupActivation(powerupToActivate.value);
      activatedPowerups.add(powerupToActivate);

      if (this.isPowerup(otherGem)) {
        this.trackPowerupActivation(otherGem.value);
        activatedPowerups.add(otherGem);
      }
        // KIỂM TRA TRƯỚC TIÊN: CÓ PHẢI LÀ COMBO KHÔNG?
        if (this.isPowerup(otherGem)) {
            const type1 = powerupToActivate.value
            const type2 = otherGem.value

            if (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.COLOR_BOMB) {
                // COMBO: COLOR_BOMB + COLOR_BOMB (Hút tất cả gems)
                this.powerupVFXManager.playDoubleColorBombEffect(powerupToActivate, otherGem, allGemsToRemove, onVFXComplete)
            }
            else if (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.BOMB) {
                this.powerupVFXManager.playDoubleBombEffect(powerupToActivate, otherGem, allGemsToRemove, onVFXComplete)
            } 
            else if (
              (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.STRIPE) ||
              (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.COLOR_BOMB)
            ) {
              const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerupToActivate : otherGem
              const stripeGem = (colorBomb === powerupToActivate) ? otherGem : powerupToActivate
              const gemsToTransform = this.gemsToTransformForVFX || new Set()
              this.powerupVFXManager.playColorBombStripeComboEffect(
                colorBomb,
                stripeGem,
                gemsToTransform,
                allGemsToRemove,
                onVFXComplete
              )
            }
            else if (
              (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.BOMB) ||
              (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.COLOR_BOMB)
            ) {
              const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerupToActivate : otherGem
              const bombGem = (colorBomb === powerupToActivate) ? otherGem : powerupToActivate
              const gemsToTransform = this.gemsToTransformForVFX || new Set()
              if (this.powerupVFXManager.playColorBombBombComboEffect) {
                this.powerupVFXManager.playColorBombBombComboEffect(
                  colorBomb,
                  bombGem,
                  gemsToTransform,
                  allGemsToRemove,
                  onVFXComplete
                )
              } else {
                this.addWiggleEffect(Array.from(allGemsToRemove), onVFXComplete)
              }
            }
            else if (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.STRIPE) {
              if (this.powerupVFXManager.playDoubleStripeEffect) {
                this.powerupVFXManager.playDoubleStripeEffect(powerupToActivate, otherGem, allGemsToRemove, onVFXComplete)
              } else {
                this.addWiggleEffect(Array.from(allGemsToRemove), onVFXComplete)
              }
            }
            else if (
              (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.STRIPE) ||
              (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.BOMB)
            ) {
              const direction = this.comboVFXDirection || 'horizontal'
              if (this.powerupVFXManager.playBombStripeComboEffect) {
                this.powerupVFXManager.playBombStripeComboEffect(
                  powerupToActivate,
                  otherGem,
                  direction,
                  allGemsToRemove,
                  onVFXComplete
                )
              } else {
                this.addWiggleEffect(Array.from(allGemsToRemove), onVFXComplete)
              }
              this.comboVFXDirection = null
            }
            else {
                this.addWiggleEffect(Array.from(allGemsToRemove), onVFXComplete)
            }
        }
        else {
            if (powerupToActivate.value === GEM_TYPES.BOMB) {
                this.powerupVFXManager.playBombEffect(powerupToActivate, allGemsToRemove, onVFXComplete)
            } else if (powerupToActivate.value === GEM_TYPES.COLOR_BOMB) {
                this.powerupVFXManager.playColorBombEffect(powerupToActivate, allGemsToRemove, onVFXComplete)
            } else if (powerupToActivate.value === GEM_TYPES.STRIPE) {
                this.powerupVFXManager.playStripeEffect(powerupToActivate, allGemsToRemove, onVFXComplete)
            } else {
                onVFXComplete()
            }
        }
    } 
    else if (allGemsToRemove.size > 0) {
        this.addWiggleEffect(Array.from(allGemsToRemove), onVFXComplete);
    } 
    else if (powerupsToCreate.length > 0) {
        onVFXComplete(); 
    } else {
        this.endOfTurn();
    }
  }

  // Biến đổi gem tại các vị trí đã chọn thành power-up sau khi hiệu ứng lắc hoàn tất
  createPowerupsAfterWiggle(powerupsToCreate) {
    powerupsToCreate.forEach(powerupInfo => {
      const row = powerupInfo.row
      const col = powerupInfo.col
      const gemAtPowerupPos = this.grid[row]?.[col]

      if (gemAtPowerupPos && gemAtPowerupPos.type === 'gem') {
        // Biến đổi viên gem hiện có thành power-up
        this.transformIntoPowerup(gemAtPowerupPos, powerupInfo.type)
        console.log(`Created ${powerupInfo.type} at ${row},${col}`)
      } else {
        // Nếu ô trống (trường hợp hiếm) thì tạo mới power-up
        this.createGem(row, col, powerupInfo.type)
      }
    })
  }

  processMatchGroups(matchGroups, swapPosition = null) {
    const gemsToRemoveFromMatch = new Set();
    const powerupsToCreate = [];

    matchGroups.forEach(group => {
      let powerupCreationPos = null;

      // ƯU TIÊN 1: Vị trí do người chơi SWAP vào
      if (swapPosition) {
        const gemAtSwapPos = this.grid[swapPosition.row]?.[swapPosition.col];
        if (gemAtSwapPos && group.includes(gemAtSwapPos)) {
          powerupCreationPos = swapPosition;
        }
      }

      // ƯU TIÊN 2: L/T-shape (điểm giao)
      if (!powerupCreationPos && group.length >= 4) {
        let intersectionGem = null;
        for (const gem of group) {
          const row = gem.sprite.getData('row');
          const col = gem.sprite.getData('col');
          const hasHorizontalNeighbor = group.find(g => g.sprite.getData('row') === row && Math.abs(g.sprite.getData('col') - col) === 1);
          const hasVerticalNeighbor = group.find(g => Math.abs(g.sprite.getData('row') - row) === 1 && g.sprite.getData('col') === col);
          if (hasHorizontalNeighbor && hasVerticalNeighbor) { intersectionGem = gem; break; }
        }
        if (intersectionGem) {
          powerupCreationPos = { row: intersectionGem.sprite.getData('row'), col: intersectionGem.sprite.getData('col') };
        }
      }

      // ƯU TIÊN 3: Đường thẳng, lấy giữa
      if (!powerupCreationPos && group.length >= 4) {
        if (group.length === 4) {
          const middleIndex = Phaser.Math.RND.pick([1, 2]);
          const middleGem = group[middleIndex];
          powerupCreationPos = { row: middleGem.sprite.getData('row'), col: middleGem.sprite.getData('col') };
        } else {
          const middleGem = group[Math.floor(group.length / 2)];
          powerupCreationPos = { row: middleGem.sprite.getData('row'), col: middleGem.sprite.getData('col') };
        }
      }

      // Quyết định loại power-up
      if (powerupCreationPos) {
        // Kiểm tra xem có phải L/T-shape không (đã tìm thấy intersection ở ƯU TIÊN 2)
        const isLTshape = group.length >= 4 && (() => {
          for (const gem of group) {
            const row = gem.sprite.getData('row');
            const col = gem.sprite.getData('col');
            const hasHorizontalNeighbor = group.find(g => g.sprite.getData('row') === row && Math.abs(g.sprite.getData('col') - col) === 1);
            const hasVerticalNeighbor = group.find(g => Math.abs(g.sprite.getData('row') - row) === 1 && g.sprite.getData('col') === col);
            if (hasHorizontalNeighbor && hasVerticalNeighbor) return true;
          }
          return false;
        })();
        
        if (isLTshape) {
          powerupsToCreate.push({ type: GEM_TYPES.BOMB, ...powerupCreationPos });
        } else if (group.length === 4) {
          powerupsToCreate.push({ type: GEM_TYPES.STRIPE, ...powerupCreationPos });
        } else if (group.length >= 5) {
          powerupsToCreate.push({ type: GEM_TYPES.COLOR_BOMB, ...powerupCreationPos });
        }
      }

      // Gom tất cả gem trong group vào danh sách xóa ban đầu
      group.forEach(gem => gemsToRemoveFromMatch.add(gem));
    });

    // Gây sát thương blocker lân cận (giữ nguyên logic hiện có)
    const gemsAndAdjacentCells = new Set();
    gemsToRemoveFromMatch.forEach(gem => {
      const r = gem.sprite.getData('row');
      const c = gem.sprite.getData('col');
      gemsAndAdjacentCells.add(`${r},${c}`);
      gemsAndAdjacentCells.add(`${r-1},${c}`);
      gemsAndAdjacentCells.add(`${r+1},${c}`);
      gemsAndAdjacentCells.add(`${r},${c-1}`);
      gemsAndAdjacentCells.add(`${r},${c+1}`);
    });
    let blockerDestroyedThisPass = false;
    gemsAndAdjacentCells.forEach(coord => {
      const [r, c] = coord.split(',').map(Number);
      const blocker = this.blockerGrid?.[r]?.[c];
      if (blocker) {
        const destroyed = blocker.takeDamage();
        if (destroyed) {
          // Cập nhật mục tiêu và số lượng blocker còn lại
          if (blocker.type) {
            this.updateObjectiveProgress('blocker', blocker.type);
          }
          this.blockerGrid[r][c] = null;
          blockerDestroyedThisPass = true;
          if (blocker.type === 'rope') this.ropeDestroyedThisTurn = true;

          const multiplier = Math.pow(SCORE_VALUES.CHAIN_MULTIPLIER, Math.max(0, this.chainLevel - 1));
          const points = SCORE_VALUES.BLOCKER_DESTROY * multiplier;
          if (this.scene && this.scene.game && this.scene.game.events) {
            console.log(`Chain ${this.chainLevel}: Blocker destroyed, +${points} points!`);
            this.scene.game.events.emit('addScore', points);
          }
        }
      }
    });
    // Sau khi xử lý xong tất cả blocker, mới tính lại 1 lần để tránh spam sự kiện
    if (blockerDestroyedThisPass) {
      this.recalculateBlockerCounts();
    }

    // Bảo vệ: loại bỏ gem tại vị trí tạo power-up khỏi danh sách xóa
    if (powerupsToCreate.length > 0) {
      const powerupPositions = new Set(powerupsToCreate.map(p => `${p.row},${p.col}`));
      gemsToRemoveFromMatch.forEach(gem => {
        if (!gem || !gem.sprite) return;
        const pos = `${gem.sprite.getData('row')},${gem.sprite.getData('col')}`;
        if (powerupPositions.has(pos)) gemsToRemoveFromMatch.delete(gem);
      });
    }

    return { gemsRemoved: gemsToRemoveFromMatch, powerupsCreated: powerupsToCreate };
  }

  // << THAY THẾ TOÀN BỘ HÀM NÀY >>
  removeGemSprites(gemsToRemove) {
    // << [AUDIO] Phát âm thanh khi ăn gem - chỉ phát 1 lần cho mỗi đợt match >>
    if (gemsToRemove && gemsToRemove.size > 0) {
      const sfxVolume = AudioManager.getSoundVolume()
      if (sfxVolume > 0 && this.scene && this.scene.sound) {
        this.scene.sound.play(SOUND_KEYS.SPIN_COLLECT, { volume: sfxVolume })
      }
    }

    gemsToRemove.forEach(gemObject => {
      // Kiểm tra an toàn
      if (gemObject && gemObject.sprite) {
        // [QUAN TRỌNG] Dừng tất cả Tween đang chạy trên sprite này (VFX, Idle...)
        // Để tránh xung đột khi sprite đang biến mất
        this.scene.tweens.killTweensOf(gemObject.sprite);

        const row = gemObject.sprite.getData('row')
        const col = gemObject.sprite.getData('col')
        
        // Xóa tham chiếu trong grid
        if (this.grid[row] && this.grid[row][col] === gemObject) {
          this.grid[row][col] = null
        }

        // Tạo animation biến mất
        this.scene.tweens.add({
          targets: gemObject.sprite,
          scale: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            // Hủy sprite sau khi animation kết thúc một cách an toàn
            if (gemObject.sprite && gemObject.sprite.active) {
                gemObject.sprite.destroy()
            }
          }
        })
      }
    })
  }

  /**
   * Xóa sprite của một blocker với hiệu ứng animation.
   * @param {any} blockerObject Đối tượng blocker cần xóa (sprite hoặc có destroy()).
   */
  removeBlockerSprite(blockerObject) {
    if (blockerObject && typeof blockerObject.destroy === 'function') {
      // << LOGIC MỚI: Cập nhật nhiệm vụ blocker >>
      if (blockerObject.type) {
        this.updateObjectiveProgress('blocker', blockerObject.type);
      }
      
      this.scene.tweens.add({
        targets: blockerObject,
        scale: 0,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          blockerObject.destroy()
          // Cập nhật lại bộ đếm blocker sau khi hủy
          this.recalculateBlockerCounts()
        }
      })
    }
  }

  addWiggleEffect(gemsToRemoveArray, onComplete) {
    const regularGems = gemsToRemoveArray.filter(gemObject => {
      if (!gemObject || !gemObject.value) return false
      return true
    })
    if (regularGems.length === 0) { onComplete(); return }
    let completedTweens = 0
    regularGems.forEach((gemObject) => {
      if (gemObject.sprite && gemObject.sprite.active) {
        this.scene.tweens.add({
          targets: gemObject.sprite,
          angle: { from: -10, to: 10 },
          yoyo: true,
          repeat: 0,  // Chỉ lắc 1 lần trái-phải rồi hủy
          duration: 60,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            completedTweens++
            if (completedTweens === regularGems.length) {
              regularGems.forEach(g => g.sprite.setAngle(0))
              onComplete()
            }
          }
        })
      } else {
        completedTweens++
      }
    })
    if (regularGems.length > 0 && completedTweens === regularGems.length) {
      onComplete()
    }
  }

applyGravityAndRefill() {
  // BƯỚC 1: TÁI CẤU TRÚC LƯỚI LOGIC (ĐÃ SỬA LỖI GEM CHỒNG GEM)
  const newGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  const newBlockerGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  for (let col = 0; col < GRID_SIZE; col++) {
      let writeRow = GRID_SIZE - 1;
      for (let readRow = GRID_SIZE - 1; readRow >= 0; readRow--) {
          // Bỏ qua các ô không thể chứa item (lỗ hổng)
          if (this.levelData.gridLayout[readRow][col] === null) continue;   

          const blocker = this.blockerGrid[readRow][col];
          const gem = this.grid[readRow][col];

          // Nếu ô đang đọc không có gì thì bỏ qua
          if (!blocker && !gem) continue;
          
          // Tìm vị trí ghi hợp lệ tiếp theo, bỏ qua các lỗ hổng
          while (writeRow >= 0 && this.levelData.gridLayout[writeRow][col] === null) {
              writeRow--;
          }
          if (writeRow < 0) break;
          
          // === LOGIC XỬ LÝ BLOCKER TĨNH ===
          if (blocker && blocker.type === 'stone') {
              // Stone luôn đứng yên ở vị trí cũ
              newBlockerGrid[readRow][col] = blocker;

              // Nếu có gem bị kẹt dưới stone, gem đó cũng đứng yên
              if (gem) {
                  newGrid[readRow][col] = gem;
              }
              
              // Cập nhật writeRow để gem bên trên không rơi đè lên stone
              writeRow = readRow - 1;
              continue;
          }
          
          // === LOGIC XỬ LÝ ROPE (KHÔNG CHẶN GEM) ===
          if (blocker && blocker.type === 'rope') {
              // Rope giữ nguyên vị trí để lây lan
              newBlockerGrid[readRow][col] = blocker;
              
              // Nếu có gem, gem vẫn rơi xuống bình thường (rope không chặn)
              if (gem) {
                  newGrid[writeRow][col] = gem;
                  writeRow--;
              }
              continue;
          }
          // =======================================================
          
          // Nếu chỉ có gem (không có blocker), cho nó rơi xuống
          if (gem && !blocker) {
              newGrid[writeRow][col] = gem;
              writeRow--;
          }
      }
  }
  
  this.grid = newGrid;
  this.blockerGrid = newBlockerGrid;

  // BƯỚC 2: TẠO GEM MỚI CHO CÁC Ô TRỐNG (THEO CỘT GIẢ)
    const isBlockedFromRefill = (row, col) => {
        for (let r = row - 1; r >= 0; r--) {
            if (this.levelData.gridLayout[r][col] === null) continue;
            const blocker = this.blockerGrid[r][col];
            const gem = this.grid[r][col];
          if (blocker && blocker.type === 'stone') return true;
          if (gem) return false;
      }
        return false;
    };

  // Tạo gem mới theo từng cột để tạo "cột giả" nối đuôi nhau
  for (let col = 0; col < GRID_SIZE; col++) {
      // Thu thập tất cả các ô trống cần refill trong cột này
      const emptySlots = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        if (this.levelData.gridLayout[row][col] === null) continue;

        const gem = this.grid[row][col];
        const blocker = this.blockerGrid[row][col];
          
          if (!gem && (!blocker || blocker.type !== 'stone') && !isBlockedFromRefill(row, col)) {
              emptySlots.push(row);
          }
      }
      
      // Tạo gem cho các ô trống, đặt chúng nối đuôi nhau phía trên
      emptySlots.forEach((row, index) => {
          const randomGemType = Phaser.Math.RND.pick(this.levelData.availableGems || Object.values(GEM_TYPES));
          const targetY = this.offsetY + row * this.cellSize + this.cellSize / 2;
          const targetX = this.offsetX + col * this.cellSize + this.cellSize / 2;
          
          // Đặt gem ở vị trí "cột giả" phía trên - càng nhiều gem thì càng cao
          // Gem đầu tiên ở offsetY - 1*cellSize, gem thứ 2 ở offsetY - 2*cellSize, ...
          const startY = this.offsetY - (emptySlots.length - index) * this.cellSize + this.cellSize / 2;
          
          const newGemSprite = this.createGemAt(row, col, randomGemType, startY);
          newGemSprite.x = targetX;
          newGemSprite.y = startY; // Đặt tại vị trí cột giả
          
          // Lưu vị trí đích vào data
          newGemSprite.setData('targetX', targetX);
          newGemSprite.setData('targetY', targetY);
          
          this.grid[row][col] = { type: 'gem', value: randomGemType, sprite: newGemSprite };
      });
  }

  // BƯỚC 3: CẬP NHẬT DATA CHO TẤT CẢ GEM (bao gồm cả gem mới và gem cũ)
  for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
          const gem = this.grid[row][col];
          if (gem && gem.sprite) {
              const targetY = this.offsetY + row * this.cellSize + this.cellSize / 2;
              const targetX = this.offsetX + col * this.cellSize + this.cellSize / 2;
              
              // Cập nhật data của sprite (vị trí logic mới)
              gem.sprite.setData({ row, col, type: gem.value, isGem: true });
              
              // Chỉ set target nếu chưa có (tránh ghi đè gem mới từ BƯỚC 2)
              if (gem.sprite.getData('targetX') === undefined) {
                  gem.sprite.setData('targetX', targetX);
              }
              if (gem.sprite.getData('targetY') === undefined) {
                  gem.sprite.setData('targetY', targetY);
              }
          }
      }
  }

  // BƯỚC 4: CHẠY HIỆU ỨNG RƠI GIẢ
  this.playFakeGravityEffect(() => {
      this.checkForNewMatches(this.chainLevel);
  });
}


  /**
   * Lưu vị trí hiện tại của tất cả các gem trước khi apply gravity
   */
  captureCurrentPositions() {
    const positions = []
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col]
        if (gem && gem.sprite) {
          positions.push({
            row,
            col,
            x: gem.sprite.x,
            y: gem.sprite.y,
            gemType: gem.value
          })
        }
      }
    }
    return positions
  }

  /**
   * Hiển thị lại các gem thật sau khi animation giả kết thúc
   * và đặt chúng vào đúng vị trí cuối cùng
   */
  revealRealGems() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col]
        if (gem && gem.sprite) {
          // Đặt sprite vào vị trí cuối cùng (nếu có targetX/Y)
          const targetX = gem.sprite.getData('targetX')
          const targetY = gem.sprite.getData('targetY')
          if (targetX !== undefined) {
            gem.sprite.x = targetX
          }
          if (targetY !== undefined) {
            gem.sprite.y = targetY
          }
          
          // Hiển thị sprite (quan trọng: hiển thị TẤT CẢ gem, kể cả gem không bị ẩn)
          gem.sprite.setVisible(true)
          
          // Xóa data targetX/Y sau khi sử dụng xong
          gem.sprite.setData('targetX', undefined)
          gem.sprite.setData('targetY', undefined)
        }
      }
    }
  }

  /**
   * Tạo mask riêng cho layer fake gem (gravity effect)
   * CHỈ che khu vực board thật (gridLayout !== null)
   * Vùng phía trên (cột giả) KHÔNG có trong mask -> gem ở đó bị che
   */
  createFakeGravityMask() {
    const maskGraphics = this.scene.make.graphics()
    maskGraphics.fillStyle(0xffffff)
    
    // CHỈ vẽ mask cho khu vực board thật (không bao gồm vùng phía trên)
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Chỉ vẽ các ô không null trong gridLayout
        if (this.levelData.gridLayout[row][col] !== null) {
          const x = this.offsetX + col * this.cellSize
          const y = this.offsetY + row * this.cellSize
          maskGraphics.fillRect(x, y, this.cellSize, this.cellSize)
        }
      }
    }
    
    const mask = maskGraphics.createGeometryMask()
    return { mask, graphics: maskGraphics }
  }

  /**
   * DEBUG: Tạo vùng che visual để quan sát mask đang hoạt động
   * Gọi hàm này để xem vùng nào được mask cover
   */
  showDebugMaskOverlay() {
    // Xóa overlay cũ nếu có
    if (this.debugMaskOverlay) {
      this.debugMaskOverlay.destroy()
    }

    // Tạo graphics mới với depth cao nhất
    const debugGraphics = this.scene.add.graphics().setDepth(999)
    
    // BƯỚC 1: Vẽ vùng ĐỎ = Vùng gem BỊ CHE (toàn bộ màn hình)
    debugGraphics.fillStyle(0xff0000, 0.3) // Đỏ, 30% opacity
    const { width, height } = this.scene.scale
    debugGraphics.fillRect(0, 0, width, height)
    
    // BƯỚC 2: Vẽ vùng XANH = Vùng gem HIỂN THỊ (CHỈ gridLayout !== null)
    debugGraphics.fillStyle(0x00ff00, 0.3) // Xanh lá, 30% opacity
    
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Chỉ vẽ các ô không null trong gridLayout
        if (this.levelData.gridLayout[row][col] !== null) {
          const x = this.offsetX + col * this.cellSize
          const y = this.offsetY + row * this.cellSize
          debugGraphics.fillRect(x, y, this.cellSize, this.cellSize)
        }
      }
    }
    
    this.debugMaskOverlay = debugGraphics
    
    console.log('🎭 DEBUG MASK OVERLAY:')
    console.log('   🟢 XANH = Vùng gem HIỂN THỊ (bên trong mask - CHỈ gridLayout hợp lệ)')
    console.log('   🔴 ĐỎ = Vùng gem BỊ CHE (ngoài mask - bao gồm cả vùng phía trên board)')
  }

  /**
   * DEBUG: Xóa overlay debug
   */
  hideDebugMaskOverlay() {
    if (this.debugMaskOverlay) {
      this.debugMaskOverlay.destroy()
      this.debugMaskOverlay = null
      console.log('🎭 Debug mask overlay đã tắt')
    }
  }

  /**
   * Tạo hiệu ứng rơi "giả" mô phỏng code cũ trong khi logic thực chạy code mới
   * SỬA ĐỔI: Đưa clone vào gemLayer để nằm dưới Rope và tự động nhận Mask của Layer
   * @param {function} onComplete - Callback khi animation kết thúc
   */
  playFakeGravityEffect(onComplete) {
    // Đánh dấu đang chạy gravity effect (chặn auto match)
    this.isGravityEffectRunning = true

    // [FIX] TẠO MASK VÀ ÁP DỤNG NGAY ĐẦU HÀM
    // Mask che gem nằm ngoài vùng gridLayout (đặc biệt cột giả phía trên)
    const { mask, graphics } = this.createFakeGravityMask()
    this.gemLayer.setMask(mask)

    const speed = 0.8  // Tăng tốc độ rơi (0.5 → 0.8)
    const minDuration = 80  // Duration tối thiểu để không quá nhanh
    let totalTweens = 0
    let tweensCompleted = 0

    const onTweenComplete = () => {
      tweensCompleted++
      if (tweensCompleted === totalTweens) {
        // Delay nhỏ trước khi hiển thị gem thật (tránh chớp)
        this.scene.time.delayedCall(30, () => {
          // Destroy tất cả clone sprite
          fakeGems.forEach(clone => {
            if (clone && clone.active) {
              clone.destroy()
            }
          })

          // [FIX] XÓA MASK SAU KHI ANIMATION KẾT THÚC
          this.gemLayer.clearMask()
          if (graphics) graphics.destroy()
          if (mask) mask.destroy()

          // Hiển thị lại các gem thật ở vị trí mới
          this.revealRealGems()
          
          // Delay trước khi auto match (giảm từ 200 → 120)
          this.scene.time.delayedCall(120, () => {
            // Mở khóa gravity effect
            this.isGravityEffectRunning = false
            
            // Callback để tiếp tục auto match
            if (onComplete) onComplete()
          })
        })
      }
    }

    const fakeGems = []

    // BƯỚC 1: Clone tất cả gem, đưa vào gemLayer, và ẩn gem thật (CHỈ 1 LẦN)
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // KIỂM TRA: Chỉ xử lý gem ở ô HỢP LỆ (không null trong gridLayout)
        if (this.levelData.gridLayout[row][col] === null) continue
        
        const gem = this.grid[row][col]
        if (gem && gem.sprite && gem.sprite.active) {
          const targetY = gem.sprite.getData('targetY')
          
          // Chỉ tạo clone cho gem cần rơi (vị trí hiện tại khác vị trí đích)
          if (targetY !== undefined && Math.abs(gem.sprite.y - targetY) > 1) {
            // Tạo sprite nhưng không add ngay vào scene
            const clone = this.scene.make.sprite({
              x: gem.sprite.x,
              y: gem.sprite.y,
              key: gem.sprite.texture.key,
              add: false
            })
            
            // Thêm vào gemLayer để nó nằm chung hệ quy chiếu với Rope
            this.gemLayer.add(clone)
            
            clone.setScale(gem.sprite.scale)
              .setDepth(5) // Depth 5: nằm giữa Gem (2) và Rope (10)
            
            clone.setData('startY', gem.sprite.y)
            clone.setData('endY', targetY)
            clone.setData('col', col)
            clone.setData('row', row) // Lưu thêm row để check sau
            fakeGems.push(clone)

            // Ẩn gem thật CHỈ 1 LẦN
            gem.sprite.setVisible(false)
          }
        }
      }
    }

    // BƯỚC 2: Tạo animation cho từng gem với duration riêng (không đồng bộ cả cột)
    fakeGems.forEach(fakeGem => {
      const distance = Math.abs(fakeGem.getData('endY') - fakeGem.getData('startY'))
      // Mỗi gem có duration riêng dựa trên khoảng cách rơi của nó
      const duration = Math.max(minDuration, distance / speed)
      
      totalTweens++
      
      this.scene.tweens.add({
        targets: fakeGem,
        y: fakeGem.getData('endY'),
        duration: duration,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          onTweenComplete()
        }
      })
    })

    // Nếu không có animation nào, vẫn cần delay để tránh auto match quá nhanh
    if (totalTweens === 0) {
      this.scene.time.delayedCall(30, () => {
        // Destroy tất cả clone sprite (nếu có)
        fakeGems.forEach(clone => {
          if (clone && clone.active) {
            clone.destroy()
          }
        })

        // [FIX] XÓA MASK KHI KHÔNG CÓ GÌ RƠI
        this.gemLayer.clearMask()
        if (graphics) graphics.destroy()
        if (mask) mask.destroy()

        this.revealRealGems()
        
        // Delay trước khi auto match (giảm từ 200 → 120)
        this.scene.time.delayedCall(120, () => {
          // Mở khóa gravity effect
          this.isGravityEffectRunning = false
          
          // Callback để tiếp tục auto match
          if (onComplete) onComplete()
        })
      })
    }
  }

  checkForNewMatches(currentChainLevel = 1) {
    // Chặn auto match nếu gravity effect đang chạy
    if (this.isGravityEffectRunning) {
      console.log('Gravity effect is running, skipping auto match')
      return
    }
    
    const newMatchGroups = this.findAllMatches()
    if (newMatchGroups.length > 0) {
      console.log('Found new matches after refill, processing...')
      this.chainLevel = currentChainLevel + 1
      this.startActionChain(newMatchGroups, null, null, null)
    } else {
      this.endOfTurn()
    }
  }

  endOfTurn() {
    // << THÊM MỚI: Xử lý power-up chain reaction trước khi kết thúc lượt >>
    if (this.powerupChainQueue && this.powerupChainQueue.length > 0 && !this.isProcessingPowerupChain) {
      console.log(`⚡⚡⚡ Processing ${this.powerupChainQueue.length} power-ups from chain reaction`)
      this.processPowerupChainQueue()
      return // Không kết thúc lượt ngay, đợi chain xử lý xong
    }

    // Nếu trong lượt không phá rope nào, cho MỖI rope lây lan 1 lần (theo snapshot)
    if (!this.ropeDestroyedThisTurn) {
      const ropesSnapshot = []
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const b = this.blockerGrid[r]?.[c]
          if (b && b.type === 'rope' && b.spread) ropesSnapshot.push(b)
        }
      }
      // Đặt kế hoạch spawn để tránh trùng; cho phép trùng chỉ khi không còn lựa chọn khác
      const plannedSpawns = new Set()
      ropesSnapshot.forEach(rope => {
        rope.spread(this, plannedSpawns)
      })
      // Sau khi dây leo sinh sôi: đếm lại toàn bộ còn trên map và cập nhật objective + UI
      this.recalculateBlockerCounts()
      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('matchSummary', { blockerCounts: this.blockerCounts })
      }
    }
    // Reset cờ cho lượt tiếp theo và bật input
    this.ropeDestroyedThisTurn = false
    this.chainLevel = 1

    if (typeof this.hasPossibleMoves === 'function' && !this.hasPossibleMoves()) {
      this.triggerAutoShuffle()
      return
    }

    this.boardBusy = false
    this.scene.input.enabled = true
    // Báo cho UI biết board đã rảnh
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('boardBusy', false)
    }
    // Sau khi hiệu ứng và refill hoàn tất, kiểm tra và emit thắng nếu đủ điều kiện
    this.maybeEmitLevelCompleted()
    
    // Kiểm tra thua do hết move (nếu chưa thắng)
    if (!this.levelWon && this.isMoveBasedLevel && this.movesRemaining <= 0) {
      this.handleLevelFailed();
    }
  }

  getPowerupActivationSet(powerupGem, otherGem) {
    const resultSet = new Set()
    // Lưu các gem sẽ biến hình để VFX sử dụng (combo ColorBomb + Stripe)
    if (!this.gemsToTransformForVFX) this.gemsToTransformForVFX = new Set();
    this.gemsToTransformForVFX.clear();
    // Lưu hướng combo cho VFX (ví dụ Bomb+Stripe)
    this.comboVFXDirection = null;
    // Lưu tâm cho Bomb+Bomb để damage sau VFX
    this.bombComboCenter = null;
    // << MỚI: Lưu danh sách vùng cần damage SAU VFX >>
    this.damageAreasAfterVFX = null;
    if (this.isPowerup(otherGem)) {
      resultSet.add(powerupGem)
      resultSet.add(otherGem)
      const type1 = powerupGem.value
      const type2 = otherGem.value
      if (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.COLOR_BOMB) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c]) resultSet.add(this.grid[r][c])
          }
        }
      } else if (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.BOMB) {
        // COMBO: BOMB + BOMB (Nổ 5x5) – CHỈ xác định vùng và lưu tâm; damage sẽ chạy SAU VFX
        const centerRow = powerupGem.sprite.getData('row')
        const centerCol = powerupGem.sprite.getData('col')
        this.bombComboCenter = { row: centerRow, col: centerCol }
        for (let r = centerRow - 2; r <= centerRow + 2; r++) {
          for (let c = centerCol - 2; c <= centerCol + 2; c++) {
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
              const gem = this.grid[r]?.[c]
              if (gem && gem.type === 'gem') { resultSet.add(gem) }
            }
          }
        }
        // Đảm bảo 2 quả bomb nằm trong set cho VFX
        resultSet.add(powerupGem)
        resultSet.add(otherGem)
      }
      // STRIPE + STRIPE: dấu + 1 ô, tâm là vị trí 2 (damage sau VFX)
      else if (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.STRIPE) {
        const r = powerupGem.sprite.getData('row')
        const c = powerupGem.sprite.getData('col')
        // Lưu vùng damage để thực hiện sau VFX
        this.damageAreasAfterVFX = { type: 'stripe_stripe', row: r, col: c }
        // Tạm thời thêm tất cả gem trong vùng (VFX cần biết)
        for (let col = 0; col < GRID_SIZE; col++) {
          const gem = this.grid[r]?.[col]
          if (gem && gem.type === 'gem') resultSet.add(gem)
        }
        for (let row = 0; row < GRID_SIZE; row++) {
          if (row === r) continue
          const gem = this.grid[row]?.[c]
          if (gem && gem.type === 'gem') resultSet.add(gem)
        }
      } else if (
        (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.STRIPE) ||
        (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.BOMB)
      ) {
        // COMBO: BOMB + STRIPE => 3 hàng hoặc 3 cột (rộng 3 ô) theo hướng swap (damage sau VFX)
        const r2 = powerupGem.sprite.getData('row')
        const c2 = powerupGem.sprite.getData('col')
        const r1 = otherGem.sprite.getData('row')
        const isHorizontalSwap = (r1 === r2)
        this.comboVFXDirection = isHorizontalSwap ? 'horizontal' : 'vertical'
        // Lưu vùng damage để thực hiện sau VFX
        this.damageAreasAfterVFX = { type: 'bomb_stripe', row: r2, col: c2, direction: this.comboVFXDirection }
        // Tạm thời thêm tất cả gem trong vùng (VFX cần biết)
        if (isHorizontalSwap) {
          for (let r = r2 - 1; r <= r2 + 1; r++) {
            if (r < 0 || r >= GRID_SIZE) continue
            for (let c = 0; c < GRID_SIZE; c++) {
              const gem = this.grid[r]?.[c]
              if (gem && gem.type === 'gem') resultSet.add(gem)
            }
          }
        } else {
          for (let c = c2 - 1; c <= c2 + 1; c++) {
            if (c < 0 || c >= GRID_SIZE) continue
            for (let r = 0; r < GRID_SIZE; r++) {
              const gem = this.grid[r]?.[c]
              if (gem && gem.type === 'gem') resultSet.add(gem)
            }
          }
        }
      }
      // COMBO: COLOR_BOMB + STRIPE
      else if (
          (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.STRIPE) ||
          (type1 === GEM_TYPES.STRIPE && type2 === GEM_TYPES.COLOR_BOMB)
      ) {
          const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerupGem : otherGem
          const stripeGem = (colorBomb === powerupGem) ? otherGem : powerupGem

          // Chọn một màu ngẫu nhiên trong danh sách gem thường
          const availableGems = (this.levelData?.availableGems || Object.values(GEM_TYPES))
            .filter(t => t !== GEM_TYPES.BOMB && t !== GEM_TYPES.COLOR_BOMB && t !== GEM_TYPES.STRIPE)
          const targetColor = Phaser.Math.RND.pick(availableGems)

          // Tìm tất cả gem có màu đó
          const gemsToActivate = []
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              const gem = this.grid[r][c]
              if (gem && gem.type === 'gem' && gem.value === targetColor) {
                gemsToActivate.push(gem)
              }
            }
          }

          // Lưu để VFX dùng biến hình
          gemsToActivate.forEach(gem => this.gemsToTransformForVFX.add(gem))

          // Lưu vùng damage để thực hiện sau VFX (với hướng ngẫu nhiên cho mỗi stripe)
          const stripeDirections = new Map()
          gemsToActivate.forEach(gem => {
            stripeDirections.set(gem, Phaser.Math.RND.pick([true, false])) // true = horizontal
          })
          this.damageAreasAfterVFX = { type: 'colorbomb_stripe', gems: gemsToActivate, directions: stripeDirections }

          // Tạm thời thêm tất cả gem trong vùng (VFX cần biết)
          gemsToActivate.forEach(gem => {
            const row = gem.sprite.getData('row')
            const col = gem.sprite.getData('col')
            const isHorizontal = stripeDirections.get(gem)
            if (isHorizontal) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const g = this.grid[row]?.[c]
                if (g && g.type === 'gem') resultSet.add(g)
              }
            } else {
              for (let r = 0; r < GRID_SIZE; r++) {
                const g = this.grid[r]?.[col]
                if (g && g.type === 'gem') resultSet.add(g)
              }
            }
          })

          // Đảm bảo hai power-up cũng nằm trong tập kết quả
          resultSet.add(colorBomb)
          resultSet.add(stripeGem)
      }
      // COMBO: COLOR_BOMB + BOMB (mới)
      else if (
        (type1 === GEM_TYPES.COLOR_BOMB && type2 === GEM_TYPES.BOMB) ||
        (type1 === GEM_TYPES.BOMB && type2 === GEM_TYPES.COLOR_BOMB)
      ) {
        const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerupGem : otherGem
        const bombGem = (colorBomb === powerupGem) ? otherGem : powerupGem

        const availableGems = (this.levelData?.availableGems || Object.values(GEM_TYPES))
          .filter(t => t !== GEM_TYPES.BOMB && t !== GEM_TYPES.COLOR_BOMB && t !== GEM_TYPES.STRIPE)
        const targetColor = Phaser.Math.RND.pick(availableGems)

        const gemsToActivate = []
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const gem = this.grid[r][c]
            if (gem && gem.type === 'gem' && gem.value === targetColor) {
              gemsToActivate.push(gem)
            }
          }
        }

        // Lưu để VFX dùng biến hình
        gemsToActivate.forEach(gem => this.gemsToTransformForVFX.add(gem))

        // Lưu vùng damage để thực hiện sau VFX
        this.damageAreasAfterVFX = { type: 'colorbomb_bomb', gems: gemsToActivate }

        // Tạm thời thêm tất cả gem trong vùng 3x3 quanh mỗi bomb (VFX cần biết)
        gemsToActivate.forEach(gem => {
          const r = gem.sprite.getData('row')
          const c = gem.sprite.getData('col')
          for (let rr = r - 1; rr <= r + 1; rr++) {
            for (let cc = c - 1; cc <= c + 1; cc++) {
              const g = this.grid[rr]?.[cc]
              if (g && g.type === 'gem') resultSet.add(g)
            }
          }
        })

        resultSet.add(colorBomb)
        resultSet.add(bombGem)
      } else {
        const colorBomb = (type1 === GEM_TYPES.COLOR_BOMB) ? powerupGem : otherGem
        const bomb = (colorBomb === powerupGem) ? otherGem : powerupGem
        const colorBombRow = colorBomb.sprite.getData('row')
        const colorBombCol = colorBomb.sprite.getData('col')
        for (let c = Math.max(0, colorBombCol - 1); c <= Math.min(GRID_SIZE - 1, colorBombCol + 1); c++) {
          for (let r = 0; r < GRID_SIZE; r++) {
            const gem = this.grid[r][c]
            if (gem && gem.type === 'gem') { resultSet.add(gem) }
          }
        }
        for (let r = Math.max(0, colorBombRow - 1); r <= Math.min(GRID_SIZE - 1, colorBombRow + 1); r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const gem = this.grid[r][c]
            if (gem && gem.type === 'gem') { resultSet.add(gem) }
          }
        }
        resultSet.add(colorBomb)
        resultSet.add(bomb)
      }
    } else {
      resultSet.add(powerupGem)
      switch (powerupGem.value) {
        case GEM_TYPES.BOMB: {
          const r = powerupGem.sprite.getData('row')
          const c = powerupGem.sprite.getData('col')
          // Lưu vùng damage để thực hiện sau VFX
          this.damageAreasAfterVFX = { type: 'bomb_single', row: r, col: c }
          // Tạm thời thêm tất cả gem trong vùng 3x3 (VFX cần biết)
          for (let rr = r - 1; rr <= r + 1; rr++) {
            for (let cc = c - 1; cc <= c + 1; cc++) {
              if (rr === r && cc === c) continue
              const gem = this.grid[rr]?.[cc]
              if (gem && gem.type === 'gem') resultSet.add(gem)
            }
          }
          break
        }
        case GEM_TYPES.COLOR_BOMB: {
          let targetColor

          if (otherGem) {
            // Kích hoạt chủ động: Color Bomb + gem màu cụ thể
            targetColor = otherGem.value
          } else {
            // << CHAIN REACTION >> Không có otherGem: chọn màu ngẫu nhiên đang có trên board
            const availableColors = []
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const gem = this.grid[r][c]
                if (gem && gem.type === 'gem' && !this.isPowerup(gem)) {
                  if (!availableColors.includes(gem.value)) {
                    availableColors.push(gem.value)
                  }
                }
              }
            }

            if (availableColors.length > 0) {
              // Chọn ngẫu nhiên một màu trong các màu đang có
              targetColor = Phaser.Utils.Array.GetRandom(availableColors)
            }
          }

          if (targetColor !== undefined) {
            // Lưu vùng damage để thực hiện sau VFX
            this.damageAreasAfterVFX = { type: 'colorbomb_single', targetColor, otherGem }
            // Tạm thời thêm tất cả gem cùng màu (VFX cần biết)
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const gem = this.grid[r][c]
                if (gem && gem.type === 'gem' && !this.isPowerup(gem) && gem.value === targetColor) {
                  resultSet.add(gem)
                }
              }
            }
            if (otherGem) {
              resultSet.add(otherGem)
            }
          }
          break
        }
        case GEM_TYPES.STRIPE: {
          // Stripe xóa toàn bộ hàng hoặc cột
          const stripeRow = powerupGem.sprite.getData('row')
          const stripeCol = powerupGem.sprite.getData('col')
          
          // Xác định hướng:
          // - Nếu là swap chủ động (có otherGem) → theo hướng swap
          // - Nếu là chain reaction (không có otherGem) → chọn ngẫu nhiên
          let isHorizontal
          if (otherGem) {
            const otherRow = otherGem.sprite.getData('row')
            isHorizontal = (otherRow === stripeRow)
          } else {
            isHorizontal = Math.random() > 0.5
          }
          
          // Lưu vùng damage để thực hiện sau VFX
          this.damageAreasAfterVFX = { type: 'stripe_single', row: stripeRow, col: stripeCol, isHorizontal }
          
          // Tạm thời thêm tất cả gem trong hàng/cột (VFX cần biết)
          if (isHorizontal) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (c === stripeCol) continue
              const gem = this.grid[stripeRow]?.[c]
              if (gem && gem.type === 'gem') resultSet.add(gem)
            }
          } else {
            for (let r = 0; r < GRID_SIZE; r++) {
              if (r === stripeRow) continue
              const gem = this.grid[r]?.[stripeCol]
              if (gem && gem.type === 'gem') resultSet.add(gem)
            }
          }
          break
        }
      }
    }

    // << THÊM MỚI: Thu thập power-ups bị phá để chain reaction >>
    const destroyedPowerups = []
    const destroyedPowerupsSet = new Set()
    resultSet.forEach(gem => {
      if (!gem || !gem.sprite) return
      if (!this.isPowerup(gem)) return
      // Bỏ qua power-up đang kích hoạt và power-up còn lại trong combo
      if (gem === powerupGem || gem === otherGem) return
      if (destroyedPowerupsSet.has(gem)) return
      destroyedPowerupsSet.add(gem)
      const row = gem.sprite.getData('row')
      const col = gem.sprite.getData('col')
      destroyedPowerups.push({ gem, row, col })
    })
    this.destroyedPowerupsThisActivation = destroyedPowerups

    return resultSet
  }

  // Chỉ emit levelCompleted sau khi lượt đã kết thúc và chưa emit trước đó
  // Phải đảm bảo board hoàn toàn rảnh (boardBusy = false) và không có gravity effect
  maybeEmitLevelCompleted() {
    if (this.levelWon) return; // Đã thắng rồi, không emit lại
    if (this.isGravityEffectRunning) return; // Gravity đang chạy
    if (this.boardBusy) return; // Board đang bận, chưa tính xong điểm
    
    // Chỉ emit khi tất cả objectives hoàn thành VÀ board hoàn toàn rảnh
    if (this.areAllObjectivesCompleted()) {
      this.levelWon = true;
      console.log('🎉 All objectives completed and board is ready - emitting levelCompleted');
      if (this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('levelCompleted');
      }
    }
  }

  // Trừ số move còn lại và emit sự kiện
  decrementMove() {
    if (!this.isMoveBasedLevel) return;
    
    this.movesRemaining--;
    console.log('Move used. Moves remaining:', this.movesRemaining);
    
    // Emit sự kiện để UI cập nhật
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('moveUpdated', this.movesRemaining);
    }
  }

  // Xử lý thua game do hết move
  handleLevelFailed() {
    if (this.levelFailed) return; // Đã thua rồi, không emit lại
    
    this.levelFailed = true;
    console.log('❌ Level failed - out of moves');
    
    // Emit sự kiện để UI hiển thị popup thua
    if (this.scene && this.scene.game && this.scene.game.events) {
      this.scene.game.events.emit('levelFailed');
    }
  }

  /**
   * Xử lý hàng đợi power-up chain reaction.
   * Lấy power-up đầu tiên trong queue, kích hoạt nó, 
   * sau đó tiếp tục với power-up tiếp theo khi lượt chain đó kết thúc.
   */
  processPowerupChainQueue() {
    const MAX_CHAIN_DEPTH = 10

    // Giới hạn độ sâu chain
    if (this.chainLevel >= MAX_CHAIN_DEPTH) {
      console.warn('⚠️ Max chain depth reached, stopping chain reaction')
      this.powerupChainQueue = []
      this.isProcessingPowerupChain = false
      this.endOfTurn()
      return
    }

    if (!this.powerupChainQueue || this.powerupChainQueue.length === 0) {
      console.log('⚡ Chain reaction completed, ending turn')
      this.isProcessingPowerupChain = false
      this.endOfTurn()
      return
    }

    this.isProcessingPowerupChain = true

    // Lấy power-up đầu tiên trong queue
    const powerupInfo = this.powerupChainQueue.shift()
    const powerupGem = powerupInfo?.gem

    // Kiểm tra gem còn hợp lệ không
    if (!powerupGem || !powerupGem.sprite || !powerupGem.sprite.active) {
      console.log('⚡ Power-up already destroyed, skipping to next in queue')
      // Reset cờ để đệ quy hoạt động
      this.isProcessingPowerupChain = false
      this.processPowerupChainQueue()
      return
    }

    const row = powerupGem.sprite.getData('row')
    const col = powerupGem.sprite.getData('col')

    console.log(`⚡ Activating chained power-up: ${powerupGem.value} at (${row}, ${col})`)

    // Tăng chain level
    this.chainLevel++

    // Xác định các gem bị ảnh hưởng bởi power-up này
    const affectedGems = this.getPowerupActivationSet(powerupGem, null)

    // Callback riêng cho Chain Reaction
    const onChainVFXComplete = () => {
      let finalGemsToRemove = new Set()

      // 1. Xác định gem cần xóa dựa trên vùng damage sau VFX
      if (this.damageAreasAfterVFX) {
        const area = this.damageAreasAfterVFX
        switch (area.type) {
          case 'bomb_single': {
            const { row, col } = area
            for (let rr = row - 1; rr <= row + 1; rr++) {
              for (let cc = col - 1; cc <= col + 1; cc++) {
                if (rr === row && cc === col) continue
                const destroyedGem = this.damageCell(rr, cc)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            }
            break
          }
          case 'stripe_single': {
            const { row, col, isHorizontal } = area
            if (isHorizontal) {
              for (let c = 0; c < GRID_SIZE; c++) {
                if (c === col) continue
                const destroyedGem = this.damageCell(row, c)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            } else {
              for (let r = 0; r < GRID_SIZE; r++) {
                if (r === row) continue
                const destroyedGem = this.damageCell(r, col)
                if (destroyedGem) finalGemsToRemove.add(destroyedGem)
              }
            }
            break
          }
          case 'colorbomb_single': {
            const { targetColor, otherGem } = area
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const gem = this.grid[r][c]
                if (gem && gem.type === 'gem' && !this.isPowerup(gem) && gem.value === targetColor) {
                  const destroyedGem = this.damageCellIgnoreBlocker(r, c)
                  if (destroyedGem) finalGemsToRemove.add(destroyedGem)
                }
              }
            }
            if (otherGem && otherGem.sprite && otherGem.sprite.active) {
              const dRow = otherGem.sprite.getData('row')
              const dCol = otherGem.sprite.getData('col')
              const destroyedOtherGem = this.damageCellIgnoreBlocker(dRow, dCol)
              if (destroyedOtherGem) finalGemsToRemove.add(destroyedOtherGem)
            }
            break
          }
        }
        // Thêm chính power-up đang nổ vào danh sách xóa
        finalGemsToRemove.add(powerupGem)
        this.damageAreasAfterVFX = null
      } else {
        finalGemsToRemove = affectedGems
      }

      // 2. Loại bỏ các power-up được dành cho chain tiếp theo khỏi danh sách xóa
      if (this.destroyedPowerupsThisActivation && this.destroyedPowerupsThisActivation.length > 0) {
        console.log(`⚡ Chain Reaction: Preserving ${this.destroyedPowerupsThisActivation.length} power-ups for next chain step`)
        this.destroyedPowerupsThisActivation.forEach(info => {
          if (info && info.gem) {
            finalGemsToRemove.delete(info.gem)
          }
        })
      }

      // 3. Tính điểm & Cập nhật Objective
      const gemCounts = {}
      finalGemsToRemove.forEach(gem => {
        if (gem && gem.value && !this.isPowerup(gem)) {
          gemCounts[gem.value] = (gemCounts[gem.value] || 0) + 1
        }
      })
      for (const type in gemCounts) {
        this.updateObjectiveProgress('gem', type, gemCounts[type])
      }

      const multiplier = Math.pow(SCORE_VALUES.CHAIN_MULTIPLIER, Math.max(0, this.chainLevel - 1))
      const totalGemsRemoved = Object.values(gemCounts).reduce((sum, value) => sum + value, 0)
      let pointsThisTurn = totalGemsRemoved * SCORE_VALUES.GEM_MATCH * multiplier
      pointsThisTurn += SCORE_VALUES.POWERUP_ACTIVATE_SINGLE * multiplier

      if (pointsThisTurn > 0 && this.scene && this.scene.game && this.scene.game.events) {
        this.scene.game.events.emit('addScore', pointsThisTurn)
      }

      // 4. Xóa Gem & Blocker
      this.removeGemSprites(finalGemsToRemove)
      this.recalculateBlockerCounts()

      // 5. Thêm các power-up mới bị trúng đạn vào hàng đợi chain
      if (this.destroyedPowerupsThisActivation && this.destroyedPowerupsThisActivation.length > 0) {
        this.destroyedPowerupsThisActivation.forEach(info => {
          if (info && info.gem && info.gem.sprite && info.gem.sprite.active) {
            this.powerupChainQueue.push(info)
          }
        })
        this.destroyedPowerupsThisActivation = []
      }

      // [SỬA LỖI QUAN TRỌNG] Tắt cờ xử lý trước khi gọi Gravity để endOfTurn có thể gọi lại hàm này
      this.isProcessingPowerupChain = false

      // 6. Tiếp tục xử lý
      this.scene.time.delayedCall(200, () => {
        this.applyGravityAndRefill()
      })
    }

    // Ghi nhận kích hoạt
    this.trackPowerupActivation(powerupGem.value)

    // Chạy VFX tương ứng
    if (powerupGem.value === GEM_TYPES.BOMB) {
      this.powerupVFXManager.playBombEffect(powerupGem, affectedGems, onChainVFXComplete)
    } else if (powerupGem.value === GEM_TYPES.COLOR_BOMB) {
      this.powerupVFXManager.playColorBombEffect(powerupGem, affectedGems, onChainVFXComplete)
    } else if (powerupGem.value === GEM_TYPES.STRIPE) {
      this.powerupVFXManager.playStripeEffect(powerupGem, affectedGems, onChainVFXComplete)
    } else {
      onChainVFXComplete()
    }
  }
}
