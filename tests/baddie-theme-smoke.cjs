const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
        await page.goto(process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/');
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
        for (const language of ['zh-CN', 'vi', 'en']) {
            await page.evaluate(language => window.game.scene.getScene('TitleScene').children.getByName(`language-${language}`).emit('pointerdown'), language);
            const label = await page.evaluate(() => {
                const s = window.game.scene.getScene('TitleScene'), b = s.children.getByName('beauty-entry-label').getBounds();
                return { left: b.left, right: b.right, text: s.children.getByName('beauty-entry-label').text };
            });
            assert.ok(label.left >= 50 && label.right <= 525); assert.ok(!label.text.includes('beautyMode'));
        }
        await page.screenshot({ path: path.join(__dirname, '../tmp/baddie-theme-title.png') });
        await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        assert.equal(await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').nodes[0].button.texture.key), 'baddie_node_unlock');
        await page.screenshot({ path: path.join(__dirname, '../tmp/baddie-theme-map.png') });
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(11));
        await page.waitForFunction(() => window.game.scene.getScene('PhotoChallengeScene').board && window.game.scene.getScene('PhotoChallengeScene').canPlayerAct());
        assert.ok(await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            return s.children.list.some(child => child.texture?.key === 'baddie_atelier') &&
                !s.children.list.some(child => child.texture?.key === 'preloading_background');
        }), 'The loading screen must not cover the new game background');
        const data = await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            const pieces = s.board.grid.flat().filter(Boolean);
            const blockers = s.board.blockerGrid.flat().filter(Boolean);
            const alpha = ['red','green','blue','purple','yellow','orange'].map(color => {
                const source = s.textures.get(`baddie_${color}`).getSourceImage();
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
                const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
                const rgba = ctx.getImageData(0, 0, 256, 256).data;
                return { corner: rgba[3], visible: Array.from(rgba).filter((v,i) => i % 4 === 3 && v > 200).length };
            });
            return { pieces: pieces.map(g => ({ type: g.value, texture: g.sprite.texture.key })),
                blockers: blockers.map(b => b.texture.key), alpha, goals: s.goalCounters.map(({goal, count, icon}) => ({ remaining: goal.remaining, text: count.text, texture: icon.texture.key })) };
        });
        assert.ok(data.pieces.every(g => g.texture === `baddie_${g.type}`));
        assert.ok(data.blockers.every(key => key.startsWith('baddie_')));
        assert.ok(data.alpha.every(a => a.corner === 0 && a.visible > 2000));
        assert.ok(data.goals.length > 0);
        assert.ok(data.goals.every(g => g.text === String(g.remaining) && g.texture.startsWith('baddie_')));
        await page.screenshot({ path: path.join(__dirname, '../tmp/baddie-theme-board.png') });
        const transformations = await page.evaluate(() => {
            const s = window.game.scene.getScene('PhotoChallengeScene');
            const gem = s.board.grid.flat().find(g => g && g.type === 'gem');
            return ['bomb','stripe','color_bomb'].map(type => {
                s.board.transformIntoPowerup(gem, type);
                return { value: gem.value, texture: gem.sprite.texture.key, width: gem.sprite.texture.getSourceImage().width };
            });
        });
        assert.ok(transformations.every(g => g.texture === `baddie_${g.value}` && g.width === 256));
        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').showPause());
        assert.ok(await page.evaluate(() => !!window.game.scene.getScene('PhotoChallengeScene').pausePanel));
        await page.screenshot({ path: path.join(__dirname, '../tmp/baddie-theme-pause.png') });
        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').resumePause());
        await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').leave());
        await page.waitForFunction(() => window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready);
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openGallery());
        await page.waitForFunction(() => window.game.scene.getScene('PhotoAlbumScene').ready);
        await page.screenshot({ path: path.join(__dirname, '../tmp/baddie-theme-gallery.png') });
        assert.deepEqual(errors, []);
        console.log('PASS: localized title, fashion map, transparent garment pieces, matching goals, themed blockers and powerups, pause and gallery; no asset or browser errors');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
