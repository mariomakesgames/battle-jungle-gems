"""Play real portrait challenges and check reveal, collection and lazy loading.

Requires Playwright/Chromium and a running production preview.
"""
import json
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/')
SCENE = "window.game.scene.getScene('PhotoChallengeScene')"
READY = f"window.game.scene.isActive('PhotoChallengeScene') && {SCENE}.board && !{SCENE}.board.boardBusy && !{SCENE}.run.pending"
SAVE = 'jungle-gems-photo-collection-v1'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append((response.status, response.url)) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    page.add_init_script("localStorage.setItem('jungle-gems-language','zh-CN')")
    page.goto(URL)
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    campaign = "JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('phaser_game_'))))"
    original_campaign = page.evaluate(campaign)
    page.mouse.click(288, 613)
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    assert not any('/images/beauty/' in url for url in requests), 'Album must not download locked portraits'
    album = "window.game.scene.getScene('PhotoAlbumScene')"
    assert page.evaluate(f"{album}.children.getByName('beauty-photo-1') === null")

    def click(name, scene='PhotoChallengeScene'):
        point = page.evaluate('''([name, scene]) => {
            function find(items) {
                for (const item of items) {
                    if (item.name === name) { const bounds = item.getBounds(); return {x:bounds.centerX, y:bounds.centerY}; }
                    if (Array.isArray(item.list)) { const result = find(item.list); if (result) return result; }
                }
            }
            return find(window.game.scene.getScene(scene).children.list);
        }''', [name, scene])
        assert point, name
        page.mouse.click(point['x'], point['y'])

    def speed():
        page.evaluate(f"{SCENE}.time.timeScale=5; {SCENE}.tweens.timeScale=5")

    def fixture():
        page.evaluate('''() => {
            const s=window.game.scene.getScene('PhotoChallengeScene');
            const layout=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*2+c)%6+1));
            layout[0].splice(0,3,1,2,1); layout[1][1]=1;
            s.board.loadLevel({gridLayout:layout,availableGems:['red','green','blue','purple','yellow','orange']});
        }''')

    def swap(move, valid=True):
        before = page.evaluate(f"{SCENE}.run.movesLeft")
        r1, c1, r2, c2 = move
        page.mouse.move(72+c1*48+24, 478+r1*48+24)
        page.mouse.down()
        page.mouse.move(72+c2*48+24, 478+r2*48+24, steps=3)
        page.mouse.up()
        if valid:
            page.wait_for_function(f"{SCENE}.run.movesLeft < {before}")
        else:
            page.wait_for_timeout(400)
        page.wait_for_function(READY, timeout=60000)

    def best_move():
        return page.evaluate('''() => {
            const b=window.game.scene.getScene('PhotoChallengeScene').board, moves=[];
            for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(const[r2,c2]of[[r,c+1],[r+1,c]]){
                const a=b.grid[r]?.[c],d=b.grid[r2]?.[c2];if(!a||!d)continue;
                b.grid[r][c]=d;b.grid[r2][c2]=a;
                const groups=b.findAllMatches();
                b.grid[r][c]=a;b.grid[r2][c2]=d;
                const power=b.isPowerup(a)||b.isPowerup(d);
                if(groups.length||power)moves.push({move:[r,c,r2,c2],score:(power?500:0)+groups.reduce((n,g)=>n+g.length*10,0)+(groups.some(g=>g.length>=4)?100:0)});
            }
            return moves.sort((a,b)=>b.score-a.score)[0]?.move;
        }''')

    click('beauty-photo-0', 'PhotoAlbumScene')
    page.wait_for_function(READY, timeout=60000)
    speed()
    assert page.evaluate(f"{SCENE}.coverTiles.every(tile=>!tile.revealed && tile.alpha===1)")
    portraits = lambda: [url for url in requests if '/images/beauty/' in url]
    assert len(portraits()) == 1 and portraits()[0].endswith('/garden.webp')
    assert not any('/images/map/map.webp' in url or '/levels/level_' in url for url in requests)
    fixture()
    swap([8, 7, 8, 8], valid=False)
    assert page.evaluate(f"{SCENE}.run.movesLeft===24 && {SCENE}.run.score===0")
    swap([0, 1, 1, 1])
    assert page.evaluate(f"{SCENE}.run.score>0 && {SCENE}.coverTiles.some(tile=>tile.revealed) && {SCENE}.coverTiles.some(tile=>!tile.revealed)")
    page.wait_for_timeout(450)
    assert page.evaluate(f"{SCENE}.coverTiles.filter(tile=>tile.revealed).every(tile=>tile.alpha===0)")
    page.screenshot(path='/tmp/jungle-beauty-reveal.png')
    click('beauty-hint')
    assert page.evaluate(f"{SCENE}.board.hintTweens.length>0")
    click('beauty-pause')
    before = page.evaluate(f"JSON.stringify({SCENE}.run)")
    page.wait_for_timeout(300)
    assert page.evaluate(f"JSON.stringify({SCENE}.run)") == before
    click('duel-resume')

    for index in range(3):
        for _ in range(30):
            if page.evaluate(f"{SCENE}.run.finished"):
                break
            move = best_move()
            assert move, 'Board must offer a valid swap'
            swap(move)
        assert page.evaluate(f"{SCENE}.run.won && {SCENE}.run.finished && {SCENE}.resultShown"), 'Portrait goal must be achievable within its move limit'
        assert json.loads(page.evaluate(f"localStorage.getItem('{SAVE}')"))['completed'] == index+1
        assert page.evaluate(f"{SCENE}.children.list.some(x=>x.list?.some(item=>item.name==='beauty-full-photo'))")
        if index < 2:
            click('beauty-next')
            page.wait_for_function(f"{READY} && {SCENE}.index==={index+1}", timeout=60000)
            speed()
            assert len(portraits()) == index+2, 'Load only the portrait being played'
            assert page.evaluate(f"{SCENE}.run.score===0 && {SCENE}.coverTiles.every(tile=>!tile.revealed)")
    page.screenshot(path='/tmp/jungle-beauty-collected.png')
    assert page.evaluate(campaign) == original_campaign
    click('beauty-result-album')
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    assert page.evaluate("window.game.events.listenerCount('addScore')") == 0
    assert all(page.evaluate(f"{album}.children.getByName('beauty-photo-{index}')!==null") for index in range(3))

    # Reload persists the collection. Viewing only fetches the selected portrait.
    requests.clear()
    page.reload()
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288, 613)
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    click('beauty-photo-1', 'PhotoAlbumScene')
    page.wait_for_function(f"window.game.scene.isActive('PhotoChallengeScene') && {SCENE}.viewing && {SCENE}.resultShown")
    assert len(portraits()) == 1 and portraits()[0].endswith('/sunset.webp')
    assert page.evaluate("window.game.events.listenerCount('addScore')") == 0
    click('beauty-next')  # Replay the collected photo; one valid move with insufficient score loses.
    page.wait_for_function(READY, timeout=60000)
    speed()
    fixture()
    page.evaluate(f"{SCENE}.run.movesLeft=1")
    swap([0, 1, 1, 1])
    assert page.evaluate(f"{SCENE}.run.finished && !{SCENE}.run.won && {SCENE}.resultShown")
    click('beauty-retry')
    page.wait_for_function(READY)
    assert page.evaluate(f"{SCENE}.run.score===0 && {SCENE}.run.movesLeft===24 && !{SCENE}.run.finished")
    click('beauty-exit')
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    click('beauty-album-back', 'PhotoAlbumScene')
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    for language, expected in [('en', 'City at twilight'), ('vi', 'Thành phố về đêm')]:
        page.evaluate(f"window.game.scene.getScene('TitleScene').children.getByName('language-{language}').emit('pointerdown')")
        page.mouse.click(288, 613)
        page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
        click('beauty-photo-2', 'PhotoAlbumScene')
        page.wait_for_function(f"{SCENE}.resultShown && window.game.scene.isActive('PhotoChallengeScene')")
        assert page.evaluate(f"{SCENE}.children.list.some(x=>x.list?.some(item=>item.text==={json.dumps(expected)}))")
        click('beauty-result-album')
        page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
        click('beauty-album-back', 'PhotoAlbumScene')
        page.wait_for_function("window.game.scene.isActive('TitleScene')")
    page.mouse.click(288, 768)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    page.evaluate("window.game.scene.getScene('MapScene').children.getByName('beauty-entry').emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    click('beauty-album-back', 'PhotoAlbumScene')
    page.wait_for_function("window.game.scene.isActive('MapScene')")
    assert not errors, errors
    assert not failures, failures

    # A failed picture request must offer retry, without a blank game or unlock.
    failed = browser.new_page(viewport={'width': 390, 'height': 844})
    failed.route('**/beauty/garden.webp', lambda route: route.abort())
    failed.goto(URL)
    failed.wait_for_function("window.game?.scene.isActive('TitleScene')")
    failed.evaluate("window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown')")
    failed.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    failed.evaluate("window.game.scene.getScene('PhotoAlbumScene').children.getByName('beauty-photo-0').emit('pointerdown')")
    failed.wait_for_function(f"window.game.scene.isActive('PhotoChallengeScene') && {SCENE}.children.getByName('beauty-load-retry')", timeout=60000)
    assert failed.evaluate(f"localStorage.getItem('{SAVE}')") is None
    failed.unroute('**/beauty/garden.webp')
    failed.evaluate(f"{SCENE}.children.getByName('beauty-load-retry').emit('pointerdown')")
    failed.wait_for_function(READY, timeout=60000)
    assert failed.evaluate(f"{SCENE}.run.score===0 && {SCENE}.coverTiles.length===48")
    print('PASS: actual swaps and reveals, invalid move, hint/pause, all three goals, lazy images, collection persistence/view/retry, languages, map/title return, campaign isolation and failed-image recovery')
    browser.close()
