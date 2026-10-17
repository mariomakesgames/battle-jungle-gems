// Requires Playwright, Chrome and a production preview.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const READY = () => window.game.scene.isActive('PhotoChallengeScene') &&
    window.game.scene.getScene('PhotoChallengeScene').board &&
    !window.game.scene.getScene('PhotoChallengeScene').board.boardBusy &&
    !window.game.scene.getScene('PhotoChallengeScene').run.pending;

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.addInitScript(() => localStorage.setItem('jungle-gems-photo-collection-v1', JSON.stringify({ completed: 83 })));
        await page.goto(process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/');
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        async function start(index) {
            await page.evaluate(index => {
                for (const s of window.game.scene.getScenes(true)) window.game.scene.stop(s.sys.settings.key);
                window.game.scene.start('PhotoChallengeScene', { index });
            }, index);
            await page.waitForFunction(READY);
            await page.evaluate(() => { const s=window.game.scene.getScene('PhotoChallengeScene'); s.time.timeScale=10; s.tweens.timeScale=10; });
        }
        async function move() {
            const choice = await page.evaluate(() => {
                const s=window.game.scene.getScene('PhotoChallengeScene'), b=s.board, moves=[];
                for (let r=0;r<b.gridSize;r++) for(let c=0;c<b.gridSize;c++) for(const [r2,c2] of [[r,c+1],[r+1,c]]) {
                    const a=b.grid[r]?.[c], d=b.grid[r2]?.[c2];
                    if(!a||!d||b.isCellBlockedForMovement(r,c)||b.isCellBlockedForMovement(r2,c2))continue;
                    b.grid[r][c]=d;b.grid[r2][c2]=a;
                    const groups=b.findAllMatches();b.grid[r][c]=a;b.grid[r2][c2]=d;
                    const power=b.isPowerup(a)||b.isPowerup(d);
                    if(!groups.length&&!power)continue;
                    const hit=new Set();
                    for(const p of groups.flat())for(const [dr,dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) {
                        if(b.blockerGrid[p.row+dr]?.[p.col+dc])hit.add(`${p.row+dr},${p.col+dc}`);
                    }
                    moves.push({cells:[r,c,r2,c2],score:hit.size*40+groups.flat().length+(power?100:0)});
                }
                const best=moves.sort((a,b)=>b.score-a.score)[0];
                if(!best)return null;
                const rect=window.game.canvas.getBoundingClientRect();
                return {before:s.run.movesLeft,points:[0,2].map(i=>{
                    const pos=b.getCellPosition(best.cells[i],best.cells[i+1]);
                    return {x:rect.left+pos.x*rect.width/576,y:rect.top+pos.y*rect.height/1024};
                })};
            });
            assert.ok(choice, 'Authored board must have a valid move');
            await page.mouse.move(choice.points[0].x,choice.points[0].y);await page.mouse.down();
            await page.mouse.move(choice.points[1].x,choice.points[1].y,{steps:3});await page.mouse.up();
            await page.waitForFunction(before=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft<before,choice.before);
            await page.waitForFunction(READY, {timeout:60000});
        }
        for(let index=0;index<20;index++) {
            await start(index);
            await move();
            const state=await page.evaluate(()=>{
                const s=window.game.scene.getScene('PhotoChallengeScene'),b=s.board;
                return {progress:s.run.progress,moves:s.run.movesLeft,limit:s.level.moves,size:b.gridSize,
                    valid:b.grid.length===b.gridSize && b.grid.every(row=>row.length===b.gridSize),
                    inside:b.grid.flat().filter(Boolean).every(g=>g.sprite.x>=72 && g.sprite.x<=504 && g.sprite.y>=478 && g.sprite.y<=910)};
            });
            assert.ok(state.valid && state.inside);
            assert.equal(state.moves,state.limit-1);
        }
        console.log('PASS: real drag on every imported layout settles; 9/10-cell grids refill inside the board without clipping');
        // Play representative imported boards with a greedy player; their original
        // move budgets and live blocker events determine the result.
        let wins=0;
        for(const index of [0,4,10,19]) {
            for(let attempt=0;attempt<3;attempt++) {
                await start(index);
                const budget=await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft);
                for(let turn=0;turn<budget;turn++) {
                    if(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.finished))break;
                    await move();
                }
                if(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.won)) {
                    wins++; console.log(`PASS: imported level ${index+1} won with real swaps and its original move budget`);
                    fs.mkdirSync(path.join(__dirname,'../tmp'),{recursive:true});
                    await page.screenshot({path:path.join(__dirname,`../tmp/imported-portrait-win-${index+1}.png`)});
                    break;
                }
            }
        }
        assert.ok(wins>=1,'At least one representative imported board should be won by the greedy player');
        await start(19);
        await page.screenshot({path:path.join(__dirname,'../tmp/imported-portrait-10x10.png')});
        assert.deepEqual(errors,[]);
        console.log(`PASS: ${wins}/4 sampled imported levels won; no browser errors`);
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
