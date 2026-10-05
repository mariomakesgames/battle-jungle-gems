import { BaseBlocker } from './BaseBlocker'
import Phaser from 'phaser'

export class RopeBlocker extends BaseBlocker {
  constructor(scene, x, y, row, col) {
    super(scene, x, y, 'blocker_rope', 'rope', row, col)
    this.health = 1
  }

  // Rope bị phá khi match chính viên gem ở vị trí này (damage trực tiếp)
  // Không override takeDamage khác hành vi mặc định

  spread(board, plannedSpawns) {
    const candidates = []
    // chỉ lan ngang/dọc, ưu tiên ô chưa có rope
    const pushIfFree = (r, c) => {
      if (r >= 0 && r < board.grid.length && c >= 0 && c < board.grid[0].length) {
        // tránh lan sang ô lỗ (null) trong layout cấp độ
        if (board.levelData?.gridLayout?.[r]?.[c] === null) {
          return
        }
        const hasBlocker = board.blockerGrid[r][c]
        if (!hasBlocker) candidates.push({ row: r, col: c })
      }
    }
    pushIfFree(this.row - 1, this.col)
    pushIfFree(this.row + 1, this.col)
    pushIfFree(this.row, this.col - 1)
    pushIfFree(this.row, this.col + 1)
    if (candidates.length === 0) return
    // ưu tiên vị trí chưa được plan spawn trong lượt
    const keyOf = (r, c) => `${r},${c}`
    const nonPlanned = candidates.filter(p => !plannedSpawns?.has(keyOf(p.row, p.col)))
    const pool = nonPlanned.length > 0 ? nonPlanned : candidates
    const target = Phaser.Math.RND.pick(pool)
    board.createRopeBlocker(target.row, target.col)
    
    // Thông báo cho board biết là có thêm rope mới sinh ra
    if (board.handleBlockerSpawned) {
      board.handleBlockerSpawned('rope')
    }
    
    if (plannedSpawns) plannedSpawns.add(keyOf(target.row, target.col))
  }
}

