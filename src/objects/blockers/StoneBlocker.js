import { playGameSfx } from '../../managers/GameSfx.js'
import { BaseBlocker } from './BaseBlocker'

export class StoneBlocker extends BaseBlocker {
  constructor(scene, x, y, row, col, health = 2) {
    const textureKey = scene.blockerTexture?.(`stone_${health}`) || `blocker_stone_${health}`
    super(scene, x, y, textureKey, 'stone', row, col)
    this.health = health
  }

  takeDamage() {
    this.health--
    playGameSfx(this.scene, this.health <= 0 ? 'stone_break' : 'stone_hit')
    if (this.health <= 0) {
      this.destroy()
      return true
    } else {
      this.setTexture(this.scene.blockerTexture?.(`stone_${this.health}`) || `blocker_stone_${this.health}`)
      return false
    }
  }
}


