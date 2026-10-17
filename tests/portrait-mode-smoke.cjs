// Requires Playwright and a running production preview (JUNGLE_GEMS_URL).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const URL = process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/';
const SAVE = 'jungle-gems-photo-collection-v1';
const portraits = ['8059755', '8363683', '9013533', '8790150', '8105566', '8400104', '8682657', '8933700', '9504564', '8584916', '8682687'];
const ready = () => window.game?.scene.isActive('PhotoChallengeScene') &&
    window.game.scene.getScene('PhotoChallengeScene').board &&
    !window.game.scene.getScene('PhotoChallengeScene').board.boardBusy &&
    !window.game.scene.getScene('PhotoChallengeScene').run.pending;

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [], failures = [];
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.on('pageerror', error => errors.push(String(error)));
        page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
        const requests = [];
        page.on('request', request => requests.push(request.url()));
        await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ completed: 53 })), SAVE);
        await page.goto(URL);
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        async function click(scene, name) {
            const point = await page.evaluate(([scene, name]) => {
                function find(list) {
                    for (const item of list) {
                        if (item.name === name) return item;
                        if (item.list) { const found = find(item.list); if (found) return found; }
                    }
                }
                const bounds = find(window.game.scene.getScene(scene).children.list).getBounds();
                const rect = window.game.canvas.getBoundingClientRect();
                return { x: rect.left + bounds.centerX * rect.width / 576,
                    y: rect.top + bounds.centerY * rect.height / 1024 };
            }, [scene, name]);
            await page.mouse.click(point.x, point.y);
        }
        await click('TitleScene', 'beauty-entry');
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').nodes.length), 54);
        assert.equal(requests.filter(url => url.includes('/beauty/')).length, 0);
        const beforeCampaign = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('phaser_game_')))));
        for (let index = 0; index < 54; index++) {
            await page.evaluate(index => {
                for (const scene of window.game.scene.getScenes(true)) window.game.scene.stop(scene.sys.settings.key);
                window.game.scene.start('PhotoChallengeScene', { index });
            }, index);
            await page.waitForFunction(ready);
            const classic = index % 9 + 1;
            const expected = JSON.parse(fs.readFileSync(path.join(__dirname, `../public/assets/levels/level_${classic}.json`)));
            const actual = await page.evaluate(classic => {
                const s = window.game.scene.getScene('PhotoChallengeScene');
                return { index: s.index, cache: s.cache.json.get(`photo_classic_${classic}`),
                    moves: s.run.movesLeft, objectives: s.run.objectives.map(({ remaining, ...goal }) => goal),
                    blockers: s.board.blockerGrid.flat().filter(Boolean).map(b => b.type),
                    texture: s.portrait.texture.key, width: s.portrait.texture.source[0].width,
                    height: s.portrait.texture.source[0].height, covered: s.coverTiles.every(t => !t.revealed) };
            }, classic);
            assert.equal(actual.index, index);
            assert.deepEqual(actual.cache, expected);
            assert.equal(actual.moves, expected.maxMoves);
            assert.deepEqual(actual.objectives, expected.objectives.map(goal => goal.target === 'blocker'
                ? { ...goal, count: actual.blockers.filter(type => type === goal.type).length } : goal));
            assert.equal(actual.texture, `beauty_pixabay_${portraits[index % 11]}`);
            assert.equal(actual.width, 640); assert.equal(actual.height, 800);
            assert.equal(actual.covered, true);
        }
        assert.equal(requests.filter(url => url.includes('/beauty/')).length, 11);
        assert.equal(requests.filter(url => /\/levels\/level_/.test(url)).length, 9);
        console.log('PASS: 54 boards, classic budgets/goals, 11 cached portraits and 9 cached level JSONs');

        // Play a new collection from the first level using real drag input.
        await page.evaluate(() => { window.game.scene.getScene('PhotoChallengeScene').scene.start('BaddieMapScene'); });
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        // A fresh browser context provides an empty collection.
        const fresh = await browser.newPage({ viewport: { width: 576, height: 1024 } });
        fresh.on('pageerror', error => errors.push(String(error)));
        await fresh.goto(URL);
        await fresh.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await fresh.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await fresh.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await fresh.evaluate(() => window.game.scene.getScene('BaddieMapScene').children.getByName('baddie-continue').emit('pointerdown'));
        await fresh.waitForFunction(ready);
        for (let attempt = 0; attempt < 3; attempt++) {
            await fresh.evaluate(() => { const s = window.game.scene.getScene('PhotoChallengeScene'); s.time.timeScale = 5; s.tweens.timeScale = 5; });
            for (let turn = 0; turn < 20; turn++) {
                if (await fresh.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').run.finished)) break;
                const move = await fresh.evaluate(() => {
                    const b = window.game.scene.getScene('PhotoChallengeScene').board, moves = [];
                    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) for (const [r2, c2] of [[r, c+1], [r+1, c]]) {
                        const a=b.grid[r]?.[c], d=b.grid[r2]?.[c2]; if (!a || !d) continue;
                        b.grid[r][c]=d; b.grid[r2][c2]=a;
                        const groups=b.findAllMatches(); b.grid[r][c]=a; b.grid[r2][c2]=d;
                        const power=b.isPowerup(a)||b.isPowerup(d);
                        if(groups.length||power) moves.push({move:[r,c,r2,c2],score:(power?100:0)+groups.reduce((n,g)=>n+g.length+g.filter(p=>p.value==='red').length*10,0)});
                    }
                    return moves.sort((a,b)=>b.score-a.score)[0]?.move;
                });
                assert.ok(move);
                const before = await fresh.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').run.movesLeft);
                await fresh.mouse.move(96+move[1]*48, 502+move[0]*48); await fresh.mouse.down();
                await fresh.mouse.move(96+move[3]*48, 502+move[2]*48, { steps: 3 }); await fresh.mouse.up();
                await fresh.waitForFunction(before => window.game.scene.getScene('PhotoChallengeScene').run.movesLeft < before, before);
                await fresh.waitForFunction(ready);
            }
            if (await fresh.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').run.won)) break;
            if (attempt < 2) {
                await fresh.evaluate(() => { const s = window.game.scene.getScene('PhotoChallengeScene'); for (const item of s.children.list) item.list?.find(x=>x.name==='beauty-retry')?.emit('pointerdown'); });
                await fresh.waitForFunction(ready);
            }
        }
        assert.equal(await fresh.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').run.won), true);
        assert.equal(await fresh.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').children.list
            .filter(item => item.list).flatMap(item => item.list).some(item => item.text === 'Portrait · Level 1')), true);
        assert.equal(await fresh.evaluate(key => JSON.parse(localStorage.getItem(key)).completed, SAVE), 1);
        fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
        await fresh.screenshot({ path: path.join(__dirname, '../tmp/portrait-win.png') });
        console.log('PASS: real swaps complete the classic goal, reveal the new photo and save collection progress');

        const migrated = await browser.newPage();
        await migrated.addInitScript(key => localStorage.setItem(key, JSON.stringify({ completed: 30 })), SAVE);
        await migrated.goto(URL);
        await migrated.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await migrated.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await migrated.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await migrated.evaluate(() => window.game.scene.getScene('BaddieMapScene').children.getByName('baddie-continue').emit('pointerdown'));
        await migrated.waitForFunction(ready);
        assert.equal(await migrated.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').index), 30);
        await migrated.close();
        // The last level is reachable on the extended map.
        await page.evaluate(() => { for (const s of window.game.scene.getScenes(true)) window.game.scene.stop(s.sys.settings.key); window.game.scene.start('BaddieMapScene', { focusIndex: 53 }); });
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        assert.equal(await page.evaluate(() => { const s = window.game.scene.getScene('BaddieMapScene'), y=s.nodes[53].y-s.cameras.main.scrollY; return y>=180 && y<1024; }), true);
        await click('BaddieMapScene', 'baddie-gallery');
        await page.waitForFunction(() => window.game.scene.getScene('PhotoAlbumScene').ready);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('PhotoAlbumScene').index), 52);
        await click('PhotoAlbumScene', 'beauty-page-previous');
        await page.waitForFunction(() => window.game.scene.getScene('PhotoAlbumScene').ready && window.game.scene.getScene('PhotoAlbumScene').index === 51);
        await click('PhotoAlbumScene', 'beauty-page-next');
        await page.waitForFunction(() => window.game.scene.getScene('PhotoAlbumScene').ready && window.game.scene.getScene('PhotoAlbumScene').index === 52);
        await page.screenshot({ path: path.join(__dirname, '../tmp/portrait-gallery.png') });
        assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('phaser_game_'))))), beforeCampaign);
        assert.deepEqual(errors, []); assert.deepEqual(failures, []);
        console.log('PASS: last chapter visible, gallery renders new art, campaign progress unchanged, no browser errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
