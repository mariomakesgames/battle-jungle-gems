// src/objects/Board.js
import { applyMixins } from '../utils/helpers'
import { BoardCreator } from './board/BoardCreator'
import { BoardInput } from './board/BoardInput'
import { BoardMatcher } from './board/BoardMatcher'
import { BoardPowerups } from './board/BoardPowerups'
import { BoardState } from './board/BoardState'

export class Board {
  constructor(scene, offsetX, offsetY, cellSize, powerupVFXManager, gemLayer, gridSize = 9) {
    this.scene = scene
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.cellSize = cellSize
    this.gridSize = gridSize
    this.powerupVFXManager = powerupVFXManager // Lưu lại tham chiếu
    this.gemLayer = gemLayer // << LƯU LẠI THAM CHIẾU ĐẾN LAYER

    // Khởi tạo state
    this.grid = []
    this.blockerGrid = []
    this.gems = []
    this.blockers = []
    this.levelData = null
    this.selectedGem = null
    this.ropeDestroyedThisTurn = false
    this.boardBusy = false
    
    // << [HINT SYSTEM] Lưu reference đến các tween hint để có thể dừng chúng >>
    this.hintTweens = []

    // Lắp ráp trạng thái ban đầu
    this.initGrid()
    this.selectionFrame = this.createSelectionFrame()
  }

  // --- [IDLE POWERUP] Đã xóa Glow/BlendMode để fix lỗi màu trên mobile ---
  startPowerupIdle(gem) {
    if (!gem || !gem.sprite) return

    // Tránh tạo trùng lặp
    if (gem.idleTween) return

    // Random delay để các powerup không nhảy đều tăm tắp
    const delay = Math.random() * 1000

    // Lấy scale gốc hiện tại
    const baseScale = gem.sprite.scaleX

    // Chỉ giữ lại hiệu ứng nhún nhảy vật lý
    gem.idleTween = this.scene.tweens.add({
      targets: gem.sprite,
      scale: baseScale * 1.05, // Phóng to nhẹ
      displayOriginY: '+=10',   // Nhún nhẹ
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay,
      onUpdate: (tween) => {
        // Tự hủy nếu gem không còn active
        if (!gem.sprite || !gem.sprite.active) {
          tween.stop()
          gem.idleTween = null
        }
      }
    })

    // ĐÃ XÓA: Phần xử lý preFX.addGlow và BlendMode.ADD
    // Việc này sẽ đảm bảo màu sắc hiển thị đúng như file ảnh gốc trên mọi thiết bị.
  }
  // Lấy tọa độ trung tâm của một cell
  getCellPosition(row, col) {
    return {
      x: this.offsetX + col * this.cellSize + this.cellSize / 2,
      y: this.offsetY + row * this.cellSize + this.cellSize / 2
    }
  }

  // Kích thước board (width, height)
  getBoardDimensions() {
    const gridSize = this.gridSize
    return { width: gridSize * this.cellSize, height: gridSize * this.cellSize }
  }

  // Kiểm tra cell hợp lệ
  isValidCell(row, col) {
    const gridSize = this.gridSize
    return row >= 0 && row < gridSize && col >= 0 && col < gridSize
  }

  loadLevel(levelData) {
    this.levelData = levelData
    if (!levelData.gridLayout) {
      console.error('Level data missing gridLayout!')
      return
    }

    this.gridSize = levelData.gridSize || 9
    this.clearBoard()
    // XÓA: this.createAllCells() 

    // Load gem layout
    for (let row = 0; row < levelData.gridLayout.length; row++) {
      for (let col = 0; col < levelData.gridLayout[row].length; col++) {
        const cellValue = levelData.gridLayout[row][col]
        
        // SỬA: CHỈ TẠO CELL NỀN NẾU KHÔNG PHẢI LÀ LỖ HỔNG (null)
        if (cellValue !== null) {
            this.createCellAt(row, col) // <== GỌI HÀM TẠO CELL NỀN CÓ ĐIỀU KIỆN
        }

        if (cellValue === null) {
          this.grid[row][col] = null
        } else if (cellValue === 0) {
          // Random thông minh để tránh tạo match sẵn khi khởi tạo
          const randomGemType = this.getRandomGemTypeWithoutMatch(row, col)
          this.createGem(row, col, randomGemType)
        } else if (cellValue >= 1) {
          this.createGem(row, col, this.getGemTypeByNumber(cellValue))
        }
      }
    }

    // Load blocker layout (nếu có)
    if (levelData.blockerLayout) {
      for (let row = 0; row < levelData.blockerLayout.length; row++) {
        for (let col = 0; col < levelData.blockerLayout[row].length; col++) {
          const blockerValue = levelData.blockerLayout[row][col]
          if (blockerValue === 1) {
            this.createRopeBlocker(row, col)
          } else if (blockerValue === 2 || blockerValue === 3) {
            // Authored layouts may specify one-hit obstacles; campaign defaults to two.
            this.createStoneBlocker(row, col, levelData.stoneHealthLayout?.[row]?.[col] || 2)
          }
        }
      }
    }

    // Tự động đếm lại số lượng blocker thực tế trên bàn cờ (Rope & Stone)
    // và cập nhật vào mục tiêu (objective) để đảm bảo "Clear All" hoạt động đúng
    if (this.levelData.objectives) {
      // 1. Đồng bộ ROPE
      const ropeObjective = this.levelData.objectives.find(o => o.type === 'rope')
      if (ropeObjective) {
        let actualRopeCount = 0
        for (let r = 0; r < this.blockerGrid.length; r++) {
          for (let c = 0; c < this.blockerGrid[r].length; c++) {
            const blocker = this.blockerGrid[r][c]
            if (blocker && blocker.type === 'rope') {
              actualRopeCount++
            }
          }
        }
        console.log(`[Board] Auto-sync Rope Objective: Config=${ropeObjective.count}, Actual=${actualRopeCount}`)
        ropeObjective.count = actualRopeCount
      }

      // 2. Đồng bộ STONE
      // Stone có thể có 2 máu, nhưng mục tiêu đếm theo SỐ VIÊN ĐÁ chứ không phải số lần đánh
      const stoneObjective = this.levelData.objectives.find(o => o.type === 'stone')
      if (stoneObjective) {
        let actualStoneCount = 0
        for (let r = 0; r < this.blockerGrid.length; r++) {
          for (let c = 0; c < this.blockerGrid[r].length; c++) {
            const blocker = this.blockerGrid[r][c]
            if (blocker && blocker.type === 'stone') {
              actualStoneCount++
            }
          }
        }
        console.log(`[Board] Auto-sync Stone Objective: Config=${stoneObjective.count}, Actual=${actualStoneCount}`)
        stoneObjective.count = actualStoneCount
      }
    }

    this.fillEmptyCells()
    
    // DEBUG: Hiển thị mask overlay để quan sát
    // this.showDebugMaskOverlay() // << TẮT DEBUG - Đã hoạt động đúng!
  }

  // Entry point nhận input từ Scene
  handleInput(inputData) {
    console.log('Board received input:', inputData)
    switch (inputData.type) {
      case 'gem_click':
        this.handleGemClick(inputData.row, inputData.col)
        break
      case 'blocker_click':
        this.handleBlockerClick(inputData.row, inputData.col, inputData.blockerType)
        break
      default:
        console.warn('Unknown input type:', inputData.type)
    }
  }

  // Xử lý khi blocker (rope) sinh sôi - cập nhật mục tiêu
  handleBlockerSpawned(type) {
    if (!this.objectivesStatus) return

    const key = `blocker_${type}` // Ví dụ: blocker_rope
    
    if (this.objectivesStatus[key]) {
      // Tăng số lượng remaining lên 1 (vì người chơi phải phá nhiều hơn)
      this.objectivesStatus[key].current += 1
      
      const remaining = this.objectivesStatus[key].current
      console.log(`[Board] Blocker spawned (${type}). New remaining: ${remaining}`)

      // Bắn sự kiện để UIScene cập nhật lại số hiển thị
      this.scene.game.events.emit('objectiveUpdated', { 
        key: key, 
        remaining: remaining 
      })
    }
  }

  /**
   * [HỆ THỐNG GỢI Ý] Hiển thị gợi ý nước đi cho người chơi
   * Tìm một nước đi khả thi và làm các gem đó rung lắc/phóng to liên tục
   * Hint sẽ duy trì cho đến khi người chơi thao tác (clearHint được gọi)
   */
  showHint() {
    // Không hiện hint nếu board đang bận chạy effect
    if (this.boardBusy) return

    // Xóa hint cũ trước khi hiện hint mới
    this.clearHint()

    const move = this.findPotentialMove() // Hàm vừa viết ở BoardMatcher
    if (!move) {
      console.log('💡 Không tìm thấy nước đi nào để gợi ý')
      return
    }

    console.log('💡 Hint found:', move)
    
    const gem1 = this.grid[move.r1]?.[move.c1]
    const gem2 = this.grid[move.r2]?.[move.c2]

    // Hiệu ứng rung lắc hoặc phóng to nhẹ để gây chú ý - LẶP VÔ HẠN
    if (gem1 && gem1.sprite && gem1.sprite.active) {
      // Lưu lại scale ban đầu
      const originalScale = gem1.sprite.scale
      const targetScale = originalScale * 1.1 // Phóng to 10% so với scale hiện tại
      
      const tween1 = this.scene.tweens.add({
        targets: gem1.sprite,
        scale: targetScale, // Phóng to dựa trên scale hiện tại
        angle: { from: -5, to: 5 }, // Lắc nhẹ
        yoyo: true,
        repeat: -1, // << LẶP VÔ HẠN cho đến khi dừng thủ công
        duration: 200
      })
      
      // Lưu reference để có thể dừng sau
      this.hintTweens.push({ tween: tween1, sprite: gem1.sprite, originalScale })
    }
    
    // Nếu là swap 2 ô thì hint cả ô thứ 2
    if (gem2 && gem2.sprite && gem2.sprite.active && (move.r1 !== move.r2 || move.c1 !== move.c2)) {
      // Lưu lại scale ban đầu
      const originalScale2 = gem2.sprite.scale
      const targetScale2 = originalScale2 * 1.15 // Phóng to 15% so với scale hiện tại
      
      const tween2 = this.scene.tweens.add({
        targets: gem2.sprite,
        scale: targetScale2,
        angle: { from: -5, to: 5 },
        yoyo: true,
        repeat: -1, // << LẶP VÔ HẠN cho đến khi dừng thủ công
        duration: 200
      })
      
      // Lưu reference để có thể dừng sau
      this.hintTweens.push({ tween: tween2, sprite: gem2.sprite, originalScale: originalScale2 })
    }
  }

  /**
   * [HỆ THỐNG GỢI Ý] Dừng và xóa tất cả các hint đang hiển thị
   * Gọi hàm này khi người chơi thao tác (click, swipe, booster...)
   */
  clearHint() {
    if (this.hintTweens.length === 0) return

    this.hintTweens.forEach(({ tween, sprite, originalScale }) => {
      if (tween && tween.isPlaying()) {
        tween.stop()
      }
      
      // Reset sprite về trạng thái ban đầu
      if (sprite && sprite.active) {
        sprite.setScale(originalScale).setAngle(0)
      }
    })

    // Xóa danh sách
    this.hintTweens = []
  }
}

// Trộn các module vào Board
applyMixins(Board, [BoardCreator, BoardInput, BoardMatcher, BoardPowerups, BoardState])
