"""Real title/map controls, unlocks, returns and lazy assets on a phone."""
import json
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/')
MAP = "window.game.scene.getScene('BaddieMapScene')"
PHOTO = "window.game.scene.getScene('PhotoChallengeScene')"
READY = f"window.game.scene.isActive('PhotoChallengeScene') && {PHOTO}.board && !{PHOTO}.board.boardBusy && !{PHOTO}.run.pending"
SAVE = 'jungle-gems-photo-collection-v1'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':844})
    errors, requests, failures = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.on('response', lambda response: failures.append(response.url) if response.status>=400 else None)
    page.add_init_script(f"localStorage.setItem('{SAVE}',JSON.stringify({{completed:10}}))")
    page.goto(URL)
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")

    def click(scene, name):
        point = page.evaluate('''([scene,name])=>{
            const s=window.game.scene.getScene(scene),item=s.children.getByName(name),b=item.getBounds(),r=window.game.canvas.getBoundingClientRect();
            const y=b.centerY-(item.scrollFactorY===0?0:s.cameras.main.scrollY);
            return {x:r.left+b.centerX*r.width/576,y:r.top+y*r.height/1024};
        }''',[scene,name])
        page.mouse.click(point['x'],point['y']); page.wait_for_timeout(90)

    for lang, label in [('en','Baddie Mode'),('zh-CN','Baddie 模式'),('vi','Chế độ Baddie')]:
        page.evaluate("lang=>window.game.scene.getScene('TitleScene').children.getByName('language-'+lang).emit('pointerdown')",lang)
        buttons=page.evaluate('''()=>{
            const s=window.game.scene.getScene('TitleScene');
            return ['classic-mode-entry','beauty-entry','online-duel-entry','ai-duel-entry'].map(name=>{
                const b=s.children.getByName(name),t=s.children.getByName(name+'-label');
                return {width:b.width,height:b.height,stroke:b.lineWidth,font:t.style.fontSize,label:t.text,textWidth:t.displayWidth};
            });
        }''')
        assert all(b['width']==300 and b['height']==46 and b['stroke']==2 and b['font']=='25px' and b['textWidth']<=280.01 for b in buttons),buttons
        assert buttons[1]['label']==label
    page.evaluate("window.game.scene.getScene('TitleScene').children.getByName('language-en').emit('pointerdown')")
    campaign="JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('phaser_game_'))))"
    original=page.evaluate(campaign)
    click('TitleScene','beauty-entry')
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    assert page.evaluate(f"{MAP}.nodes.length===30 && !{MAP}.nodes[10].isLocked && {MAP}.nodes[11].isLocked")
    assert not any('/images/beauty/' in url or '/levels/' in url for url in requests)
    page.screenshot(path='/tmp/baddie-map-mobile.png')
    # Dragging a level scrolls the map without opening it.
    point=page.evaluate(f"(()=>{{const n={MAP}.nodes[10],r=window.game.canvas.getBoundingClientRect();return {{x:r.left+n.x*r.width/576,y:r.top+(n.y-{MAP}.cameras.main.scrollY)*r.height/1024}}}})()")
    before=page.evaluate(f"{MAP}.cameras.main.scrollY")
    page.mouse.move(point['x'],point['y']);page.mouse.down();page.mouse.move(point['x'],point['y']-100,steps=8);page.mouse.up()
    page.wait_for_timeout(150)
    assert page.evaluate(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.cameras.main.scrollY!=={before}")
    page.evaluate(f"{MAP}.focusLevel(10)")
    # Click the actual shared node image (container is named, its button is local).
    page.evaluate(f"{MAP}.nodes[10].button.setName('baddie-node-11')")
    point=page.evaluate(f"(()=>{{const n={MAP}.nodes[10],r=window.game.canvas.getBoundingClientRect();return {{x:r.left+n.x*r.width/576,y:r.top+(n.y-{MAP}.cameras.main.scrollY)*r.height/1024}}}})()")
    page.mouse.click(point['x'],point['y'])
    page.wait_for_function(READY,timeout=60000)
    assert page.evaluate(f"{PHOTO}.index===10 && {PHOTO}.selectionScene==='BaddieMapScene'")
    click('PhotoChallengeScene','beauty-exit')
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    assert page.evaluate(campaign)==original
    click('BaddieMapScene','baddie-continue')
    page.wait_for_function(READY,timeout=60000)
    page.evaluate(f"{PHOTO}.time.timeScale=5;{PHOTO}.tweens.timeScale=5")
    for _ in range(20):
        if page.evaluate(f"{PHOTO}.run.finished"): break
        move=page.evaluate('''()=>{
            const b=window.game.scene.getScene('PhotoChallengeScene').board,moves=[];
            for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(const [r2,c2] of [[r,c+1],[r+1,c]]){
                const a=b.grid[r]?.[c],d=b.grid[r2]?.[c2];if(!a||!d)continue;
                b.grid[r][c]=d;b.grid[r2][c2]=a;const groups=b.findAllMatches();b.grid[r][c]=a;b.grid[r2][c2]=d;
                const power=b.isPowerup(a)||b.isPowerup(d);
                if(groups.length||power)moves.push({move:[r,c,r2,c2],score:(power?100:0)+groups.reduce((n,g)=>n+g.length+g.filter(x=>x.value==='red').length*10,0)});
            }
            return moves.sort((a,b)=>b.score-a.score)[0]?.move;
        }''')
        assert move
        points=page.evaluate('''move=>{
            const rect=window.game.canvas.getBoundingClientRect();
            return [0,2].map(i=>({x:rect.left+(96+move[i+1]*48)*rect.width/576,y:rect.top+(502+move[i]*48)*rect.height/1024}));
        }''',move)
        before=page.evaluate(f"{PHOTO}.run.movesLeft")
        page.mouse.move(points[0]['x'],points[0]['y']);page.mouse.down();page.mouse.move(points[1]['x'],points[1]['y'],steps=3);page.mouse.up()
        page.wait_for_function(f"{PHOTO}.run.movesLeft<{before}")
        page.wait_for_function(READY,timeout=60000)
    assert page.evaluate(f"{PHOTO}.run.won")
    assert json.loads(page.evaluate(f"localStorage.getItem('{SAVE}')"))['completed']==11
    page.evaluate(f"{PHOTO}.children.list.flatMap(x=>x.list||[]).find(x=>x.name==='beauty-result-album').emit('pointerdown')")
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    assert page.evaluate(f"!{MAP}.nodes[11].isLocked && {MAP}.nodes[12].isLocked && {MAP}.returnScene==='TitleScene'")
    click('BaddieMapScene','baddie-gallery')
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    page.wait_for_function("window.game.scene.getScene('PhotoAlbumScene').ready")
    click('PhotoAlbumScene','beauty-page-previous')
    page.wait_for_function("window.game.scene.getScene('PhotoAlbumScene').ready && window.game.scene.getScene('PhotoAlbumScene').index===9")
    click('PhotoAlbumScene','beauty-album-back')
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    page.evaluate(f"{MAP}.scrollTo(0)")
    assert page.evaluate(f"{MAP}.nodes[29].y-{MAP}.cameras.main.scrollY>=180 && {MAP}.nodes[29].y-{MAP}.cameras.main.scrollY<1024")
    click('BaddieMapScene','baddie-level-30')
    assert page.evaluate("window.game.scene.isActive('BaddieMapScene')"), 'Locked node cannot start a level'
    click('BaddieMapScene','baddie-map-back')
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    click('TitleScene','classic-mode-entry')
    page.wait_for_function("window.game.scene.isActive('MapScene')",timeout=60000)
    click('MapScene','beauty-entry')
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    click('BaddieMapScene','baddie-gallery')
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")
    click('PhotoAlbumScene','beauty-album-back')
    page.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.ready")
    click('BaddieMapScene','baddie-map-back')
    page.wait_for_function("window.game.scene.isActive('MapScene')")
    assert not errors,errors
    assert not failures,failures
    failed=browser.new_page(viewport={'width':390,'height':844})
    failed.on('pageerror',lambda error:errors.append(str(error)))
    failed.route('**/images/map/map.webp',lambda route:route.abort())
    failed.goto(URL)
    failed.wait_for_function("window.game?.scene.isActive('TitleScene')")
    failed.evaluate("window.game.scene.getScene('TitleScene').children.getByName('beauty-entry').emit('pointerdown')")
    failed.wait_for_function(f"window.game.scene.isActive('BaddieMapScene') && {MAP}.children.getByName('baddie-map-retry')",timeout=60000)
    assert failed.evaluate(f"localStorage.getItem('{SAVE}')") is None
    failed.unroute('**/images/map/map.webp')
    failed.evaluate(f"{MAP}.children.getByName('baddie-map-retry').emit('pointerdown')")
    failed.wait_for_function(f"{MAP}.ready && {MAP}.nodes.length===30",timeout=60000)
    assert not errors,errors
    print('PASS: equal title buttons, three translated names, thirty classic map nodes, scroll vs tap, unlock migration, selected-only loading, gallery/view returns, campaign isolation and both entry points')
    browser.close()
