const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const [url, debug] of [[BASE, true], [BASE + '?debug=0', false], ['http://production.test/', false]]) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(String(error)));
            if (url.includes('production.test')) {
                await page.route('http://production.test/**', async route => {
                    const original = new URL(route.request().url());
                    const response = await page.request.get(new URL(original.pathname + original.search, BASE).href);
                    await route.fulfill({ response });
                });
            }
            await page.goto(url);
            await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
            assert.equal(await page.evaluate(() => !!window.game.scene.getScene('TitleScene').children.getByName('debug-mode-label')), debug);
            await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
            await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
            const unlocked = await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').nodes.filter(node => !node.isLocked).length);
            assert.equal(unlocked, debug ? 84 : 1);
            if (debug) {
                await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(83));
                await page.waitForFunction(() => window.game.scene.isActive('PhotoChallengeScene') && window.game.scene.getScene('PhotoChallengeScene').board);
                assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').index), 83);
                assert.equal(await page.evaluate(() => localStorage.getItem('jungle-gems-photo-collection-v1')), null);
                await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').scene.start('TitleScene'));
            } else {
                await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(83));
                assert.equal(await page.evaluate(() => window.game.scene.isActive('BaddieMapScene')), true);
                await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').scene.start('TitleScene'));
            }
            await page.waitForFunction(() => window.game.scene.isActive('TitleScene'));
            await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('classic-mode-entry').emit('pointerdown'));
            await page.waitForFunction(() => window.game.scene.isActive('MapScene') && window.game.scene.getScene('MapScene').children.list.some(item => item.levelId === 9));
            const classic = await page.evaluate(() => window.game.scene.getScene('MapScene').children.list
                .filter(item => Number.isInteger(item.levelId) && item.button).map(node => ({ id: node.levelId, locked: node.isLocked })));
            assert.equal(classic.length, 9);
            assert.equal(classic.filter(node => !node.locked).length, debug ? 9 : 1);
            if (debug) {
                await page.evaluate(() => window.game.scene.getScene('MapScene').children.list.find(item => item.levelId === 9).button.emit('pointerdown'));
                await page.waitForFunction(() => window.game.scene.isActive('LevelReviewPopup') && window.game.scene.getScene('LevelReviewPopup').children.list.some(item => item.texture?.key === 'play_button'));
                assert.equal(await page.evaluate(() => window.game.scene.getScene('LevelReviewPopup').levelId), 9);
                await page.evaluate(() => window.game.scene.getScene('LevelReviewPopup').children.list.find(item => item.texture?.key === 'play_button').emit('pointerdown'));
                await page.waitForFunction(() => window.game.scene.isActive('GameScene') && window.game.scene.getScene('GameScene').board?.levelData);
                assert.equal(await page.evaluate(() => window.game.scene.getScene('GameScene').board.levelData.levelId), 9);
            }
            assert.deepEqual(errors, []);
            console.log(`PASS: ${url} — Portrait ${unlocked}/84, classic ${classic.filter(node => !node.locked).length}/9 unlocked; debug=${debug}`);
            await page.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
