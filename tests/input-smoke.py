"""Regression checks for real pointer gestures, cancellation and language startup.

Requires Playwright/Chromium and a running production preview. WebRTC peers use
the same duel controller; tests/webrtc-smoke.py covers real online synchronization.
"""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/')
MODES = os.environ.get('JUNGLE_GEMS_INPUT_MODES', 'GameScene,AIDuelScene,PhotoChallengeScene').split(',')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 800, 'height': 1024}, locale='zh-CN', has_touch=True)
    page = context.new_page()
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('pageerror', lambda error: print('PAGE ERROR:', error.stack, flush=True))
    page.on('response', lambda response: failures.append((response.status, response.url)) if response.status >= 400 else None)
    page.add_init_script("localStorage.setItem('jungle-gems-ai-tutorial-v1','seen')")
    page.goto(URL)
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    assert page.evaluate("document.documentElement.lang") == 'en', 'A Chinese browser must still start in English'
    page.evaluate("window.game.scene.getScene('TitleScene').children.getByName('language-zh-CN').emit('pointerdown')")
    page.reload()
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    assert page.evaluate("document.documentElement.lang") == 'zh-CN', 'Keep the manually saved language'

    def point(x, y):
        return page.evaluate('''([x,y]) => {
            const rect=window.game.canvas.getBoundingClientRect();
            return {x:rect.left+x*rect.width/576,y:rect.top+y*rect.height/1024};
        }''', [x, y])

    def click(x, y):
        pos = point(x, y)
        page.mouse.click(pos['x'], pos['y'])
        page.wait_for_timeout(60)

    click(288, 768)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    page.evaluate("window.game.scene.getScene('MapScene').children.list.find(x=>x.levelId===1).button.emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('LevelReviewPopup')")
    click(288, 750)
    page.wait_for_function("window.game.scene.isActive('GameScene') && window.game.scene.getScene('GameScene').board?.gems.length===81", timeout=60000)

    if MODES[0] != 'GameScene':
        page.evaluate("name=>{window.game.scene.stop('UIScene');window.game.scene.stop('GameScene');window.game.scene.start(name)}", MODES[0])

    for name in MODES:
        scene = f"window.game.scene.getScene('{name}')"
        ready = f"window.game.scene.isActive('{name}') && {scene}.board && !{scene}.board.boardBusy"
        page.wait_for_function(ready, timeout=60000)
        print('Checking gestures in ' + name, flush=True)
        page.evaluate('''name => {
            const s=window.game.scene.getScene(name);
            // Controlled gesture fixtures do not play a timed campaign level.
            // Accelerating animation must not open LosePopup during the checks.
            if(name==='GameScene') {s.isTimerRunning=false;s.timer?.remove();}
            s.time.timeScale=5;s.tweens.timeScale=5;
            s.inputSwaps=[];
            const swap=s.board.swapGems.bind(s.board);
            s.board.swapGems=(a,b,...options)=>{
                s.inputSwaps.push([a.sprite.getData('row'),a.sprite.getData('col'),b.sprite.getData('row'),b.sprite.getData('col')]);
                return swap(a,b,...options);
            };
        }''', name)

        def fixture():
            page.wait_for_function(ready, timeout=60000)
            page.evaluate('''name => {
                const s=window.game.scene.getScene(name), b=s.board;
                const layout=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*2+c)%6+1));
                layout[0].splice(0,3,1,2,1);layout[1][1]=1;
                b.loadLevel({gridLayout:layout,availableGems:['red','green','blue','purple','yellow','orange']});
                b.maybeEmitLevelCompleted=()=>{};b.isMoveBasedLevel=false;
                s.inputSwaps=[];s.cancelBoardGesture();
            }''', name)
            # Phaser flushes destroyed interactive objects on its next frame.
            page.wait_for_timeout(60)

        def cell(r, c, fraction=0.5):
            logical = page.evaluate(f"({{x:{scene}.board.offsetX+({c}+{fraction})*{scene}.board.cellSize,y:{scene}.board.offsetY+({r}+0.5)*{scene}.board.cellSize}})")
            return point(logical['x'], logical['y'])

        def drag(label, dx=0, dy=0, hold=0, gap=False, outside=False, cancel=None):
            fixture()
            start = cell(4, 4, 0.97 if gap else 0.5)
            scaled_cell = page.evaluate(f"{scene}.board.cellSize*window.game.canvas.getBoundingClientRect().width/576")
            end = {'x': start['x']+dx*scaled_cell, 'y': start['y']+dy*scaled_cell}
            if outside:
                end['x'] = page.evaluate("window.game.canvas.getBoundingClientRect().right+35")
            page.mouse.move(start['x'], start['y']);page.mouse.down()
            if hold: page.wait_for_timeout(hold)
            if cancel == 'blur':
                page.evaluate("window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))")
            elif cancel == 'touch':
                page.evaluate("window.game.canvas.dispatchEvent(new Event('pointercancel'))")
            elif cancel == 'pause':
                page.evaluate(f"{scene}.scene.pause();{scene}.scene.resume()")
            page.mouse.move(end['x'], end['y'], steps=3);page.mouse.up()
            if cancel:
                page.wait_for_timeout(250)
                assert page.evaluate(f"{scene}.inputSwaps") == [], (name, label)
            else:
                page.wait_for_function(f"{scene}.inputSwaps.length===1", timeout=5000)
                assert page.evaluate(f"{scene}.inputSwaps") == [[4, 4, 4, 5]], (name, label)
            page.wait_for_function(ready, timeout=60000)

        drag('short drag', dx=0.4)
        drag('slow drag', dx=1, hold=750)
        drag('overshoot', dx=2.8)
        drag('dominant diagonal', dx=2, dy=0.7)
        drag('cell gap', dx=0.4, gap=True)
        drag('outside release', outside=True)
        drag('blur cancellation', dx=1, cancel='blur')
        drag('pointer cancellation', dx=1, cancel='touch')
        drag('pause cancellation', dx=1, cancel='pause')
        fixture()
        start = cell(4, 4)
        page.mouse.move(start['x'], start['y']);page.mouse.down();page.mouse.move(start['x']+2,start['y']+1);page.mouse.up()
        page.wait_for_timeout(100)
        assert page.evaluate(f"{scene}.inputSwaps") == [], (name, 'tap jitter')
        assert page.evaluate(f"{scene}.board.selectedGem?.sprite.getData('col')") == 4
        next_cell = cell(4, 5)
        page.mouse.click(next_cell['x'], next_cell['y'])
        page.wait_for_function(f"{scene}.inputSwaps.length===1")
        page.wait_for_function(ready, timeout=60000)

        # Starting while locked must not create a delayed swap after unlocking.
        fixture()
        page.evaluate(f"{scene}.board.boardBusy=true")
        start, end = cell(4, 4), cell(4, 5)
        page.mouse.move(start['x'], start['y']);page.mouse.down();page.wait_for_timeout(50)
        page.evaluate(f"{scene}.board.boardBusy=false")
        page.mouse.move(end['x'], end['y']);page.mouse.up();page.wait_for_timeout(150)
        assert page.evaluate(f"{scene}.inputSwaps") == [], (name, 'busy press')

        # Scaled canvas + actual touch events use the same logical threshold.
        page.set_viewport_size({'width': 390, 'height': 844});page.wait_for_timeout(150)
        fixture()
        start, end = cell(4, 4), cell(4, 5)
        cdp = context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':start['x'],'y':start['y'],'id':1}]})
        page.wait_for_timeout(60)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':start['x']+(end['x']-start['x'])*0.4,'y':start['y'],'id':1}]})
        cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        page.wait_for_function(f"{scene}.inputSwaps.length===1")
        page.wait_for_function(ready, timeout=60000)
        cdp.detach()
        page.set_viewport_size({'width':800,'height':1024});page.wait_for_timeout(100)

        if name == 'GameScene':
            # A booster is still selected by its real UI and consumed exactly once.
            fixture()
            icon = page.evaluate("""() => {
                const icon=window.game.scene.getScene('UIScene').children.list.find(x=>x.getData?.('boosterType')==='hammer');
                const bounds=icon.getBounds();return {x:bounds.centerX,y:bounds.centerY};
            }""")
            assert icon, 'Hammer icon'
            click(icon['x'], icon['y'])
            page.wait_for_function(f"{scene}.activeBooster==='hammer'")
            count = page.evaluate("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count")
            target = cell(4, 4)
            page.mouse.click(target['x'], target['y'])
            page.wait_for_function("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count < " + str(count))
            page.wait_for_timeout(400)
            page.wait_for_function(ready, timeout=60000)
            assert page.evaluate("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count") == count-1
            assert page.evaluate(f"{scene}.inputSwaps") == [], 'Booster click must not also swap gems'
            fixture()
            count = page.evaluate("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count")
            source, target = point(icon['x'], icon['y']), cell(4, 4)
            page.mouse.move(source['x'], source['y']);page.mouse.down();page.wait_for_timeout(80)
            page.mouse.move(target['x'], target['y'], steps=12);page.mouse.up()
            page.wait_for_function("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count < " + str(count))
            page.wait_for_timeout(400)
            page.wait_for_function(ready, timeout=60000)
            assert page.evaluate("window.game.scene.getScene('UIScene').boosterQuantityDisplays.hammer.count") == count-1
            assert page.evaluate(f"{scene}.inputSwaps") == [], 'Booster drop must not also swap gems'
            print('PASS: campaign booster tap and drag each consume once without an extra gem swap', flush=True)
            page.evaluate("window.game.scene.stop('UIScene');window.game.scene.stop('GameScene');window.game.scene.start('AIDuelScene')")
        elif name == 'AIDuelScene':
            fixture()
            page.evaluate(f"{scene}.duel.actor='ai';{scene}.refresh()")
            start,end=cell(4,4),cell(4,5)
            page.mouse.move(start['x'],start['y']);page.mouse.down();page.mouse.move(end['x'],end['y']);page.mouse.up();page.wait_for_timeout(150)
            assert page.evaluate(f"{scene}.inputSwaps") == [], 'AI turn must remain locked'
            # Use the same scene transition as the UI so AI timers/listeners stop.
            page.evaluate(f"{scene}.scene.start('PhotoChallengeScene',{{index:0}})")
        print('PASS: ' + name + ' short/slow/overshot/gap/outside/touch input, taps, locks and cancellation', flush=True)

    assert not errors, errors
    assert not failures, failures
    print('PASS: first-visit English, saved language and pointer regressions in ' + ', '.join(MODES))
    browser.close()
