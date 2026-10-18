import { REVEAL_ORDER } from './PhotoRules.js';
import { playGameSfx } from '../managers/GameSfx.js';

// These effects live above the board's masked layer so they can reach the photo.
export class PhotoRevealVFX {
    constructor(scene, tiles) {
        this.scene = scene;
        this.tiles = tiles;
        this.objects = new Set();
        this.origins = [];
        this.active = 0;
        this.target = 0;
        this.waiters = [];
        this.onCleared = points => {
            this.origins = points.slice(0, 24);
            this.originTime = scene.time.now;
        };
        scene.events.on('gemsCleared', this.onCleared);
    }

    reveal(progress) {
        const target = Math.floor(progress * this.tiles.length);
        if (target <= this.target) return;
        this.target = target;
        // Goal events precede gem removal in the board; collect their positions first.
        if (!this.timer) this.timer = this.scene.time.delayedCall(0, () => this.flush());
    }

    flush() {
        this.timer = null;
        const targets = REVEAL_ORDER.slice(0, this.target).map(i => this.tiles[i])
            .filter(tile => !tile.revealed && !tile.revealPending);
        const origins = this.scene.time.now - this.originTime < 400 && this.origins.length
            ? this.origins : [{ x: 288, y: 694 }];
        targets.forEach((tile, i) => {
            tile.revealPending = true;
            this.active++;
            this.fly(origins[i % origins.length], tile, i * Math.min(45, 280 / targets.length));
        });
        this.notifyIdle();
    }

    keep(object) { this.objects.add(object); return object.setDepth(45); }
    remove(object) {
        this.objects.delete(object);
        if (object.active) object.destroy();
    }

    fly(origin, tile, delay) {
        const scene = this.scene;
        const spark = this.keep(scene.add.star(origin.x, origin.y, 4, 3, 9, 0xfff4bb).setName('photo-reveal-spark'));
        const tails = [0, 1, 2].map(i => this.keep(scene.add.circle(origin.x, origin.y, 5 - i, 0xffc86b, .55 - i * .13)));
        spark.setVisible(false); tails.forEach(t => t.setVisible(false));
        const motion = { t: 0 };
        const cx = origin.x + (tile.x - origin.x) * .5 + (tile.x < 288 ? -65 : 65);
        const cy = Math.min(origin.y, tile.y) - 70;
        const position = t => ({
            x: (1 - t) ** 2 * origin.x + 2 * (1 - t) * t * cx + t * t * tile.x,
            y: (1 - t) ** 2 * origin.y + 2 * (1 - t) * t * cy + t * t * tile.y,
        });
        scene.tweens.add({
            targets: motion, t: 1, delay, duration: 560, ease: 'Sine.easeIn',
            onStart: () => { spark.setVisible(true); tails.forEach(t => t.setVisible(true)); },
            onUpdate: () => {
                const p = position(motion.t);
                spark.setPosition(p.x, p.y).setRotation(motion.t * 8);
                tails.forEach((tail, i) => {
                    const p = position(Math.max(0, motion.t - (i + 1) * .035));
                    tail.setPosition(p.x, p.y);
                });
            },
            onComplete: () => {
                this.remove(spark); tails.forEach(t => this.remove(t));
                this.shatter(tile);
            },
        });
    }

    shatter(tile) {
        const scene = this.scene;
        tile.revealed = true;
        tile.revealPending = false;
        tile.setAlpha(0);
        playGameSfx(scene, 'stone_break', { strength: .55, rate: 1.5 });
        const ring = this.keep(scene.add.circle(tile.x, tile.y, 9).setStrokeStyle(3, 0xffe5a3));
        scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 240, onComplete: () => this.remove(ring) });
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const shard = this.keep(scene.add.triangle(tile.x + (i % 3 - 1) * 10, tile.y + (i < 3 ? -7 : 7),
                0, 0, 15, 2, 5, 16, tile.fillColor).setStrokeStyle(1, 0xe8bd70).setName('photo-reveal-shard'));
            scene.tweens.add({ targets: shard, x: shard.x + Math.cos(angle) * 36, y: shard.y + Math.sin(angle) * 30 + 12,
                angle: i % 2 ? 100 : -100, alpha: 0, scale: .3, duration: 290,
                onComplete: () => this.remove(shard) });
        }
        scene.time.delayedCall(300, () => { this.active--; this.notifyIdle(); });
    }

    whenIdle(callback) {
        this.waiters.push(callback);
        this.notifyIdle();
    }

    notifyIdle() {
        if (this.timer || this.active) return;
        this.waiters.splice(0).forEach(callback => callback());
    }

    destroy() {
        this.scene.events.off('gemsCleared', this.onCleared);
        this.timer?.remove();
        this.waiters = [];
        for (const object of this.objects) this.remove(object);
        this.origins = [];
    }
}
