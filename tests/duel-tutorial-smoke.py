"""Exercise first-use tutorial, practice gestures, persistence and paused AI resume."""
import os
from playwright.sync_api import sync_playwright

DUEL = "window.game.scene.getScene('AIDuelScene')"
TUTORIAL = "window.game.scene.getScene('DuelTutorialScene')"
VISIBLE = "window.game?.scene.isActive('DuelTutorialScene')"
READY = f"window.game.scene.isActive('AIDuelScene') && {DUEL}.board && !{DUEL}.board.boardBusy && !{DUEL}.duel.pending"
URL = os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append((response.status, response.url)) if response.status >= 400 else None)
    page.add_init_script("localStorage.setItem('jungle-gems-language','zh-CN')")
    page.goto(URL)
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288,835)
    page.wait_for_function(VISIBLE,timeout=60000)
    assert page.evaluate("window.game.scene.isPaused('AIDuelScene')")
    assert page.evaluate(f"{TUTORIAL}.title.text") == '一起学会 AI 对战'
    snapshot = f"JSON.stringify({{rules:{DUEL}.duel,grid:{DUEL}.board.grid.map(row=>row.map(g=>g?.value))}})"
    before = page.evaluate(snapshot)
    page.mouse.click(288,766)
    assert page.evaluate(f"{TUTORIAL}.step") == 1
    # Next cannot bypass required practice; unrelated gems do not complete it.
    page.mouse.click(288,766)
    page.mouse.click(432,437)
    page.mouse.click(432,517)
    assert page.evaluate(f"{TUTORIAL}.step===1 && !{TUTORIAL}.completed")
    page.mouse.click(216,437)
    page.mouse.click(216,517)
    page.wait_for_function(f"{TUTORIAL}.completed")
    assert page.evaluate(f"{TUTORIAL}.swaps") == 1
    assert page.evaluate(f"{TUTORIAL}.feedback.text") == '三消成功！机会从 2 次变成 1 次。'
    page.mouse.click(288,766)
    assert page.evaluate(f"{TUTORIAL}.step") == 2
    page.screenshot(path='/tmp/jungle-duel-tutorial-bonus.png')
    page.mouse.move(288,437)
    page.mouse.down()
    page.mouse.move(288,517,steps=5)
    page.mouse.up()
    page.wait_for_function(f"{TUTORIAL}.completed")
    assert page.evaluate(f"{TUTORIAL}.swaps") == 1
    assert page.evaluate(f"{TUTORIAL}.feedback.text") == '4 连成功！用 1 次、奖 1 次，仍剩 1 次。'
    page.mouse.click(288,766)
    assert page.evaluate(f"{TUTORIAL}.step") == 3
    page.wait_for_function(f"{TUTORIAL}.completed")
    assert page.evaluate(f"{TUTORIAL}.swaps") == 1
    assert page.evaluate(snapshot) == before
    assert page.evaluate(f"!{DUEL}.music || {DUEL}.music.isPaused")
    page.mouse.click(288,766)
    assert page.evaluate(f"{TUTORIAL}.step") == 4
    page.mouse.click(288,766)
    page.wait_for_function(READY)
    assert page.evaluate(snapshot) == before
    assert page.evaluate("localStorage.getItem('jungle-gems-ai-tutorial-v1')") == 'seen'

    # Reopen during an AI thinking delay and verify its real timer is frozen.
    page.evaluate(f"""() => {{
        const s={DUEL};
        for(let i=0;i<2;i++) {{ s.duel.begin('player'); s.duel.accept(false); s.duel.settle(); }}
        s.refresh(); s.scheduleAI();
    }}""")
    page.mouse.click(288,984)
    page.wait_for_function(VISIBLE)
    before_ai = page.evaluate(snapshot)
    page.wait_for_timeout(1100)
    assert page.evaluate(snapshot) == before_ai
    assert page.evaluate(f"{DUEL}.aiTimer !== null && {DUEL}.duel.actor==='ai'")
    page.mouse.click(288,852)
    page.wait_for_function("window.game.scene.isActive('AIDuelScene')")
    page.wait_for_function(f"{DUEL}.duel.actor==='player' && {DUEL}.duel.round===2 && !{DUEL}.duel.pending",timeout=60000)
    assert page.evaluate(f"{DUEL}.duel.scores.ai") > 0
    page.mouse.click(67,58)
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    page.mouse.click(288,835)
    page.wait_for_function(READY)
    page.wait_for_timeout(300)
    assert not page.evaluate(VISIBLE)
    page.mouse.click(67,58)
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    # Chinese, English and Vietnamese all have a usable first-use introduction.
    for language, title in [('en','Learn to play against AI'),('vi','Học cách đấu với AI')]:
        page.evaluate("localStorage.removeItem('jungle-gems-ai-tutorial-v1')")
        page.evaluate(f"window.game.scene.getScene('TitleScene').children.getByName('language-{language}').emit('pointerdown')")
        page.mouse.click(288,835)
        page.wait_for_function(VISIBLE)
        assert page.evaluate(f"{TUTORIAL}.title.text") == title
        page.mouse.click(288,852)
        page.wait_for_function(READY)
        page.mouse.click(67,58)
        page.wait_for_function("window.game.scene.isActive('TitleScene')")
    assert not errors, errors
    assert not failures, failures
    page.close()

    # Failure of tutorial preference storage must not trap the player.
    page = browser.new_page(viewport={'width':576,'height':1024})
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script('''
        const get=Storage.prototype.getItem, set=Storage.prototype.setItem;
        Storage.prototype.getItem=function(key) {if(key==='jungle-gems-ai-tutorial-v1')throw Error('blocked');return get.call(this,key)};
        Storage.prototype.setItem=function(key,value) {if(key==='jungle-gems-ai-tutorial-v1')throw Error('blocked');return set.call(this,key,value)};
    ''')
    page.goto(URL)
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288,835)
    page.wait_for_function(VISIBLE,timeout=60000)
    page.mouse.click(288,852)
    page.wait_for_function(READY)
    assert not errors, errors
    print('PASS: first-use introduction, tap/swipe practice, bonus opportunity, AI demo, unchanged live duel, frozen/resumed AI timer, saved skip, three languages and blocked preference storage')
    browser.close()
