import { startAssetStream } from './AssetStreamScene';
import Phaser from 'phaser'
import { Board } from '../objects/Board'
import { SCENE_KEYS, BOOSTER_TYPES } from '../utils/constants'
import { GRID_SIZE } from '../utils/constants'
import { BoosterVFXManager } from '../objects/vfx/BoosterVFXManager'
import { PowerupVFXManager } from '../objects/vfx/PowerupVFXManager'
import PlayerDataManager from '../managers/PlayerDataManager'
import AudioManager from '../managers/AudioManager'
import { SOUND_KEYS } from '../utils/SoundAssets'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    this.board = null
    this.levelData = null
    this.activeBooster = null
    this.firstSwapGem = null
    this.boosterVFXManager = null
    this.isPointerDown = false
    this.lastHoveredCell = { row: -1, col: -1 }
    this.timer = null
    this.currentTime = 0
    this.isTimerRunning = false
    this.currentScore = 0
    // --- THÊM BIẾN QUẢN LÝ NHẠC ---
    this.bgMusic = null;
    this.currentMusicKey = null; // Lưu key của nhạc đang phát để giải phóng sau
    // -----------------------------
    // --- THUỘC TÍNH CHO SWIPE/TAP ---
    this.swipeState = {
      isDown: false,
      downX: 0,
      downY: 0,
      downTime: 0,
      downObject: null,
      downRow: -1,
      downCol: -1,
    }
    this.SWIPE_THRESHOLD = 50
    this.TAP_THRESHOLD = 15
    this.TAP_MAX_TIME = 300
    // --- HỆ THỐNG GỢI Ý (HINT) ---
    this.idleTime = 0 // Thời gian không có input (ms)
    // --- TIMESTAMP CHẶN SỰ KIỆN DROP/POINTERUP ---
    this.lastDropTime = 0 // Thời điểm drop booster gần nhất
  }

  create(data) { // Cần nhận data từ LevelLoaderScene
    const { width, height } = this.scale

    // 1. THÊM BƯỚC NÀY ĐỂ LOAD LEVEL DATA TRƯỚC TIÊN
    this.loadLevelData(data)
    this.sound.stopAll();
    
    // --- THÊM ĐOẠN NÀY ĐỂ PHÁT NHẠC ---
    // Lấy ID của level hiện tại (mặc định là 1 nếu không có data)
    const currentLevelId = data?.levelId || 1;
    // Tạo key nhạc: map_01, map_02... dựa trên levelId
    const musicKey = `map_${currentLevelId.toString().padStart(2, '0')}`;
    this.currentMusicKey = musicKey; // Lưu lại để giải phóng sau

    this.game.events.on('musicVolumeChanged', this.onMusicVolumeChanged, this);
    if (this.cache.audio.exists(musicKey)) {
        this.startLevelMusic(musicKey);
    } else {
        this.time.delayedCall(300, () => {
            for (const key of this.cache.audio.getKeys()) {
                if (/^map_\d+$/.test(key) && key !== musicKey) this.cache.audio.remove(key);
            }
            this.musicStream = startAssetStream(this, {
                audio: [{ key: musicKey, path: `assets/sounds/optimized/${musicKey}.m4a` }],
                onComplete: () => {
                    this.musicStream = null;
                    if ((this.scene.isActive() || this.scene.isPaused()) && this.currentMusicKey === musicKey) {
                        this.startLevelMusic(musicKey);
                    }
                }
            });
        });
    }

    // --- XỬ LÝ WEBGL CONTEXT LOST/RESTORED ---
    
    // Off listener cũ trước để tránh trùng lặp
    this.game.renderer.off('contextlost', this.handleContextLost, this);
    this.game.renderer.off('contextrestored', this.handleContextRestored, this);
    
    // Bind các hàm handler để có thể off sau này
    this.handleContextLost = () => {
        console.warn("⚠️ WebGL Context Lost! Game đang bị treo...");
    };
    
    this.handleContextRestored = () => {
        console.log("✅ WebGL Context Restored! Đang tải lại...");
        
        // Dừng nhạc nếu đang phát và giải phóng khỏi cache
        if (this.bgMusic) {
            this.bgMusic.stop();
            this.bgMusic.destroy();
            this.bgMusic = null;
        }
        
        if (this.currentMusicKey && this.cache.audio.exists(this.currentMusicKey)) {
            this.cache.audio.remove(this.currentMusicKey);
            this.currentMusicKey = null;
        }
        
        // Dừng board nếu có
        if (this.board) {
            this.board = null;
        }
        
        // Restart lại scene để load lại mọi thứ từ đầu
        this.time.delayedCall(100, () => {
            const levelId = this.scene.settings?.data?.levelId || 1;
            this.scene.restart({ levelId: levelId });
        });
    };
    
    // Lắng nghe sự kiện mất và phục hồi WebGL context
    this.game.renderer.on('contextlost', this.handleContextLost, this);
    this.game.renderer.on('contextrestored', this.handleContextRestored, this);
    
    // --- FADE IN ĐỂ CHUYỂN CẢNH MƯỢT MÀ ---
    this.cameras.main.fadeIn(300, 0, 0, 0);
    // ----------------------------------------
    
    // Debug: Kiểm tra xem ảnh có được load không
    console.log('GameScene create - Kiểm tra cache:')
    console.log('map1_background:', this.textures.exists('map1_background'))
    console.log('playground1_background:', this.textures.exists('playground1_background'))
    console.log('playground1_border:', this.textures.exists('playground1_border'))
    console.log('cell:', this.textures.exists('cell'))
    console.log('gem_red:', this.textures.exists('gem_red'))
    console.log('gem_green:', this.textures.exists('gem_green'))
    console.log('gem_blue:', this.textures.exists('gem_blue'))
    console.log('gem_purple:', this.textures.exists('gem_purple'))
    console.log('gem_yellow:', this.textures.exists('gem_yellow'))
    console.log('gem_orange:', this.textures.exists('gem_orange'))

    // Hiển thị background map1 (giữ nguyên)
    this.add.image(width / 2, height / 2, 'map1_background')
      .setDisplaySize(width, height)
      .setDepth(0) 

    // Tạo khung chơi ở giữa màn hình
    const playgroundSize = Math.min(width, height) * 0.9
    const playgroundX = width / 2
    const playgroundY = height / 2 + height / 8 - height/48

    // 2. SỬ DỤNG THEME TỪ LEVEL DATA
    const theme = this.levelData?.playgroundTheme || '1' // Mặc định là '1'
    const backgroundKey = `playground${theme}_background`
    const borderKey = `playground${theme}_border`

    // Hiển thị nền khung chơi (Background)
    if (this.textures.exists(backgroundKey)) {
      const playgroundBackground = this.add.image(playgroundX, playgroundY, backgroundKey)
        .setDisplaySize(playgroundSize, playgroundSize)
        .setDepth(0); 
      console.log(`Đã tạo ${backgroundKey} thành công`)
    } else {
      console.error(`Không tìm thấy ${backgroundKey} texture!`)
    }

    // Hiển thị viền khung chơi (Border)
    if (this.textures.exists(borderKey)) {
      const playgroundBorder = this.add.image(playgroundX, playgroundY, borderKey)
        .setDisplaySize(playgroundSize, playgroundSize)
        .setDepth(3); 
      console.log(`Đã tạo ${borderKey} thành công`)
    } else {
      console.error(`Không tìm thấy ${borderKey} texture!`)
    }

    // Tạo Board
    this.createBoard(playgroundX, playgroundY, playgroundSize) 
    // Khởi tạo VFX manager cho booster (giữ nguyên)
    this.boosterVFXManager = new BoosterVFXManager(this, this.board)
    // Khởi chạy UIScene overlay (giữ nguyên)
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene')

    // Sự kiện booster từ UIScene
    this.game.events.on('boosterSelected', this.onBoosterSelected, this)
    this.game.events.on('boosterActivated', this.onBoosterActivated, this)
    // Lắng nghe sự kiện kéo thả từ UIScene
    this.game.events.on('boosterDropped', this.onBoosterDropped, this)
    // Lắng nghe sự kiện đang kéo để hiển thị preview
    this.game.events.on('boosterDragging', this.onBoosterDragging, this)
    this.game.events.on('boosterDragEnded', this.onBoosterDragEnded, this)
    // Bật hệ thống pointer để hỗ trợ VFX và booster
    // Off trước khi On để tránh duplicate listeners khi hot reload
    this.input.off('gameobjectdown', this.onBoardClick, this)
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointermove', this.onPointerMove, this)
    this.input.off('pointerup', this.onPointerUp, this)
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    // Lưới an toàn khi board bận: xóa preview ngay
    this.game.events.on('boardBusy', this.handleBoardBusy, this)

    // Lắng nghe sự kiện hủy chọn từ UIScene
    this.game.events.on('boosterSelectionCleared', this.handleBoosterCleared, this)

    // Rung màn hình khi cần
    this.game.events.on('screenShake', this.handleScreenShake, this)

    // Nút cài đặt
    const settingsButton = this.add.image(40, 40, 'setting_button')
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
      .setScale(1.0)

    settingsButton.on('pointerdown', () => {
      const currentLevelId = this.scene.settings?.data?.levelId || 1
      this.scene.launch('PausePopup', { levelId: currentLevelId })
    })

    settingsButton.on('pointerover', () => {
      this.tweens.add({ targets: settingsButton, scale: 1.1, duration: 100 })
    })
    settingsButton.on('pointerout', () => {
      this.tweens.add({ targets: settingsButton, scale: 1.0, duration: 100 })
    })
    // Khởi động timer UI nếu có cấu hình
    this.startTimer()

    // --- LOGIC TÍNH ĐIỂM ---
    this.game.events.on('addScore', this.handleAddScore, this)
    this.time.delayedCall(100, () => {
      if (this.scene.isActive('GameScene')) {
        this.game.events.emit('scoreUpdated', this.currentScore)
      }
    })

    // Đảm bảo hàm shutdown được gọi đúng 1 lần mỗi lần Scene tắt
    this.events.off('shutdown', this.shutdown, this)
    this.events.on('shutdown', this.shutdown, this)
  }

  // XÓA HÀM createGameGrid() nếu còn (vì không dùng)

  // SỬA HÀM createBoard: Gọi board.loadLevel sau khi board được tạo
  createBoard(centerX, centerY, playgroundSize) {
    const gridSize = 9
    const cellSize = playgroundSize * 0.93 / gridSize
    const boardOffsetX = centerX - (cellSize * gridSize) / 2
    const boardOffsetY = centerY - (cellSize * gridSize) / 2
    
    // === PHẦN SỬA LỖI BẮT ĐẦU TỪ ĐÂY ===

    // 1. TẠO MỘT LAYER ĐỂ CHỨA TẤT CẢ CÁC GEM
    // Layer này sẽ hoạt động như một container riêng
    this.gemLayer = this.add.layer()

    // === PHẦN SỬA LỖI NẰM Ở ĐÂY ===
    // 2. GÁN DEPTH CHO LAYER ĐỂ KIỂM SOÁT THỨ TỰ RENDER
    // Layer này sẽ nằm trên các cell (depth 1) VÀ TRÊN BORDER (depth 3) để VFX không bị che
    this.gemLayer.setDepth(4) // Tăng lên 4 để cao hơn border (3)
    // ===============================

    // 3A. TẠO MASK KHÍT CHO GEM LAYER (board thật)
    const maskShape = this.make.graphics()
    maskShape.fillStyle(0xffffff)

    // === LOGIC MASK: CHỈ VẼ CHO KHU VỰC BOARD THẬT ===
    const gridLayout = this.levelData.gridLayout

    // Chỉ vẽ mask cho các ô không null trong gridLayout
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (gridLayout[row][col] !== null) {
          const cellX = boardOffsetX + col * cellSize
          const cellY = boardOffsetY + row * cellSize
          maskShape.fillRect(cellX, cellY, cellSize, cellSize)
        }
      }
    }
    const gemMask = maskShape.createGeometryMask()

    // 3B. ÁP DỤNG MẶT NẠ CHỈ CHO LAYER GEM
    this.gemLayer.setMask(gemMask)
    
    // 4. XÓA BỎ LỆNH GỌI setMask CHO CAMERA
    // this.cameras.main.setMask(gemMask) // << XÓA HOẶC CHÚ THÍCH DÒNG NÀY

    // 5. TẠO LAYER RIÊNG CHO VFX
    this.vfxLayer = this.add.layer()
    this.vfxLayer.setDepth(25) // Depth cao hơn gemLayer để VFX hiển thị trên cả
    // Áp dụng mask bàn cờ để nốt nhạc / VFX không bay ra ngoài phạm vi board
    if (gemMask) {
      this.vfxLayer.setMask(gemMask)
    }

    // === KẾT THÚC PHẦN SỬA LỖI ===

    // Tạo PowerupVFXManager và truyền vfxLayer vào
    this.powerupVFXManager = new PowerupVFXManager(this, this.vfxLayer)
    // Truyền layer vào cho Board (Board sẽ tự tạo mask riêng cho fake gem)
    this.board = new Board(this, boardOffsetX, boardOffsetY, cellSize, this.powerupVFXManager, this.gemLayer)
    
    // Load level vào Board (Dùng this.levelData đã load ở create)
    if (this.levelData) {
        this.board.loadLevel(this.levelData)
        // << GỌI HÀM KHỞI TẠO NHIỆM VỤ CỦA BOARD >>
        this.board.initializeObjectives(this.levelData);
    }
    
    // Lắng nghe sự kiện từ Board
    this.setupBoardEvents()
  }

  // SỬA HÀM loadLevelData: chỉ load data vào this.levelData.
  loadLevelData(data) {
    // Load level data từ cache (đã load trong PreloaderScene)
    const selectedLevelId = data?.levelId || 1 // Dùng data từ create()
    this.levelData = this.cache.json.get(`level_${selectedLevelId}`)
    
    if (!this.levelData) {
      console.error('Level data not found in cache!')
      return
    }
    
    console.log('Loaded level data from cache:', this.levelData)
    
    // << GỌI HÀM KHỞI TẠO NHIỆM VỤ CỦA BOARD >>
    if (this.board) {
      this.board.initializeObjectives(this.levelData);
    }
  }

  setupBoardEvents() {
    // Lắng nghe sự kiện từ Board
    this.events.on('gemSelected', this.onGemSelected, this)
    this.events.on('blockerSelected', this.onBlockerSelected, this)
  }

  onBoosterSelected(boosterType) {
    // === PHẦN SỬA LỖI BẮT ĐẦU TỪ ĐÂY ===

    // 1. RA LỆNH CHO BOARD HỦY LỰA CHỌN GEM HIỆN TẠI (NẾU CÓ)
    this.board?.clearSelection(); // Dùng optional chaining `?.` để an toàn

    // === KẾT THÚC PHẦN SỬA LỖI ===

    // 2. Dọn dẹp hiệu ứng của booster cũ (nếu có)
    this.boosterVFXManager?.clearCurrentVFX()

    // 3. Cập nhật trạng thái cho booster mới
    this.activeBooster = boosterType
    this.firstSwapGem = null

    // 4. Hiển thị hiệu ứng ban đầu cho booster mới (nếu cần)
    if (boosterType === BOOSTER_TYPES.SHUFFLE && this.boosterVFXManager) {
      this.boosterVFXManager.showShuffleConfirmation()
    }
  }

  // === THÊM HÀM DỌN DẸP BOOSTER TRUNG TÂM ===
  clearActiveBooster() {
    if (this.activeBooster) {
      console.log(`Clearing active booster: ${this.activeBooster}`)
      this.activeBooster = null
      this.firstSwapGem = null
      // Tắt hiệu ứng lúc lắc và preview
      this.boosterVFXManager?.clearPreview()
    }
  }

  /**
   * Helper để trừ booster khi sử dụng
   * @param {string} boosterType - Loại booster (HAMMER, SWAP, ROCKET, SHUFFLE)
   * @returns {boolean} true nếu trừ thành công, false nếu không đủ item
   */
  tryConsumeBooster(boosterType) {
    const key = boosterType.toLowerCase();
    // Gọi hàm updateBooster với số âm để trừ
    const success = PlayerDataManager.updateBooster(key, -1);
    
    if (success) {
        // Nếu trừ thành công, lấy số lượng mới và báo cho UI
        const newCount = PlayerDataManager.getBoosterCount(key);
        this.game.events.emit('boosterCountUpdated', { type: boosterType, count: newCount });
        return true;
    } else {
        console.log("Không đủ item để dùng!");
        return false;
    }
  }

  startTimer() {
    if (!this.levelData || !this.levelData.starTimes) return
    this.isTimerRunning = true
    this.currentTime = this.levelData.starTimes.startTime
    this.timer = this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true })
    // Chỉ emit nếu có UIScene quan tâm (tránh emit thừa cho level không có starTimes)
    this.game.events.emit('updateTimer', this.currentTime)
  }

  updateTimer() {
    if (!this.isTimerRunning) return
    this.currentTime = Math.max(0, this.currentTime - 1)
    this.game.events.emit('updateTimer', this.currentTime)
    if (this.currentTime <= 0) {
      this.isTimerRunning = false
      this.timer.remove()
      console.log('Hết giờ!')
      // TODO: xử lý thua game
    }
  }

  startLevelMusic(musicKey) {
    if (this.sound.get(musicKey) || this.cache.audio.exists(musicKey)) {
        console.log(`Đang phát nhạc nền: ${musicKey}`);

        this.bgMusic?.destroy();

        // << [AUDIO] Lấy volume từ AudioManager >>
        const baseVolume = 0.3; // Âm lượng cơ bản
        const targetVolume = baseVolume * AudioManager.getMusicVolume(); // Nhân với music volume

        // Phát nhạc mới với chế độ lặp lại (loop), bắt đầu với volume = 0
        this.bgMusic = this.sound.add(musicKey, {
            loop: true,
            volume: 0 // Bắt đầu từ 0 để fade in
        });
        this.bgMusic.play();

        // Lưu baseVolume để tính lại khi volume thay đổi
        this.bgMusic.baseVolume = baseVolume;

        // Fade in dần lên âm lượng mong muốn trong 2 giây
        this.tweens.add({
            targets: this.bgMusic,
            volume: targetVolume,
            duration: 2000,
            ease: 'Linear',
            onComplete: () => {
                console.log(`Nhạc nền đã fade in đến volume ${targetVolume}`);
            }
        });

    }
  }

  shutdown() {
    this.musicStream?.cancel();
    this.musicStream = null;
    // << [AUDIO] Dọn dẹp event listener >>
    this.game.events.off('musicVolumeChanged', this.onMusicVolumeChanged, this);
    
    // << [AUDIO] Dừng TẤT CẢ âm thanh của scene này >>
    console.log(`[GameScene] Shutting down - Stopping all sounds`);
    this.sound.stopAll(); // Dừng tất cả âm thanh
    
    // --- THÊM ĐOẠN NÀY ĐỂ TẮT NHẠC KHI THOÁT VÀ GIẢI PHÓNG BỘ NHỚ ---
    if (this.bgMusic) {
        console.log(`Đang dừng nhạc: ${this.currentMusicKey}`);
        this.bgMusic.destroy();
        this.bgMusic = null;
    }
    
    // Keep the decoded current track for replay. LevelLoaderScene evicts it
    // when a different level is selected, bounding the cache to one track.
    this.currentMusicKey = null;
    // -------------------------------------------
    
    this.isTimerRunning = false
    // 1. Dừng timer nếu đang chạy
    if (this.timer) this.timer.remove()

    // 2. Dọn dẹp các listener mà GameScene đã đăng ký
    this.game.events.off('boosterSelected', this.onBoosterSelected, this)
    this.game.events.off('boosterActivated', this.onBoosterActivated, this)
    this.game.events.off('boosterDropped', this.onBoosterDropped, this)
    this.game.events.off('boosterDragging', this.onBoosterDragging, this)
    this.game.events.off('boosterDragEnded', this.onBoosterDragEnded, this)
    this.game.events.off('boardBusy', this.handleBoardBusy, this)
    this.game.events.off('boosterSelectionCleared', this.handleBoosterCleared, this)
    this.game.events.off('screenShake', this.handleScreenShake, this)
    this.game.events.off('addScore', this.handleAddScore, this)

    // 3. Dọn dẹp input listeners
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointermove', this.onPointerMove, this)
    this.input.off('pointerup', this.onPointerUp, this)

    // 4. Dọn dẹp listener từ Board events
    this.events.off('gemSelected', this.onGemSelected, this)
    this.events.off('blockerSelected', this.onBlockerSelected, this)
    
    // 5. Dọn dẹp listener WebGL
    if (this.handleContextLost) {
      this.game.renderer.off('contextlost', this.handleContextLost, this);
    }
    if (this.handleContextRestored) {
      this.game.renderer.off('contextrestored', this.handleContextRestored, this);
    }
  }

  // << THÊM CÁC HÀM HANDLER ĐƯỢC ĐẶT TÊN >>
  handleBoardBusy(isBusy) {
    if (isBusy && this.boosterVFXManager) {
      this.boosterVFXManager.clearPreview()
    }
  }

  handleBoosterCleared() {
    this.clearActiveBooster()
  }

  /**
   * Xử lý sự kiện kéo thả booster từ UIScene
   * @param {object} data - { type, x, y }
   */
  onBoosterDropped(data) {
    const { type, x, y } = data;

    // 1. Nếu đang bận thì thôi
    if (this.board.boardBusy) return;

    // 2. LƯU TIMESTAMP: Để onPointerUp biết mà bỏ qua trong 150ms
    this.lastDropTime = Date.now();

    // 3. Chuyển đổi tọa độ màn hình sang tọa độ thế giới trong GameScene
    const worldPoint = this.cameras.main.getWorldPoint(x, y);

    // 3. Tìm xem tại vị trí đó có Gem hay Cell nào không
    const clickedObject = this.getObjectAt(worldPoint.x, worldPoint.y);

    if (clickedObject) {
      const row = clickedObject.getData('row');
      const col = clickedObject.getData('col');

      if (row !== undefined && col !== undefined) {
        console.log(`Dropped ${type} on [${row}, ${col}]`);
        
        // Xử lý theo từng loại booster
        if (type === BOOSTER_TYPES.HAMMER) {
          // Trừ item trước khi dùng
          if (this.tryConsumeBooster(type)) {
            this.game.events.emit('boardBusy', true);
            this.boosterVFXManager.playHammerEffect(row, col, () => {
              this.board.useHammer(row, col);
            });
          }
        } 
        else if (type === BOOSTER_TYPES.ROCKET) {
          if (this.tryConsumeBooster(type)) {
            // << PHÁT ÂM THANH ROCKET >>
            const sfxVolume = AudioManager.getSoundVolume();
            if (sfxVolume > 0) {
              this.sound.play(SOUND_KEYS.ROCKET, { volume: sfxVolume });
            }

            this.game.events.emit('boardBusy', true);
            this.boosterVFXManager.playRocketEffect(col, () => {
              this.board.useRocket(row, col);
            });
          }
        }
        else if (type === BOOSTER_TYPES.SHUFFLE) {
          if (this.tryConsumeBooster(type)) {
            this.game.events.emit('boardBusy', true);
            const allGemSprites = [];
            const allBlockerSprites = [];
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                const gem = this.board.grid[r]?.[c];
                if (gem && gem.sprite) allGemSprites.push(gem.sprite);
                const blocker = this.board.blockerGrid[r]?.[c];
                if (blocker) allBlockerSprites.push(blocker);
              }
            }
            this.board.useShuffle();
            this.boosterVFXManager.playFakeShuffleEffect(allGemSprites, allBlockerSprites, () => {
              allGemSprites.forEach(gem => { if (gem && gem.active) gem.setVisible(true); });
              allBlockerSprites.forEach(blocker => { if (blocker && blocker.active) blocker.setVisible(true); });
              this.board.checkForNewMatches();
            });
          }
        }
        else if (type === BOOSTER_TYPES.SWAP) {
          const gem = this.board.grid[row][col];
          
          // Chỉ chọn nếu là Gem (không swap được ô trống hoặc blocker cứng)
          if (gem && gem.type === 'gem') {
            console.log(`[SWAP] Selected 1st Gem: [${row}, ${col}]`);

            // A. Xóa viền vàng (drag preview) trước
            this.boosterVFXManager?.clearPreview();

            // B. Đặt trạng thái đang dùng SWAP
            this.activeBooster = BOOSTER_TYPES.SWAP;
            
            // C. Lưu viên ngọc đầu tiên
            this.firstSwapGem = gem;
            
            // D. Hiển thị hiệu ứng "lúc lắc" (đã có trong VFX Manager)
            this.boosterVFXManager?.showSwapPreview(row, col);
            
            // KHÔNG emit 'boosterSelected' ở đây!
            // Vì onBoosterSelected sẽ reset firstSwapGem = null và tắt hiệu ứng lắc lư
            
            // LƯU Ý: CHƯA TRỪ ITEM TẠI ĐÂY!
          }
        }
      }
    } else {
      // Nếu thả ra ngoài bàn cờ -> Không làm gì (giữ nguyên item)
      console.log('Booster dropped outside board. Cancelled.');
    }
  }

  /**
   * Hàm phụ trợ để tìm Object (Gem/Cell) tại tọa độ (x, y)
   * @param {number} x - Tọa độ X trong world
   * @param {number} y - Tọa độ Y trong world
   * @returns {Phaser.GameObjects.GameObject|null}
   */
  getObjectAt(x, y) {
    // Lấy danh sách các gem và cell
    const listToCheck = this.children.list.concat(this.gemLayer.list);
    
    // Tìm cái nào chứa điểm x, y
    for (let obj of listToCheck) {
      if (obj.getData && (obj.getData('isGem') || obj.getData('isCell'))) {
        if (obj.getBounds().contains(x, y)) {
          return obj;
        }
      }
    }
    return null;
  }

  /**
   * Xử lý khi đang kéo booster trên màn hình
   */
  onBoosterDragging(data) {
    const { type, x, y } = data;

    if (!this.board || this.board.boardBusy) return;

    // 1. Chuyển tọa độ màn hình -> World
    const worldPoint = this.cameras.main.getWorldPoint(x, y);

    // 2. Tìm đối tượng dưới chuột
    const hoveredObject = this.getObjectAt(worldPoint.x, worldPoint.y);

    if (hoveredObject) {
        const row = hoveredObject.getData('row');
        const col = hoveredObject.getData('col');

        if (row !== undefined && col !== undefined) {
            // 3. Gọi VFX Manager để hiển thị preview
            this.boosterVFXManager.showDragPreview(type, row, col);
            return;
        }
    }
    
    // Nếu kéo ra ngoài board -> Xóa preview
    this.boosterVFXManager.clearPreview();
  }

  /**
   * Xử lý khi thả tay -> Xóa hết preview
   */
  onBoosterDragEnded() {
    // Nếu đang là chế độ SWAP (vừa drop xong), ĐỪNG xóa hiệu ứng lắc lư
    if (this.activeBooster === BOOSTER_TYPES.SWAP) {
      return;
    }

    if (this.boosterVFXManager) {
        this.boosterVFXManager.clearPreview();
    }
  }

  handleScreenShake(shakeData) {
    this.cameras.main.shake(shakeData.duration, shakeData.intensity)
  }

  onBoosterActivated(boosterType) {
    if (!this.board || this.board.boardBusy) return
    // Logic Shuffle đã chuyển sang onPointerUp
  }

  onBoardClick(pointer, gameObject) {
    if (!this.activeBooster || !this.board || this.board.boardBusy) return
    const row = gameObject?.getData('row')
    const col = gameObject?.getData('col')
    if (row === undefined || col === undefined) return
    switch (this.activeBooster) {
      case BOOSTER_TYPES.HAMMER:
        this.board.useHammer(row, col)
        this.activeBooster = null
        break
      case BOOSTER_TYPES.ROCKET:
        this.board.useRocket(row, col)
        this.activeBooster = null
        break
      case BOOSTER_TYPES.SWAP: {
        const clickedGem = this.board.grid[row][col]
        if (!clickedGem) return
        if (!this.firstSwapGem) {
          this.firstSwapGem = clickedGem
        } else {
          this.board.useSwap(this.firstSwapGem, clickedGem)
          this.firstSwapGem = null
          this.activeBooster = null
        }
        break
      }
    }
  }

  // === Pointer-based input for boosters with VFX ===
  getObjectUnderPointer(pointer) {
    const objects = this.input.hitTestPointer(pointer)
    // Ưu tiên đối tượng có data row/col
    return objects.find(o => typeof o.getData === 'function' && (o.getData('row') !== undefined && o.getData('col') !== undefined))
  }

  onPointerDown(pointer) {
    this.isPointerDown = true
    this.idleTime = 0 // Reset bộ đếm vì người chơi đang thao tác
    
    // << [HINT SYSTEM] Xóa hint khi người chơi thao tác >>
    if (this.board && typeof this.board.clearHint === 'function') {
      this.board.clearHint()
    }
    
    // --- LOGIC MỚI CHO SWIPE STATE ---
    this.swipeState.isDown = true
    this.swipeState.downX = pointer.x
    this.swipeState.downY = pointer.y
    this.swipeState.downTime = pointer.time

    const listToCheck = this.children.list.concat(this.gemLayer.list)
    const clickedObject = this.input.manager.hitTest(pointer, listToCheck, this.cameras.main)
      .find(obj => obj.getData('isGem') || obj.getData('isCell'))
    if (clickedObject) {
      this.swipeState.downObject = clickedObject
      this.swipeState.downRow = clickedObject.getData('row')
      this.swipeState.downCol = clickedObject.getData('col')
    } else {
      this.swipeState.downObject = null
      this.swipeState.downRow = -1
      this.swipeState.downCol = -1
    }

    // Logic cũ cho Rocket booster (giữ nguyên)
    if (!this.activeBooster || !this.board || this.board.boardBusy) return
    if (this.activeBooster === BOOSTER_TYPES.ROCKET) {
      this.onPointerMove(pointer)
    }
  }

  onPointerMove(pointer) {
    if (!this.isPointerDown) return
    if (this.activeBooster !== BOOSTER_TYPES.ROCKET) return
    if (!this.board || this.board.boardBusy) return

    // === BẮT ĐẦU SỬA LỖI ===
    // Danh sách các đối tượng cần kiểm tra: bao gồm con của Scene và con của gemLayer
    const listToCheck = this.children.list.concat(this.gemLayer.list)

    const gameObjects = this.input.manager.hitTest(pointer, listToCheck, this.cameras.main)
    // === KẾT THÚC SỬA LỖI ===

    const targetObject = gameObjects.find(obj => typeof obj.getData === 'function' && (obj.getData('isGem') || obj.getData('isCell')))
    if (targetObject) {
      const row = targetObject.getData('row')
      const col = targetObject.getData('col')
      if (this.lastHoveredCell.row !== row || this.lastHoveredCell.col !== col) {
        this.lastHoveredCell = { row, col }
        this.boosterVFXManager?.showRocketPreview(row, col)
      }
    } else {
      this.boosterVFXManager?.clearPreview()
      this.lastHoveredCell = { row: -1, col: -1 }
    }
  }


  /**
   * [HÀM MỚI] Xử lý khi phát hiện một cử chỉ swipe
   */
  handleSwipe(startRow, startCol, direction) {
    // Dọn mọi selection/tween cũ nếu có trước khi thực hiện swap bằng swipe
    if (this.board && typeof this.board.clearSelection === 'function') {
      this.board.clearSelection()
    }
    const gem1 = this.board.grid[startRow][startCol]
    if (!gem1 || gem1.type !== 'gem') {
      console.log('Swipe failed: No gem at start pos')
      return
    }

    const neighbor = this.board.getNeighborCell(startRow, startCol, direction)
    if (!neighbor) {
      console.log('Swipe failed: Invalid neighbor')
      return
    }
    const { row: targetRow, col: targetCol } = neighbor

    if (this.board.isCellBlockedForMovement(targetRow, targetCol)) {
      console.log('Swipe failed: Target cell is blocked')
      return
    }

    const gem2 = this.board.grid[targetRow][targetCol]
    if (!gem2 || gem2.type !== 'gem') {
      console.log('Swipe failed: No gem at target pos')
      return
    }
    console.log(`Input: SWIPE Action - Swapping [${startRow},${startCol}] with [${targetRow},${targetCol}]`)
    this.board.swapGems(gem1, gem2)
  }

  onPointerUp(pointer) {
    this.isPointerDown = false

    const wasDown = this.swipeState.isDown
    this.swipeState.isDown = false

    // Nếu đây là sự kiện thả tay do Drop Booster (trong vòng 150ms), ta bỏ qua
    if (Date.now() - this.lastDropTime < 150) {
      this.swipeState.downObject = null;
      return;
    }

    // Chỉ thoát nếu board bận hoặc chưa nhấn; bỏ check downObject để tránh race condition
    if (this.board.boardBusy || !wasDown) {
      this.clearActiveBooster()
      this.swipeState.downObject = null
      return
    }

    const upX = pointer.x
    const upY = pointer.y
    const upTime = pointer.time
    const deltaX = upX - this.swipeState.downX
    const deltaY = upY - this.swipeState.downY
    const deltaTime = upTime - this.swipeState.downTime

    // HitTest tại vị trí UP (dùng cho Tap và Booster)
    const listToCheck = this.children.list.concat(this.gemLayer.list)
    const clickedObjectUp = this.input.manager.hitTest(pointer, listToCheck, this.cameras.main)
      .find(obj => obj.getData('isGem') || obj.getData('isCell'))

    // Ưu tiên xử lý Booster bằng đối tượng tại UP
    if (this.activeBooster) {
      console.log('Input: Processing BOOSTER action')

      // --- LOGIC SWAP MỚI ---
      if (this.activeBooster === BOOSTER_TYPES.SWAP) {
        
        // Nếu click ra ngoài khoảng không -> Hủy luôn cho tiện
        if (!clickedObjectUp) {
          this.clearActiveBooster();
          this.game.events.emit('boosterSelectionCleared'); // Báo UI tắt sáng
          this.swipeState.downObject = null;
          return;
        }

        const targetRow = clickedObjectUp.getData('row');
        const targetCol = clickedObjectUp.getData('col');
        const clickedGem = this.board.grid[targetRow]?.[targetCol];

        // Nếu click vào cái gì không phải Gem -> Bỏ qua hoặc Hủy
        if (!clickedGem || clickedGem.type !== 'gem') return;

        // KIỂM TRA LOGIC 2 BƯỚC:
        
        // Trường hợp A: Chưa có viên 1 (Lỡ click chọn từ UI thay vì kéo thả)
        if (!this.firstSwapGem) {
          this.firstSwapGem = clickedGem;
          this.boosterVFXManager?.showSwapPreview(targetRow, targetCol);
        } 
        // Trường hợp B: Đã có viên 1, đang chọn viên 2
        else {
          
          // 1. Nếu CLICK LẠI VIÊN CŨ -> HỦY BỎ
          if (this.firstSwapGem === clickedGem) {
            console.log("[SWAP] Clicked same gem -> Cancelled");
            this.clearActiveBooster();
            this.game.events.emit('boosterSelectionCleared'); // Báo UI tắt sáng
          } 
          // 2. Nếu CLICK VIÊN KHÁC -> THỰC HIỆN SWAP
          else {
            console.log("[SWAP] Clicked 2nd gem -> Executing Swap");
            
            // Bây giờ mới trừ Item
            if (this.tryConsumeBooster(this.activeBooster)) {
              this.game.events.emit('boardBusy', true);
              
              // Gọi lệnh Swap trong Board
              this.board.useSwap(this.firstSwapGem, clickedGem);
            }
            
            // Dọn dẹp trạng thái sau khi dùng
            this.clearActiveBooster();
            this.game.events.emit('boosterSelectionCleared');
          }
        }
        
        this.swipeState.downObject = null;
        return;
      }
      // ----------------------

      // Kiểm tra xem click có hợp lệ không
      const targetRow = clickedObjectUp?.getData('row')
      const targetCol = clickedObjectUp?.getData('col')
      
      // Shuffle chỉ cần click trúng board, không cần row/col cụ thể
      const isValidClick = (targetRow !== undefined) || (this.activeBooster === BOOSTER_TYPES.SHUFFLE && clickedObjectUp)

      if (!isValidClick) {
        // Click không trúng gì (click ra ngoài) -> GIỮ NGUYÊN booster, không làm gì
        console.log('Booster click missed target. Keeping booster selected.')
        this.swipeState.downObject = null
        return
      }

      // Click hợp lệ -> Trừ item trước khi dùng
      const boosterToUse = this.activeBooster
      
      // Nếu không trừ được (hết item hack?), hủy bỏ hành động
      if (!this.tryConsumeBooster(boosterToUse)) {
          this.clearActiveBooster()
          this.swipeState.downObject = null
          return
      }

      this.clearActiveBooster()
      
      switch (boosterToUse) {
        case BOOSTER_TYPES.HAMMER:
          this.game.events.emit('boardBusy', true)
          this.boosterVFXManager.playHammerEffect(targetRow, targetCol, () => {
            this.board.useHammer(targetRow, targetCol)
          })
          break
        case BOOSTER_TYPES.ROCKET:
          this.game.events.emit('boardBusy', true)
          this.boosterVFXManager.playRocketEffect(targetCol, () => {
            this.board.useRocket(targetRow, targetCol)
          })
          break
        case BOOSTER_TYPES.SHUFFLE:
          this.game.events.emit('boardBusy', true)
          const allGemSprites = []
          const allBlockerSprites = []
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              const gem = this.board.grid[r]?.[c]
              if (gem && gem.sprite) allGemSprites.push(gem.sprite)
              const blocker = this.board.blockerGrid[r]?.[c]
              if (blocker) allBlockerSprites.push(blocker)
            }
          }
          this.board.useShuffle()
          this.boosterVFXManager.playFakeShuffleEffect(allGemSprites, allBlockerSprites, () => {
            allGemSprites.forEach(gem => { if (gem && gem.active) gem.setVisible(true) })
            allBlockerSprites.forEach(blocker => { if (blocker && blocker.active) blocker.setVisible(true) })
            this.board.checkForNewMatches()
          })
          break
      }

      this.swipeState.downObject = null
      return
    }

    // Tap dựa trên vị trí UP
    const isTap = Math.abs(deltaX) < this.TAP_THRESHOLD && Math.abs(deltaY) < this.TAP_THRESHOLD && deltaTime < this.TAP_MAX_TIME
    if (isTap) {
      if (!clickedObjectUp) {
        this.swipeState.downObject = null
        return
      }
      const targetRow = clickedObjectUp.getData('row')
      const targetCol = clickedObjectUp.getData('col')
      console.log('Input: Detected TAP')
      this.board.handleInput({ type: 'gem_click', row: targetRow, col: targetCol })
      this.swipeState.downObject = null
      return
    }

    // Swipe dựa trên vị trí DOWN; nếu bắt đầu từ khoảng không thì bỏ qua
    const isSwipe = Math.max(Math.abs(deltaX), Math.abs(deltaY)) > this.SWIPE_THRESHOLD && deltaTime < 500
    if (isSwipe) {
      if (!this.swipeState.downObject) {
        console.log('Input: Ignored SWIPE (started from empty space or fast click race condition)')
        this.swipeState.downObject = null
        return
      }
      const startRow = this.swipeState.downRow
      const startCol = this.swipeState.downCol
      console.log('Input: Detected SWIPE')
      let direction = null
      if (Math.abs(deltaX) > Math.abs(deltaY)) direction = deltaX > 0 ? 'right' : 'left'
      else direction = deltaY > 0 ? 'down' : 'up'
      if (direction) this.handleSwipe(startRow, startCol, direction)
      this.swipeState.downObject = null
      return
    }

    // Drag
    console.log('Input: Ignored (drag, not tap or swipe)')
    this.swipeState.downObject = null
  }

  onGemSelected(data) {
    console.log(`Gem selected: ${data.type} at ${data.row},${data.col}`)
    // TODO: Hiệu ứng chọn gem, logic match-3
  }

  onBlockerSelected(data) {
    console.log(`Blocker selected: ${data.type} at ${data.row},${data.col}`)
    // TODO: Logic phá blocker
  }

  // Hàm xử lý input chính
  handleInput(inputData) {
    console.log('GameScene received input:', inputData)
    
    if (this.board) {
      this.board.handleInput(inputData)
    }
  }

  // Hàm load level từ JSON file
  async loadLevelFromJSON(levelId) {
    try {
      const response = await fetch(`assets/levels/level_${levelId}.json`)
      if (!response.ok) {
        throw new Error(`Failed to load level ${levelId}`)
      }
      
      const levelData = await response.json()
      this.levelData = levelData
      
      if (this.board) {
        this.board.loadLevel(levelData)
      }
      
      console.log(`Loaded level ${levelId} from JSON:`, levelData)
      return levelData
    } catch (error) {
      console.error('Error loading level:', error)
      return null
    }
  }

  /**
   * << [AUDIO] Callback khi music volume thay đổi >>
   */
  onMusicVolumeChanged(newVolume) {
    if (this.bgMusic && this.bgMusic.isPlaying) {
      const baseVolume = this.bgMusic.baseVolume || 1.0;
      this.bgMusic.setVolume(baseVolume * newVolume);
      console.log(`🎵 GameScene music volume updated: ${baseVolume * newVolume}`);
    }
  }

  /**
   * [HỆ THỐNG GỢI Ý] Phaser update loop - Đếm thời gian idle và hiển thị hint
   */
  update(time, delta) {
    // Nếu board bận, xóa hint và không đếm giờ
    if (!this.board || this.board.boardBusy) {
      this.idleTime = 0
      // Xóa hint khi board bận (đang xử lý match, gravity, etc.)
      if (this.board && typeof this.board.clearHint === 'function') {
        this.board.clearHint()
      }
      return
    }

    this.idleTime += delta

    // Nếu rảnh quá 5000ms (5 giây) thì hiện gợi ý
    if (this.idleTime > 5000) {
      this.board.showHint()
      this.idleTime = -5000 // Reset về âm để đợi thêm 10s nữa mới hint lại (tránh spam)
    }
  }

  /**
   * [HÀM MỚI] Xử lý khi nhận điểm từ BoardState
   */
  handleAddScore(points) {
    if (typeof points !== 'number') return
    if (points <= 0) return

    this.currentScore += points
    this.game.events.emit('scoreUpdated', this.currentScore)
  }
}
