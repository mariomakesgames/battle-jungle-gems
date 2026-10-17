// src/objects/board/BoardCreator.js
import Phaser from 'phaser'
import { GEM_TYPES, BLOCKER_TYPES } from '../../utils/constants'
import { StoneBlocker } from '../blockers/StoneBlocker'
import { RopeBlocker } from '../blockers/RopeBlocker'

export class BoardCreator {
  createSelectionFrame() {
    const frame = this.scene.add.graphics()
    frame.lineStyle(4, 0xFFD700, 1)
    frame.strokeRect(0, 0, this.cellSize, this.cellSize)
    frame.setDepth(5)
    frame.setVisible(false)
    return frame
  }

  // XÓA HÀM createAllCells() VÀ THAY THẾ BẰNG HÀM MỚI NÀY
  createCellAt(row, col) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = this.offsetY + row * this.cellSize + this.cellSize / 2
    const cell = this.scene.add.image(x, y, 'cell')
      .setDisplaySize(this.cellSize * 0.95, this.cellSize * 0.95)
      .setDepth(1) // Depth 1: Nền cell nằm dưới gem (depth 2)
    cell.setData('row', row)
    cell.setData('col', col)
    cell.setData('isCell', true)
    return cell
  }

  getGemTypeByNumber(number) {
    const gemTypes = Object.values(GEM_TYPES)
    return gemTypes[(number - 1) % gemTypes.length]
  }

  getBlockerTypeByNumber(number) {
    const blockerTypes = Object.values(BLOCKER_TYPES)
    return blockerTypes[(number - 7) % blockerTypes.length]
  }

  createGem(row, col, gemType) {
    const gemSprite = this.createGemAt(row, col, gemType)
    const gemObject = { type: 'gem', value: gemType, sprite: gemSprite }
    this.grid[row][col] = gemObject

    // Nếu là power-up, kích hoạt hiệu ứng Idle ngay khi được tạo
    if (this.isPowerup && this.isPowerup(gemObject) && this.startPowerupIdle) {
      this.startPowerupIdle(gemObject)
    }

    return gemObject
  }

  createGemAt(row, col, gemType, startY) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = startY !== undefined ? startY : this.offsetY + row * this.cellSize + this.cellSize / 2
    console.log(`Creating gem ${gemType} at row:${row}, col:${col}, x:${x}, y:${y}`)
    const gemTextureKey = `gem_${gemType}`
    
    // === SỬA DÒNG NÀY ===
    // const gem = this.scene.add.image(x, y, gemTextureKey)
    // THÀNH
    const gem = this.gemLayer.add(
      this.scene.make.image({ x, y, key: gemTextureKey, add: false })
    )
    // ======================
    
    gem.setDisplaySize(this.cellSize * 0.85, this.cellSize * 0.85)
      .setInteractive()
      .setDepth(2) // Depth này giờ là depth bên trong Layer
    gem.setData({ row, col, type: gemType, isGem: true })
    gem.on('pointerdown', () => {
      const currentRow = gem.getData('row')
      const currentCol = gem.getData('col')
      this.handleGemClick(currentRow, currentCol)
    })
    this.gems.push(gem) // Vẫn giữ để quản lý riêng
    return gem
  }

  createBlocker(row, col, blockerType) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = this.offsetY + row * this.cellSize + this.cellSize / 2
    const blocker = this.scene.add.rectangle(x, y, this.cellSize * 0.8, this.cellSize * 0.8, this.getBlockerColor(blockerType))
      .setInteractive()
      .setStrokeStyle(2, 0x8B4513)
      .setDepth(2)
    blocker.setData('row', row)
    blocker.setData('col', col)
    blocker.setData('type', blockerType)
    blocker.setData('isBlocker', true)
    blocker.on('pointerdown', () => {
      this.handleBlockerClick(row, col, blockerType)
    })
    this.grid[row][col] = { type: 'blocker', value: blockerType, sprite: blocker }
    this.blockers.push(blocker)
    return blocker
  }

  getBlockerColor(blockerType) {
    const colors = {
      [BLOCKER_TYPES.STONE]: 0x696969,
      [BLOCKER_TYPES.VINE]: 0x228B22
    }
    return colors[blockerType] || 0x8B4513
  }

  // === Blocker OOP versions ===
  createStoneBlocker(row, col, health = 2) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = this.offsetY + row * this.cellSize + this.cellSize / 2
    const blocker = new StoneBlocker(this.scene, x, y, row, col, health)
    blocker.setDisplaySize(this.cellSize * 0.9, this.cellSize * 0.9)

    // Đưa blocker vào gemLayer và đặt depth cao hơn Gem (Gem depth = 2)
    this.gemLayer.add(blocker)
    blocker.setDepth(10)

    this.blockerGrid[row][col] = blocker
    return blocker
  }

  createRopeBlocker(row, col) {
    const x = this.offsetX + col * this.cellSize + this.cellSize / 2
    const y = this.offsetY + row * this.cellSize + this.cellSize / 2
    const blocker = new RopeBlocker(this.scene, x, y, row, col)
    blocker.setDisplaySize(this.cellSize * 0.9, this.cellSize * 0.9)

    // Đưa blocker vào gemLayer và đặt depth cao hơn Gem (Gem depth = 2)
    this.gemLayer.add(blocker)
    blocker.setDepth(10)

    this.blockerGrid[row][col] = blocker
    return blocker
  }

  // === HÀM MỚI ĐỂ RANDOM THÔNG MINH ===
  getRandomGemTypeWithoutMatch(row, col) {
    const availableGems = this.levelData?.availableGems || Object.values(GEM_TYPES)
    let possibleGemTypes = [...availableGems]

    // 1) Kiểm tra 2 ô bên trái
    if (
      col >= 2 &&
      this.grid[row][col - 1] &&
      this.grid[row][col - 2] &&
      this.grid[row][col - 1].value === this.grid[row][col - 2].value
    ) {
      const forbiddenType = this.grid[row][col - 1].value
      possibleGemTypes = possibleGemTypes.filter(type => type !== forbiddenType)
    }

    // 2) Kiểm tra 2 ô bên trên
    if (
      row >= 2 &&
      this.grid[row - 1][col] &&
      this.grid[row - 2][col] &&
      this.grid[row - 1][col].value === this.grid[row - 2][col].value
    ) {
      const forbiddenType = this.grid[row - 1][col].value
      possibleGemTypes = possibleGemTypes.filter(type => type !== forbiddenType)
    }

    if (possibleGemTypes.length === 0) {
      possibleGemTypes = availableGems
    }

    return Phaser.Math.RND.pick(possibleGemTypes)
  }
}


