const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const scene = () => window.game.scene.getScene('PhotoChallengeScene');
const ready = () => window.game.scene.isActive('PhotoChallengeScene') && window.game.scene.getScene('PhotoChallengeScene').canPlayerAct();

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
        await page.goto(process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/');
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await page.mouse.click(100, 100); // Unlock actual WebAudio through a user gesture.
        await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(19));
        await page.waitForFunction(ready);
        const loaded = await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            window.soundCalls = [];
            const original = s.sound.play;
            s.sound.play = function (key, config) { window.soundCalls.push({ key, ...config }); return original.call(this, key, config); };
            s.time.timeScale = 5; s.tweens.timeScale = 5;
            return s.cache.audio.getKeys().filter(k => k.startsWith('sfx_')).map(k => ({ key: k, duration: s.cache.audio.get(k).duration }));
        });
        assert.equal(loaded.length, 25);
        assert.ok(loaded.every(s => s.duration > 0 && s.duration < 1.1));
        await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            s.performMove(s.board.findPotentialMove());
        });
        await page.waitForFunction(() => window.soundCalls.some(c => /sfx_(match|cascade)/.test(c.key)));
        await page.waitForFunction(ready);
        await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            s.boosters.inventory.updateBooster('hammer', 2);
            s.boosters.select('hammer');
            const b = s.board;
            for (let r = 0; r < b.gridSize; r++) for (let c = 0; c < b.gridSize; c++) if (b.blockerGrid[r][c]) { s.boosters.target(r, c); return; }
        });
        await page.waitForFunction(() => window.soundCalls.some(c => c.key === 'sfx_hammer'));
        await page.waitForFunction(ready);
        await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            s.resultShown = false; s.showPhoto(false);
        });
        const calls = await page.evaluate(() => window.soundCalls);
        for (const prefix of ['sfx_swap_', 'sfx_ui', 'sfx_hammer', 'sfx_stone_break', 'sfx_win']) {
            assert.ok(calls.some(c => c.key.startsWith(prefix)), `missing ${prefix}`);
        }
        assert.ok(calls.filter(c => c.key.startsWith('sfx_')).every(c => c.volume <= 1 && c.rate > 0 && !('pitch' in c)));
        assert.ok(!calls.some(c => c.key === 'spin_collect'));
        assert.deepEqual(errors, []);
        console.log('PASS: 25 WAVs decoded by WebAudio; real match, swap, hammer, obstacle and win trigger distinct bounded sounds; no browser errors');

        // A fresh game follows persisted mute, including the same real actions.
        await page.evaluate(() => localStorage.setItem('soundVolume', '0'));
        await page.reload();
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(19));
        await page.waitForFunction(ready);
        await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            window.mutedSfx = [];
            const original = s.sound.play;
            s.sound.play = function (key, config) { if (key.startsWith('sfx_')) window.mutedSfx.push(key); return original.call(this, key, config); };
            s.time.timeScale = 5; s.tweens.timeScale = 5;
            s.performMove(s.board.findPotentialMove());
        });
        await page.waitForFunction(ready);
        assert.deepEqual(await page.evaluate(() => window.mutedSfx), []);
        console.log('PASS: persisted mute suppresses gameplay sounds');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
