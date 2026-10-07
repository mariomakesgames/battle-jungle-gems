"""Check copied portrait boards, real goal progression and classic title entry.

Requires Playwright/Chromium and a running production preview.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/')
S = "window.game.scene.getScene('PhotoChallengeScene')"
READY = f"window.game.scene.isActive('PhotoChallengeScene') && {S}.board && !{S}.board.boardBusy && !{S}.run.pending"
SAVE = 'jungle-gems-photo-collection-v1'
ROOT = Path(__file__).resolve().parents[1]
IDS = 'lake lavender desert harbor cafe orchard waterfall library rainbow terrace bamboo rose countryside marina moonlight festival cliff bridge island spring'.split()

def open_album(page):
    page.wait_for_function("window.game.scene.isActive('BaddieMapScene') || window.game.scene.isActive('PhotoAlbumScene')")
    if page.evaluate("window.game.scene.isActive('BaddieMapScene')"):
        page.evaluate("window.game.scene.getScene('BaddieMapScene').children.getByName('baddie-gallery').emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('PhotoAlbumScene')")

def return_to(page, target):
    page.wait_for_function("target=>window.game?.scene.isActive(target)||window.game?.scene.isActive('BaddieMapScene')", arg=target)
    if page.evaluate("window.game.scene.isActive('BaddieMapScene')"):
        page.evaluate("window.game.scene.getScene('BaddieMapScene').children.getByName('baddie-map-back').emit('pointerdown')")
    page.wait_for_function("target=>window.game.scene.isActive(target)", arg=target, timeout=60000)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    errors, requests = [], []

    def new_page(completed):
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.add_init_script(f"localStorage.setItem('{SAVE}',JSON.stringify({{completed:{completed}}}))")
        page.goto(URL)
        page.wait_for_function("window.game?.scene.isActive('TitleScene')")
        return page

    def click(page, scene, name):
        point = page.evaluate('''([scene,name])=>{
            function find(items) {
                for(const item of items) {
                    if(item.name===name) return item.getBounds();
                    if(item.list) {const result=find(item.list);if(result)return result;}
                }
            }
            const b=find(window.game.scene.getScene(scene).children.list),r=window.game.canvas.getBoundingClientRect();
            return {x:r.left+b.centerX*r.width/576,y:r.top+b.centerY*r.height/1024};
        }''', [scene, name])
        page.mouse.click(point['x'], point['y'])
        page.wait_for_timeout(90)

    def start(page, index):
        page.evaluate('''index=>{
            for(const s of window.game.scene.getScenes(true)) window.game.scene.stop(s.sys.settings.key);
            window.game.scene.start('PhotoChallengeScene',{index});
        }''', index)
        page.wait_for_function(f"{READY} && {S}.index==={index}", timeout=60000)
        page.evaluate(f"{S}.time.timeScale=5;{S}.tweens.timeScale=5")

    def swap(page, move):
        before = page.evaluate(f"{S}.run.movesLeft")
        points = page.evaluate('''move=>{
            const rect=window.game.canvas.getBoundingClientRect();
            return [0,2].map(i=>({x:rect.left+(96+move[i+1]*48)*rect.width/576,
                y:rect.top+(502+move[i]*48)*rect.height/1024}));
        }''', move)
        page.mouse.move(points[0]['x'], points[0]['y']); page.mouse.down()
        page.mouse.move(points[1]['x'], points[1]['y'], steps=3); page.mouse.up()
        page.wait_for_function(f"{S}.run.movesLeft < {before}")
        page.wait_for_function(READY, timeout=60000)

    title = new_page(10)
    for language, label in [('en','Play Classic Mode'), ('zh-CN','玩经典模式'), ('vi','Chơi chế độ cổ điển')]:
        title.evaluate("lang=>window.game.scene.getScene('TitleScene').children.getByName('language-'+lang).emit('pointerdown')", language)
        bounds = title.evaluate('''()=>{
            const s=window.game.scene.getScene('TitleScene'), item=s.children.getByName('classic-mode-entry-label'), b=item.getBounds();
            return {text:item.text,left:b.left,right:b.right,top:b.top,bottom:b.bottom};
        }''')
        assert bounds['text'] == label, bounds
        assert 0 <= bounds['left'] < bounds['right'] <= 576 and 700 < bounds['top'] < bounds['bottom'] < 810, bounds
    click(title, 'TitleScene', 'classic-mode-entry')
    title.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    print('PASS: classic title label in three languages fits a phone and opens the campaign', flush=True)
    title.close()

    page = new_page(29)
    campaign = "JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('phaser_game_'))))"
    original_campaign = page.evaluate(campaign)
    requests.clear()
    click(page, 'TitleScene', 'beauty-entry')
    page.wait_for_function("window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready")
    assert not any('/beauty/' in url or '/levels/' in url for url in requests)
    requests.clear()  # The entry map has its own assets; challenges load independently.
    for index in range(10, 30):
        start(page, index)
        classic = (index-10) % 9 + 1
        expected = json.loads((ROOT / f'public/assets/levels/level_{classic}.json').read_text())
        actual = page.evaluate(f"({{level:{S}.board.levelData,moves:{S}.run.movesLeft,holes:{S}.board.grid.map(row=>row.map(g=>g===null)),goals:{S}.run.objectives,blockers:{S}.board.blockerGrid.flat().filter(Boolean).map(b=>({{type:b.type,health:b.health,key:b.texture.key}})),cache:{S}.cache.json.get('photo_classic_{classic}')}})")
        assert actual['cache'] == expected, 'Loading must not mutate campaign JSON'
        assert actual['level']['gridLayout'] == expected['gridLayout']
        assert actual['level']['blockerLayout'] == expected['blockerLayout']
        assert actual['level']['availableGems'] == expected['availableGems']
        assert actual['moves'] == expected['maxMoves']
        assert actual['holes'] == [[cell is None for cell in row] for row in expected['gridLayout']]
        assert all(blocker['health'] in [1,2] and blocker['key'].startswith('blocker_') for blocker in actual['blockers'])
        assert page.evaluate(f"{S}.coverTiles.every(t=>!t.revealed)")
    portraits = [url.rsplit('/', 1)[1] for url in requests if '/images/beauty/' in url]
    assert portraits == [id+'.webp' for id in IDS], portraits
    assert len([url for url in requests if '/levels/level_' in url]) == 9
    assert not any('/images/map/map.webp' in url for url in requests)
    print('PASS: all twenty new boards preserve classic layouts, colors, blockers and moves; lazy assets use nine cached JSONs', flush=True)

    # A selected gem followed by a tap on a hole must not dereference a missing sprite.
    start(page, 13)
    pair = page.evaluate('''()=>{
        const b=window.game.scene.getScene('PhotoChallengeScene').board;
        for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!b.grid[r][c]) {
            for(const [r2,c2] of [[r,c+1],[r+1,c],[r,c-1],[r-1,c]])
                if(b.grid[r2]?.[c2] && !b.isCellBlockedForMovement(r2,c2)) return [[r2,c2],[r,c]];
        }
    }''')
    assert pair
    before = page.evaluate(f"{S}.run.movesLeft")
    for r,c in pair:
        point = page.evaluate('''([r,c])=>{
            const rect=window.game.canvas.getBoundingClientRect();
            return {x:rect.left+(96+c*48)*rect.width/576,y:rect.top+(502+r*48)*rect.height/1024};
        }''', [r,c])
        page.mouse.click(point['x'], point['y']); page.wait_for_timeout(90)
    assert page.evaluate(f"!{S}.board.selectedGem && !{S}.run.pending && {S}.run.movesLeft==={before}")
    print('PASS: tapping a hole after selecting a gem clears selection without spending a move or crashing', flush=True)

    # Play the untouched first classic board through real swaps and goal events.
    start(page, 10)
    for _ in range(20):
        if page.evaluate(f"{S}.run.finished"): break
        move = page.evaluate('''()=>{
            const b=window.game.scene.getScene('PhotoChallengeScene').board,moves=[];
            for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(const [r2,c2] of [[r,c+1],[r+1,c]]) {
                const a=b.grid[r]?.[c],d=b.grid[r2]?.[c2];if(!a||!d)continue;
                b.grid[r][c]=d;b.grid[r2][c2]=a;
                const groups=b.findAllMatches();b.grid[r][c]=a;b.grid[r2][c2]=d;
                const power=b.isPowerup(a)||b.isPowerup(d);
                if(groups.length||power)moves.push({move:[r,c,r2,c2],score:(power?100:0)+groups.reduce((n,g)=>n+g.length+g.filter(p=>p.value==='red').length*10,0)});
            }
            return moves.sort((a,b)=>b.score-a.score)[0]?.move;
        }''')
        assert move
        swap(page, move)
    assert page.evaluate(f"{S}.run.won && {S}.run.progress===1 && {S}.resultShown && {S}.run.objectives[0].remaining===0")
    print('PASS: classic red-gem goal wins via real swaps and reveals the entire portrait', flush=True)

    def blocker_fixture(index, kind):
        start(page, index)
        page.evaluate('''kind=>{
            const s=window.game.scene.getScene('PhotoChallengeScene'),b=s.board;
            const layout=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*2+c)%5+1));
            const blockers=Array.from({length:9},()=>Array(9).fill(0));
            blockers[4][4]=blockers[6][6]=kind==='stone'?2:1;
            const config={gridLayout:layout,blockerLayout:blockers,availableGems:['red','green','blue','purple','yellow'],
                maxMoves:kind==='stone'?4:2,objectives:[{target:'blocker',type:kind,count:2}]};
            b.loadLevel(config);b.initializeObjectives(config);b.isMoveBasedLevel=false;
            s.run=new s.run.constructor({moves:config.maxMoves,objectives:config.objectives});s.refresh();
        }''', kind)
        page.wait_for_timeout(80)

    def color_match(kind, row, col):
        # Set a match-free background with an isolated three-match next to a stone,
        # or directly across a rope. Preserve actual blocker objects/health.
        return page.evaluate('''([kind,row,col])=>{
            const b=window.game.scene.getScene('PhotoChallengeScene').board, colors=['red','green','blue','purple','yellow'];
            const put=(r,c,v)=>{const g=b.grid[r][c];g.value=v;g.sprite.setTexture('gem_'+v).setData('type',v);};
            for(let r=0;r<9;r++)for(let c=0;c<9;c++)put(r,c,colors[(r*2+c)%5]);
            if(kind==='stone') {
                put(row-1,col-1,'red');put(row-1,col,'green');put(row-1,col+1,'red');put(row-2,col,'red');
                return [row-2,col,row-1,col];
            }
            put(row,col-2,'green');put(row,col-1,'red');put(row,col,'red');put(row-1,col-2,'red');
            return [row-1,col-2,row,col-2];
        }''', [kind,row,col])

    for index, kind in [(11,'stone'), (12,'rope')]:
        blocker_fixture(index, kind)
        if kind=='rope':
            # Exercise actual regrowth before starting a controlled attempt.
            page.evaluate(f"{S}.board.blockerGrid[4][4].spread({S}.board,new Set());{S}.board.recalculateBlockerCounts()")
            assert page.evaluate(f"{S}.board.objectives.blocker_rope.remaining===3")
            blocker_fixture(index, kind)
        before = page.evaluate(f"JSON.stringify({S}.run)")
        assert page.evaluate(f"{S}.performMove({{r1:4,c1:4,r2:4,c2:5}})") is False
        assert page.evaluate(f"JSON.stringify({S}.run)") == before
        for row,col in [(4,4),(6,6)]:
            for _ in range(2 if kind=='stone' else 1):
                if page.evaluate(f"{S}.run.finished"): break
                swap(page, color_match(kind,row,col))
            if row==4 and not page.evaluate(f"{S}.run.finished"):
                assert page.evaluate(f"{S}.run.progress>0 && {S}.coverTiles.some(t=>t.revealed) && {S}.coverTiles.some(t=>!t.revealed)")
        assert page.evaluate(f"{S}.run.won && {S}.resultShown && {S}.run.objectives[0].remaining===0"), kind
        print('PASS: real '+kind+' destruction updates goals/reveal and wins; blocked endpoints spend no move', flush=True)
    assert page.evaluate(campaign) == original_campaign
    page.close()

    viewed = new_page(29)
    requests.clear()
    click(viewed, 'TitleScene', 'beauty-entry')
    open_album(viewed)
    viewed.wait_for_function("window.game.scene.getScene('PhotoAlbumScene').ready")
    assert viewed.evaluate("window.game.scene.getScene('PhotoAlbumScene').index===28")
    assert [url.rsplit('/',1)[1] for url in requests if '/images/beauty/' in url] == ['island.webp']
    assert not any('/levels/' in url or '/blockers/' in url for url in requests)
    print('PASS: viewing a collected classic portrait downloads its image without board JSON or blockers', flush=True)
    viewed.close()

    failed = new_page(10)
    failed.route('**/levels/level_1.json', lambda route: route.abort())
    click(failed, 'TitleScene', 'beauty-entry')
    failed.wait_for_function("window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready")
    click(failed, 'BaddieMapScene', 'baddie-continue')
    failed.wait_for_function(f"window.game.scene.isActive('PhotoChallengeScene') && {S}.children.getByName('beauty-load-retry')", timeout=60000)
    assert json.loads(failed.evaluate(f"localStorage.getItem('{SAVE}')"))['completed'] == 10
    failed.unroute('**/levels/level_1.json')
    click(failed, 'PhotoChallengeScene', 'beauty-load-retry')
    failed.wait_for_function(READY, timeout=60000)
    assert failed.evaluate(f"{S}.run.movesLeft===20 && {S}.run.objectives[0].remaining===15")
    assert not errors, errors
    print('PASS: failed classic JSON offers a working retry without unlocking; campaign save unchanged', flush=True)
    browser.close()
