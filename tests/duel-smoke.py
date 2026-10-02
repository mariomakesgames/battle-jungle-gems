"""Play AI duel through real swaps, rewards, AI turns, pause, result and replay.

Requires Playwright + Chromium and a running Vite/production preview server.
"""
import os
from playwright.sync_api import sync_playwright

SCENE = "window.game.scene.getScene('AIDuelScene')"
READY = f"window.game.scene.isActive('AIDuelScene') && {SCENE}.board && !{SCENE}.board.boardBusy && !{SCENE}.duel.pending"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append((response.status, response.url)) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    page.add_init_script("localStorage.setItem('jungle-gems-language', 'zh-CN'); localStorage.setItem('jungle-gems-ai-tutorial-v1', 'seen')")
    page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/'))
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288, 835)
    page.wait_for_function(READY, timeout=60000)
    campaign_save = "JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('phaser_game_'))))"
    original_save = page.evaluate(campaign_save)
    assert page.evaluate(f"{SCENE}.turnLabel.text") == '你的回合'
    assert not any('/images/map/map.webp' in url or '/ui/shop/' in url for url in requests)
    page.evaluate(f"{SCENE}.time.timeScale = 5; {SCENE}.tweens.timeScale = 5")

    def click(name):
        point = page.evaluate('''name => {
            function find(items) {
                for (const item of items) {
                    if(item.name===name) { const b=item.getBounds(); return {x:b.centerX,y:b.centerY}; }
                    if(Array.isArray(item.list)) { const result=find(item.list); if(result)return result; }
                }
            }
            return find(window.game.scene.getScene('AIDuelScene').children.list);
        }''', name)
        assert point, name
        page.mouse.click(point['x'], point['y'])

    def fixture(special=False):
        # Deterministic board: no existing matches; swapping (0,c) with (1,c)
        # forms exactly three or four red gems on the first row.
        page.evaluate('''special => {
            const s=window.game.scene.getScene('AIDuelScene');
            const layout=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*2+c)%6+1));
            if(special) { layout[0].splice(0,4,1,1,2,1); layout[1][2]=1; }
            else { layout[0].splice(0,3,1,2,1); layout[1][1]=1; }
            s.board.loadLevel({gridLayout:layout, availableGems:['red','green','blue','purple','yellow','orange']});
        }''', special)
        assert page.evaluate(f"{SCENE}.board.findAllMatches().length") == 0

    def swap(r1,c1,r2,c2):
        page.mouse.move(45+c1*54+27, 360+r1*54+27)
        page.mouse.down()
        page.mouse.move(45+c2*54+27, 360+r2*54+27, steps=3)
        page.mouse.up()
        page.wait_for_function(READY, timeout=60000)

    fixture()
    # This invalid swap must animate back without charging a turn or score.
    swap(8,7,8,8)
    assert page.evaluate(f"{SCENE}.duel.swapsLeft") == 2
    assert page.evaluate(f"{SCENE}.duel.scores.player") == 0
    fixture(True)
    swap(0,2,1,2)
    assert page.evaluate(f"{SCENE}.duel.swapsLeft") == 2
    assert page.evaluate(f"{SCENE}.notice.text") == '特殊匹配！额外奖励 1 次交换'
    assert page.evaluate(f"{SCENE}.duel.scores.player") > 0
    assert page.evaluate(f"{SCENE}.duel.actor") == 'player'

    fixture()
    # Two taps also perform a swap.
    page.mouse.click(45+54+27, 360+27)
    page.mouse.click(45+54+27, 360+54+27)
    page.wait_for_function(READY, timeout=60000)
    assert page.evaluate(f"{SCENE}.duel.swapsLeft") == 1
    fixture()
    # Observe AI ownership before it starts; the player cannot play on that turn.
    page.evaluate(f"{SCENE}.time.timeScale = 1")
    swap(0,1,1,1)
    assert page.evaluate(f"{SCENE}.duel.actor") == 'ai'
    assert page.evaluate(f"{SCENE}.performMove({{r1:0,c1:0,r2:0,c2:1}}, 'player')") is False
    fixture(True)  # Give the AI the same guaranteed special match as the player.
    click('duel-pause')
    paused = page.evaluate(f"JSON.stringify({SCENE}.duel)")
    page.wait_for_timeout(1000)
    assert page.evaluate(f"JSON.stringify({SCENE}.duel)") == paused
    click('duel-resume')
    page.evaluate(f"{SCENE}.time.timeScale = 5")
    page.wait_for_function(f"{SCENE}.duel.pending?.actor === 'ai' && {SCENE}.duel.pending.accepted && {SCENE}.duel.swapsLeft === 2", timeout=10000)
    page.wait_for_function(f"{SCENE}.duel.actor === 'player' && {SCENE}.duel.round === 2 && !{SCENE}.duel.pending", timeout=60000)
    assert page.evaluate(f"{SCENE}.duel.scores.ai") > 0
    assert page.evaluate(f"{SCENE}.duel.swapsLeft") == 2

    # Complete all remaining rounds through actual input and automatic AI turns.
    def next_move():
        return page.evaluate('''() => {
            const b=window.game.scene.getScene('AIDuelScene').board;
            const ordinary=[], special=[];
            for(let r=0;r<9;r++) for(let c=0;c<9;c++) for(const [r2,c2] of [[r,c+1],[r+1,c]]) {
                const a=b.grid[r]?.[c], d=b.grid[r2]?.[c2]; if(!a||!d)continue;
                b.grid[r][c]=d; b.grid[r2][c2]=a;
                const groups=b.findAllMatches();
                b.grid[r][c]=a; b.grid[r2][c2]=d;
                if(groups.length || b.isPowerup(a) || b.isPowerup(d)) {
                    (groups.some(g=>g.length>=4)?special:ordinary).push([r,c,r2,c2]);
                }
            }
            return ordinary[0] || special[0];
        }''')

    for _ in range(100):
        page.wait_for_function(f"{SCENE}.duel.finished || ({SCENE}.canPlayerAct())", timeout=60000)
        if page.evaluate(f"{SCENE}.duel.finished"): break
        move = next_move()
        assert move, 'Player must have a playable swap'
        swap(*move)
    assert page.evaluate(f"{SCENE}.duel.finished && {SCENE}.duel.round === 10 && {SCENE}.resultShown")
    assert page.evaluate(f"{SCENE}.children.getByName('duel-replay') !== null")
    assert page.evaluate(campaign_save) == original_save
    click('duel-replay')
    page.wait_for_function(READY, timeout=60000)
    assert page.evaluate(f"{SCENE}.duel.round === 1 && {SCENE}.duel.swapsLeft === 2 && {SCENE}.duel.scores.player === 0 && {SCENE}.duel.scores.ai === 0 && !{SCENE}.resultShown")
    click('duel-exit')
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    assert page.evaluate("window.game.events.listenerCount('addScore')") == 0
    for language, label in [('en', 'Your turn'), ('vi', 'Lượt của bạn')]:
        page.evaluate(f"window.game.scene.getScene('TitleScene').children.getByName('language-{language}').emit('pointerdown')")
        page.mouse.click(288,835)
        page.wait_for_function(READY, timeout=60000)
        assert page.evaluate(f"{SCENE}.turnLabel.text") == label
        click('duel-exit')
        page.wait_for_function("window.game.scene.isActive('TitleScene')")
    # Campaign still works after leaving the duel; map entry returns to the map.
    page.mouse.click(288,768)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    page.evaluate("window.game.scene.getScene('MapScene').children.getByName('ai-duel-entry').emit('pointerdown')")
    page.wait_for_function(READY, timeout=60000)
    click('duel-exit')
    page.wait_for_function("window.game.scene.isActive('MapScene')")
    assert not errors, errors
    assert not failures, failures
    print('PASS: cold duel entry, invalid/tap/swipe moves, bonuses for both sides, AI input lock, pause, both scores, 10 rounds, result/replay, three languages, unchanged campaign progress and both exits')
    browser.close()
