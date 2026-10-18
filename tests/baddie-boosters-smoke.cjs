const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = "window.game.scene.getScene('PhotoChallengeScene')";
const ready = () => window.game.scene.isActive('PhotoChallengeScene') &&
    window.game.scene.getScene('PhotoChallengeScene').board &&
    window.game.scene.getScene('PhotoChallengeScene').canPlayerAct();

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [], failures = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('response', r => { if(r.status()>=400)failures.push(r.url()); });
        await page.goto(process.env.JUNGLE_GEMS_URL || 'http://127.0.0.1:4173/');
        await page.waitForFunction(() => window.game?.scene.isActive('TitleScene'));
        await page.evaluate(() => window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown'));
        await page.waitForFunction(() => window.game.scene.getScene('BaddieMapScene').ready);
        await page.evaluate(() => window.game.scene.getScene('BaddieMapScene').openLevel(19));
        await page.waitForFunction(ready);
        await page.evaluate(() => {
            const s=window.game.scene.getScene('PhotoChallengeScene');
            s.time.timeScale=8;s.tweens.timeScale=8;
            for(const type of ['hammer','swap','rocket','shuffle'])s.boosters.inventory.updateBooster(type,3-s.boosters.inventory.getBoosterCount(type));
            s.boosters.refresh();
        });
        const campaign = await page.evaluate(() => JSON.stringify(window.game.scene.getScene('PhotoChallengeScene').boosters.inventory.getProgression()));
        const initialMoves = await page.evaluate(() => window.game.scene.getScene('PhotoChallengeScene').run.movesLeft);
        async function clickName(name) {
            const p=await page.evaluate(name=>{
                const s=window.game.scene.getScene('PhotoChallengeScene'),b=s.children.getByName(name).getBounds(),r=window.game.canvas.getBoundingClientRect();
                return {x:r.left+b.centerX*r.width/576,y:r.top+b.centerY*r.height/1024};
            },name);await page.mouse.click(p.x,p.y);
        }
        async function cellPoint(cell) {
            return page.evaluate(([row,col])=>{const s=window.game.scene.getScene('PhotoChallengeScene'),p=s.board.getCellPosition(row,col),r=window.game.canvas.getBoundingClientRect();return {x:r.left+p.x*r.width/576,y:r.top+p.y*r.height/1024};},cell);
        }
        async function clickCell(cell) {const p=await cellPoint(cell);await page.mouse.click(p.x,p.y);}
        async function count(type){return page.evaluate(type=>window.game.scene.getScene('PhotoChallengeScene').boosters.inventory.getBoosterCount(type),type);}

        // Hammer: actual drag from toolbar to an obstacle in the tenth row.
        const target=await page.evaluate(()=>{const b=window.game.scene.getScene('PhotoChallengeScene').board;for(let r=b.gridSize-1;r>=0;r--)for(let c=b.gridSize-1;c>=0;c--)if(b.blockerGrid[r][c])return[r,c];});
        assert.equal(target[0],9);
        const before=await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.objectives[0].remaining);
        const icon=await page.evaluate(()=>{const s=window.game.scene.getScene('PhotoChallengeScene'),b=s.children.getByName('baddie-booster-hammer').getBounds(),r=window.game.canvas.getBoundingClientRect();return {x:r.left+b.centerX*r.width/576,y:r.top+b.centerY*r.height/1024};});
        const point=await cellPoint(target);
        await page.mouse.move(icon.x,icon.y);await page.mouse.down();await page.mouse.move(point.x,point.y,{steps:5});await page.mouse.up();
        await page.waitForFunction(ready);
        assert.equal(await count('hammer'),2);
        assert.ok(await page.evaluate(before=>window.game.scene.getScene('PhotoChallengeScene').run.objectives[0].remaining<before,before));
        assert.ok(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.progress>0));
        console.log('PASS: drag hammer destroys a tenth-row obstacle, updates reveal and consumes one inventory item');

        // Pause cancels an armed booster; no inventory is spent.
        await clickName('baddie-booster-rocket');await clickName('beauty-pause');
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').activeBooster),null);
        assert.equal(await count('rocket'),3);
        await page.evaluate(()=>{const s=window.game.scene.getScene('PhotoChallengeScene');s.pausePanel.list.find(item=>item.name==='duel-resume').emit('pointerdown');});
        await page.waitForFunction(ready);

        // Arbitrary free swap: selecting the same gem cancels without spending.
        const cells=await page.evaluate(()=>{const b=window.game.scene.getScene('PhotoChallengeScene').board,a=[];for(let r=0;r<b.gridSize;r++)for(let c=0;c<b.gridSize;c++)if(b.grid[r][c]&&!b.isCellBlockedForMovement(r,c))a.push([r,c]);return[a[0],a.at(-1)];});
        await clickName('baddie-booster-swap');await clickCell(cells[0]);await clickCell(cells[0]);
        assert.equal(await count('swap'),3);
        await clickName('baddie-booster-swap');await clickCell(cells[0]);
        assert.equal(await count('swap'),3);
        await clickCell(cells[1]);await page.waitForFunction(ready);
        assert.equal(await count('swap'),2);
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft),initialMoves);
        console.log('PASS: free nonadjacent swap charges only after two distinct valid targets and spends no move');

        await clickName('baddie-booster-rocket');await clickCell([9,9]);await page.waitForFunction(ready);
        assert.equal(await count('rocket'),2);
        await clickName('baddie-booster-shuffle');await clickCell([5,5]);await page.waitForFunction(ready);
        assert.equal(await count('shuffle'),2);
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft),initialMoves);
        assert.ok(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').board.grid.flat().filter(Boolean).every(g=>g.sprite.visible)));
        console.log('PASS: rocket and shuffle settle on a 10x10 board, consume one each and leave moves unchanged');
        fs.mkdirSync(path.join(__dirname,'../tmp'),{recursive:true});
        await page.screenshot({path:path.join(__dirname,'../tmp/baddie-boosters.png')});

        // Empty inventory disables the button, and restarting does not reset it.
        await page.evaluate(()=>{const s=window.game.scene.getScene('PhotoChallengeScene');s.boosters.inventory.updateBooster('hammer',-2);s.boosters.refresh();});
        await clickName('baddie-booster-hammer');
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').activeBooster),null);
        assert.equal(await count('hammer'),0);
        await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').scene.restart({index:19}));
        await page.waitForFunction(ready);
        assert.equal(await count('hammer'),0);
        assert.equal(await page.evaluate(()=>window.game.events.listenerCount('boosterCountUpdated')),1);
        assert.equal(await page.evaluate(()=>JSON.stringify(window.game.scene.getScene('PhotoChallengeScene').boosters.inventory.getProgression())),campaign);

        // A controlled last-obstacle fixture verifies that a booster alone can win.
        await page.evaluate(()=>{
            const s=window.game.scene.getScene('PhotoChallengeScene'),size=10;
            s.time.timeScale=8;s.tweens.timeScale=8;
            const grid=Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>(r*2+c)%4+1));
            const blockers=Array.from({length:size},()=>Array(size).fill(0));blockers[9][9]=2;
            const config={gridSize:size,gridLayout:grid,blockerLayout:blockers,availableGems:['red','green','blue','purple'],maxMoves:3,objectives:[{target:'blocker',type:'stone',count:1}]};
            s.board.loadLevel(config);s.board.initializeObjectives(config);s.board.isMoveBasedLevel=false;
            s.run=new s.run.constructor({moves:3,objectives:config.objectives});
            s.boosters.inventory.updateBooster('hammer',1);s.refresh();
        });
        await clickName('baddie-booster-hammer');await clickCell([9,9]);
        await page.waitForFunction(()=>window.game.scene.getScene('PhotoChallengeScene').resultShown);
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.won),true);
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.progress),1);
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft),3);
        assert.equal(await count('hammer'),0);
        fs.mkdirSync(path.join(__dirname,'../tmp'),{recursive:true});
        await page.screenshot({path:path.join(__dirname,'../tmp/baddie-booster-win.png')});
        await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').scene.restart({index:22}));
        await page.waitForFunction(ready);
        const ropeCase=await page.evaluate(()=>{
            const s=window.game.scene.getScene('PhotoChallengeScene');s.time.timeScale=8;s.tweens.timeScale=8;
            s.boosters.inventory.updateBooster('hammer',1);s.refresh();
            let hole,rope;
            for(let r=0;r<s.board.gridSize;r++)for(let c=0;c<s.board.gridSize;c++) {
                if(!s.board.grid[r][c])hole=[r,c];
                if(s.board.blockerGrid[r][c]?.type==='rope')rope=[r,c];
            }
            return{hole,rope,moves:s.run.movesLeft};
        });
        await clickName('baddie-booster-hammer');await clickCell(ropeCase.hole);
        assert.equal(await count('hammer'),1,'A hole must not consume a booster');
        await clickCell(ropeCase.rope);await page.waitForFunction(ready);
        assert.equal(await count('hammer'),0);
        assert.ok(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.progress>0));
        assert.equal(await page.evaluate(()=>window.game.scene.getScene('PhotoChallengeScene').run.movesLeft),ropeCase.moves);
        assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
        console.log('PASS: zero inventory, pause, restart, listener cleanup, 9x9 rope goals, holes and booster-only full reveal victory');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
