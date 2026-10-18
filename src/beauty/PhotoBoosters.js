import { playGameSfx } from '../managers/GameSfx.js';
import PlayerDataManager from '../managers/PlayerDataManager';
import LanguageManager from '../i18n/LanguageManager';
import { BOOSTER_TYPES } from '../utils/constants';
import { BoosterVFXManager } from '../objects/vfx/BoosterVFXManager';

const TYPES = Object.values(BOOSTER_TYPES);

export function queuePhotoBoosters(scene) {
    for (const type of TYPES) {
        const key = `booster_${type}`;
        if (!scene.textures.exists(key)) scene.load.image(key, `assets/images/ui/booster_${type}_15.png`);
    }
    for (let i = 1; i <= 7; i++) {
        const key = `bubble_particle_${i}`;
        if (!scene.textures.exists(key)) scene.load.image(key, `assets/images/vfx/booster_shuffle_effect_${i}.png`);
    }
}

export class PhotoBoosters {
    constructor(scene) {
        this.scene = scene;
        this.inventory = PlayerDataManager;
        this.selected = null;
        this.first = null;
        this.buttons = [];
        this.vfx = new BoosterVFXManager(scene, scene.board);
        TYPES.forEach((type, index) => {
            const x = 78 + index * 102;
            const button = scene.add.rectangle(x, 990, 84, 56, 0x28394d)
                .setStrokeStyle(2, 0xe8bd70).setInteractive({ useHandCursor: true })
                .setName(`baddie-booster-${type}`);
            const icon = scene.add.image(x - 7, 990, `booster_${type}`);
            icon.setScale(Math.min(40 / icon.width, 40 / icon.height));
            const count = scene.add.text(x + 23, 971, '', { fontSize: '17px', color: '#fff5df' })
                .setOrigin(0.5).setName(`baddie-booster-${type}-count`);
            button.on('pointerdown', () => this.select(type));
            this.buttons.push({ type, button, icon, count });
        });
        this.onInventory = () => this.refresh();
        scene.game.events.on('boosterCountUpdated', this.onInventory);
        this.refresh();
    }

    select(type) {
        if (!this.scene.canPlayerAct() || !TYPES.includes(type) || this.inventory.getBoosterCount(type) <= 0) return false;
        const repeat = type === this.selected;
        playGameSfx(this.scene, 'ui');
        this.clear();
        if (!repeat) {
            this.selected = type;
            this.scene.activeBooster = type;
            this.scene.cancelBoardGesture();
            this.scene.board.clearSelection();
        }
        this.refresh();
        return true;
    }

    clear() {
        this.selected = null;
        this.first = null;
        this.scene.activeBooster = null;
        this.vfx.clearPreview();
        this.refresh();
    }

    target(row, col) {
        const scene = this.scene, board = scene.board, type = this.selected;
        if (!type || !scene.canPlayerAct() || !board.isValidCell(row, col) || !board.grid[row]?.[col]) return false;
        const gem = board.grid[row][col];
        if (type === BOOSTER_TYPES.SWAP) {
            if (board.isCellBlockedForMovement(row, col)) return false;
            if (!this.first) {
                this.first = gem;
                this.vfx.showSwapPreview(row, col);
                this.refresh();
                return true;
            }
            if (this.first === gem) { this.clear(); return false; }
        }
        if (!scene.run.beginBooster()) return false;
        if (!this.inventory.updateBooster(type, -1)) {
            scene.run.pending = null;
            this.clear();
            return false;
        }
        const first = this.first;
        this.clear();
        scene.game.events.emit('boosterCountUpdated', { type, count: this.inventory.getBoosterCount(type) });
        scene.game.events.emit('boardBusy', true);
        if (type === BOOSTER_TYPES.HAMMER) {
            this.vfx.playHammerEffect(row, col, () => board.useHammer(row, col));
        } else if (type === BOOSTER_TYPES.ROCKET) {
            this.vfx.playRocketEffect(col, () => board.useRocket(row, col));
        } else if (type === BOOSTER_TYPES.SWAP) {
            board.useSwap(first, gem);
        } else {
            const gems = board.grid.flat().filter(Boolean).map(gem => gem.sprite);
            const blockers = board.blockerGrid.flat().filter(Boolean);
            board.useShuffle();
            this.vfx.playFakeShuffleEffect(gems, blockers, () => {
                [...gems, ...blockers].forEach(sprite => { if (sprite.active) sprite.setVisible(true); });
                board.checkForNewMatches();
            });
        }
        return true;
    }

    refresh() {
        const usable = this.scene.canPlayerAct();
        for (const { type, button, icon, count } of this.buttons) {
            const amount = this.inventory.getBoosterCount(type);
            const enabled = usable && amount > 0;
            button.input.enabled = enabled;
            button.setStrokeStyle(2, type === this.selected ? 0xffff66 : 0xe8bd70);
            button.setAlpha(enabled ? 1 : 0.4);
            icon.setAlpha(enabled ? 1 : 0.4);
            count.setText(String(amount)).setAlpha(enabled ? 1 : 0.4);
        }
        const key = this.first ? 'beautyBoosterSecond' : this.selected ? 'beautyBoosterTarget' : 'beautyClassicRules';
        if (this.scene.boosterHelp) this.scene.boosterHelp.setText(LanguageManager.t(key));
    }

    destroy() {
        this.scene.game.events.off('boosterCountUpdated', this.onInventory);
        // Phaser may already have destroyed the HUD when shutdown is emitted.
        // Clear state without refreshing controls that no longer have input/text.
        this.selected = null;
        this.first = null;
        this.scene.activeBooster = null;
        if (!this.vfx.swapSelectedSprite?.active) this.vfx.swapSelectedSprite = null;
        this.vfx.clearPreview();
        this.buttons = [];
    }
}
