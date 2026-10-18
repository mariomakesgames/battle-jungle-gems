const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ready = () => window.game.scene.isActive('PhotoChallengeScene') && window.game.scene.getScene('PhotoChallengeScene').canPlayerAct();

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto(process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/');
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(19));
        await page.waitForFunction(ready);
        async function fixture(count) {
            await page.evaluate(count => {
                const s = window.game.scene.getScene('PhotoChallengeScene'), size = 10;
                const grid = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => (r * 2 + c) % 4 + 1));
                grid[0][1] = 1;
                const config = { gridSize: size, gridLayout: grid, blockerLayout: grid.map(row => row.map(() => 0)),
                    availableGems: ['red', 'green', 'blue', 'purple'], objectives: [{ target: 'gem', type: 'red', count }] };
                s.board.loadLevel(config); s.board.initializeObjectives(config); s.board.isMoveBasedLevel = false;
                s.run = new s.run.constructor({ moves: 5, objectives: config.objectives });
                window.impacts = [];
                const effect = s.revealVFX, original = effect.shatter;
                effect.shatter = function(tile) { window.impacts.push({ alpha: tile.alpha, pending: tile.revealPending }); return original.call(this, tile); };
                s.refresh();
            }, count);
        }
        async function match() {
            const points = await page.evaluate(() => {
                const s = window.game.scene.getScene('PhotoChallengeScene'), r = window.game.canvas.getBoundingClientRect();
                return [[0, 2], [1, 2]].map(([row, col]) => { const p = s.board.getCellPosition(row, col); return { x: r.left + p.x * r.width / 576, y: r.top + p.y * r.height / 1024 }; });
            });
            await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
            await page.mouse.move(points[1].x, points[1].y, { steps: 5 }); await page.mouse.up();
        }
        await fixture(30); await match();
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').children.getChildren().some(o => o.name === 'photo-reveal-spark' && o.visible));
        const launch = await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            return { origins: s.revealVFX.origins, covered: s.coverTiles.every(t => t.alpha === 1), parent: s.children.getByName('photo-reveal-spark').parentContainer };
        });
        assert.ok(launch.origins.length >= 3); assert.ok(launch.origins.every(p => p.y >= 478));
        assert.ok(launch.covered, 'Tiles must stay covered during flight'); assert.equal(launch.parent, null);
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').children.getChildren().some(o => o.name === 'photo-reveal-spark' && o.y < 478));
        fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
        await page.screenshot({ path: path.join(__dirname, '../tmp/photo-reveal-flight.png') });
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').children.getByName('photo-reveal-shard'));
        await page.screenshot({ path: path.join(__dirname, '../tmp/photo-reveal-impact.png') });
        await page.waitForFunction(() => { const s = window.game.scene.getScene('PhotoChallengeScene'); return !s.revealVFX.active && !s.revealVFX.timer && !s.board.boardBusy; });
        const settled = await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene'); s.refresh(); s.refresh();
            return { expected: Math.floor(s.run.progress * 48), revealed: s.coverTiles.filter(t => t.revealed && t.alpha === 0).length, impacts: window.impacts, objects: s.revealVFX.objects.size };
        });
        assert.ok(settled.revealed > 0); assert.equal(settled.revealed, settled.expected);
        assert.equal(settled.impacts.length, settled.revealed); assert.equal(settled.objects, 0);
        assert.ok(settled.impacts.every(t => t.alpha === 1 && t.pending));
        console.log('PASS: real drag match launches above board mask; tiles stay opaque until impact, shatter once, and match earned progress');

        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').scene.restart({ index: 19 }));
        await page.waitForFunction(ready); await fixture(3); await match();
        await page.waitForFunction(() => { const s = window.game.scene.getScene('PhotoChallengeScene'); return s.run.won && s.revealVFX.active > 0; });
        assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').resultShown), false);
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').resultShown);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').coverTiles.filter(t => t.revealed).length), 48);
        console.log('PASS: victory waits for all 48 tiles to shatter');

        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').scene.restart({ index: 19 }));
        await page.waitForFunction(ready); await fixture(30); await match();
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').revealVFX.active > 0);
        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').scene.restart({ index: 19 }));
        await page.waitForFunction(ready);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').events.listenerCount('gemsCleared')), 1);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').revealVFX.objects.size), 0);
        assert.deepEqual(errors, []);
        console.log('PASS: restarting during flight cleans effects and keeps one listener; no browser errors');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
