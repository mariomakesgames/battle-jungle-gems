// src/objects/board/BoardMatcher.js
import { GEM_TYPES } from '../../utils/constants'

export class BoardMatcher {
  
  // 1. Kiểm tra xem ô này có thể tham gia vào Combo nổ hay không
  // (Dùng cho logic findAllMatches - Rope và Stone vỡ vẫn có thể nổ)
  canMatchAt(row, col) {
    const blocker = this.blockerGrid?.[row]?.[col]
    if (!blocker) return true 

    // Đá nguyên khối (2 máu) không thể match
    if (blocker.type === 'stone' && blocker.health === 2) {
      return false
    }

    // Đá vỡ (1 máu) và dây leo (rope) vẫn có thể match tại chỗ (đứng yên nhưng nổ)
    return true
  }

  // 2. [MỚI] Kiểm tra xem ô này có thể DI CHUYỂN (Swap) hay không
  // (Dùng cho logic Hint và Input - Rope và Stone KHÔNG được di chuyển)
  canMoveAt(row, col) {
    const blocker = this.blockerGrid?.[row]?.[col]
    if (!blocker) return true

    // Dây leo giữ chặt gem -> Không thể di chuyển
    if (blocker.type === 'rope') {
      return false
    }

    // Đá (dù là 1 hay 2 máu) đều đè lên gem -> Không thể di chuyển
    if (blocker.type === 'stone') {
      return false
    }

    return true
  }

  findAllMatches() {
    return this._findAllMatchesLogic()
  }

  _findAllMatchesLogic() {
    let horizontalMatches = []
    let verticalMatches = []

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize - 2; ) {
        const gem = this.grid[row][col]
        const isPowerUp = gem && (gem.value === GEM_TYPES.BOMB || gem.value === GEM_TYPES.COLOR_BOMB)
        
        // Logic Match: Vẫn dùng canMatchAt (vì gem trong Rope vẫn ăn được nếu xếp đúng)
        if (gem && gem.type === 'gem' && !isPowerUp && this.canMatchAt(row, col)) {
          let match = [gem]
          for (let i = col + 1; i < this.gridSize; i++) {
            const nextGem = this.grid[row][i]
            if (nextGem && nextGem.type === 'gem' && nextGem.value === gem.value && this.canMatchAt(row, i)) {
              match.push(nextGem)
            } else {
              break
            }
          }
          if (match.length >= 3) horizontalMatches.push(match)
          col += match.length
        } else {
          col++
        }
      }
    }

    for (let col = 0; col < this.gridSize; col++) {
      for (let row = 0; row < this.gridSize - 2; ) {
        const gem = this.grid[row][col]
        const isPowerUp = gem && (gem.value === GEM_TYPES.BOMB || gem.value === GEM_TYPES.COLOR_BOMB)
        
        // Logic Match: Vẫn dùng canMatchAt
        if (gem && gem.type === 'gem' && !isPowerUp && this.canMatchAt(row, col)) {
          let match = [gem]
          for (let i = row + 1; i < this.gridSize; i++) {
            const nextGem = this.grid[i][col]
            if (nextGem && nextGem.type === 'gem' && nextGem.value === gem.value && this.canMatchAt(i, col)) {
              match.push(nextGem)
            } else {
              break
            }
          }
          if (match.length >= 3) verticalMatches.push(match)
          row += match.length
        } else {
          row++
        }
      }
    }

    const allMatches = horizontalMatches.concat(verticalMatches)
    const mergedMatches = []
    while (allMatches.length > 0) {
      let currentGroup = new Set(allMatches.shift())
      let merged = true
      while (merged) {
        merged = false
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const otherMatch = allMatches[i]
          const hasIntersection = otherMatch.some(gem => currentGroup.has(gem))
          if (hasIntersection) {
            otherMatch.forEach(gem => currentGroup.add(gem))
            allMatches.splice(i, 1)
            merged = true
          }
        }
      }
      mergedMatches.push(Array.from(currentGroup))
    }
    console.log(`Found ${mergedMatches.length} match groups:`, mergedMatches.map(match => match.length))
    return mergedMatches
  }

  /**
   * [AUTO SHUFFLE] Kiểm tra xem còn nước đi nào hợp lệ không.
   */
  hasPossibleMoves() {
    if (!this.grid || !this.grid.length) return false

    const tempGrid = this.grid.map(row => row.map(cell => (cell ? { ...cell } : null)))

    const isValidSwap = (r1, c1, r2, c2) => {
      if (!this.isValidCell || !this.isValidCell(r1, c1) || !this.isValidCell(r2, c2)) return false

      const gem1 = tempGrid[r1][c1]
      const gem2 = tempGrid[r2][c2]

      // [SỬA LỖI] Thay canMatchAt bằng canMoveAt
      // Gem bị khóa (Rope/Stone) không thể đem đi swap
      if (!gem1 || gem1.type !== 'gem' || !this.canMoveAt(r1, c1)) return false
      if (!gem2 || gem2.type !== 'gem' || !this.canMoveAt(r2, c2)) return false

      tempGrid[r1][c1] = gem2
      tempGrid[r2][c2] = gem1

      // Kiểm tra xem sau khi swap xong, nó có tạo ra match không?
      // Ở bước check match này thì dùng _checkMatchAt (logic này dùng canMatchAt nội bộ là đúng)
      const hasMatch = this._checkMatchAt(tempGrid, r1, c1) || this._checkMatchAt(tempGrid, r2, c2)

      tempGrid[r1][c1] = gem1
      tempGrid[r2][c2] = gem2

      return hasMatch
    }

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (isValidSwap(r, c, r, c + 1)) return true
        if (isValidSwap(r, c, r + 1, c)) return true

        const gem = this.grid[r][c]
        // Powerup luôn là một nước đi khả thi (nếu click được)
        if (this.isPowerup && this.isPowerup(gem) && this.canMoveAt(r, c)) return true
      }
    }

    return false
  }

  /**
   * Helper kiểm tra match tại 1 ô cụ thể trong lưới ảo
   * Hàm này dùng để kiểm tra KẾT QUẢ sau khi swap, nên nó vẫn tuân theo quy tắc Match
   */
  _checkMatchAt(tempGrid, row, col) {
    if (!this.isValidCell || !this.isValidCell(row, col)) return false

    const gem = tempGrid[row]?.[col]
    if (!gem || gem.type !== 'gem') return false

    // Ở đây ta giả định tempGrid đã swap xong. 
    // Việc kiểm tra "gem có bị Rope không" đã được chặn ở đầu vào (isValidSwap).
    // Nếu gem đã nằm đúng vị trí, nó vẫn có thể match kể cả khi bị Rope (nếu ta cho phép Rope match tại chỗ).
    // Tuy nhiên, logic Match-3 chuẩn thường là: 
    // - Rope: Không move được, nhưng nếu có 2 viên cùng màu bên cạnh move tới thì Rope vẫn nổ.
    // -> Nên _checkMatchAt không cần chặn Rope, chỉ cần isValidSwap chặn Rope là đủ.

    const type = gem.value

    let countH = 1
    let left = col - 1
    while (left >= 0 && tempGrid[row]?.[left] && tempGrid[row][left].type === 'gem' && tempGrid[row][left].value === type) {
      countH++
      left--
    }

    let right = col + 1
    while (right < this.gridSize && tempGrid[row]?.[right] && tempGrid[row][right].type === 'gem' && tempGrid[row][right].value === type) {
      countH++
      right++
    }
    if (countH >= 3) return true

    let countV = 1
    let up = row - 1
    while (up >= 0 && tempGrid[up]?.[col] && tempGrid[up][col].type === 'gem' && tempGrid[up][col].value === type) {
      countV++
      up--
    }

    let down = row + 1
    while (down < this.gridSize && tempGrid[down]?.[col] && tempGrid[down][col].type === 'gem' && tempGrid[down][col].value === type) {
      countV++
      down++
    }
    return countV >= 3
  }

  /**
   * [HỆ THỐNG GỢI Ý] Tìm tọa độ cụ thể của một nước đi khả thi (Dùng cho Hint)
   */
  findPotentialMove() {
    if (!this.grid || !this.grid.length) return null

    // Clone grid ảo để test swap
    const tempGrid = this.grid.map(row => row.map(cell => (cell ? { ...cell } : null)))

    const isValidSwap = (r1, c1, r2, c2) => {
      if (!this.isValidCell || !this.isValidCell(r1, c1) || !this.isValidCell(r2, c2)) return false

      const gem1 = tempGrid[r1][c1]
      const gem2 = tempGrid[r2][c2]

      // [SỬA LỖI] Thay canMatchAt bằng canMoveAt
      // Gem bị Rope/Stone đè thì không thể swap để tạo hint được
      if (!gem1 || gem1.type !== 'gem' || !this.canMoveAt(r1, c1)) return false
      if (!gem2 || gem2.type !== 'gem' || !this.canMoveAt(r2, c2)) return false

      // Swap thử trên grid ảo
      tempGrid[r1][c1] = gem2
      tempGrid[r2][c2] = gem1

      // Check match
      const hasMatch = this._checkMatchAt(tempGrid, r1, c1) || this._checkMatchAt(tempGrid, r2, c2)

      // Trả lại vị trí cũ
      tempGrid[r1][c1] = gem1
      tempGrid[r2][c2] = gem2

      return hasMatch
    }

    // Duyệt qua lưới để tìm nước đi đầu tiên thấy
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        // Kiểm tra swap ngang
        if (isValidSwap(r, c, r, c + 1)) return { r1: r, c1: c, r2: r, c2: c + 1 }
        // Kiểm tra swap dọc
        if (isValidSwap(r, c, r + 1, c)) return { r1: r, c1: c, r2: r + 1, c2: c }
        
        // Hint cho Powerup (nếu có powerup và click được vào nó thì hint)
        const gem = this.grid[r][c]
        if (this.isPowerup && this.isPowerup(gem) && this.canMoveAt(r, c)) return { r1: r, c1: c, r2: r, c2: c }
      }
    }

    return null
  }
}
