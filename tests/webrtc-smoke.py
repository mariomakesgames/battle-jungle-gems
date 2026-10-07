"""Real WebRTC two-player match using separate browser contexts.

Requires Playwright/Chromium and production preview. If Chromium restricts UDP,
JUNGLE_GEMS_TEST_ICE can supply a JSON array of test TURN servers. This configures
native RTCPeerConnection for a relay; it does not mock the data channel.
"""
import json
import os
from playwright.sync_api import sync_playwright

URL=os.environ.get('JUNGLE_GEMS_URL','http://127.0.0.1:4173/')
SCENE="window.game.scene.getScene('OnlineDuelScene')"
READY=f"window.game.scene.isActive('OnlineDuelScene') && {SCENE}.connectionReady && !{SCENE}.board.boardBusy && !{SCENE}.duel.pending"
SNAPSHOT=f"JSON.stringify({{duel:{SCENE}.duel,grid:{SCENE}.board.grid.map(r=>r.map(g=>g?.value))}})"

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,
        args=['--no-sandbox','--disable-dev-shm-usage'])
    host,guest=[browser.new_page(viewport={'width':576,'height':1024}) for _ in range(2)]
    errors,failures=[],[]
    try:
        for page in [host,guest]:
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('response',lambda response:failures.append((response.status,response.url)) if response.status>=400 else None)
            page.add_init_script("localStorage.setItem('jungle-gems-language','zh-CN')")
            if os.environ.get('JUNGLE_GEMS_TEST_ICE'):
                servers=json.loads(os.environ['JUNGLE_GEMS_TEST_ICE'])
                page.add_init_script('''const NativeRTC=window.RTCPeerConnection;
                    window.RTCPeerConnection=class extends NativeRTC {
                        constructor(config) {super({...config,iceServers:ICE_SERVERS,iceTransportPolicy:'relay'})}
                    };'''.replace('ICE_SERVERS',json.dumps(servers)))
            page.goto(URL)
            page.wait_for_function("window.game?.scene.isActive('TitleScene')")
            page.mouse.click(288,768)
            page.wait_for_selector('[data-action=host]')
        host.click('[data-action=host]')
        host.wait_for_function("document.querySelector('#webrtc-output').value.length>20",timeout=30000)
        invite=host.input_value('#webrtc-output')
        # Invalid signaling is recoverable without resetting the whole game.
        guest.click('[data-action=guest]')
        guest.fill('#webrtc-input','invalid')
        guest.click('[data-action=connect]')
        guest.wait_for_function("window.game.scene.getScene('OnlineLobbyScene').statusKey==='linkInvalidCode'")
        guest.fill('#webrtc-input',invite)
        guest.click('[data-action=connect]')
        guest.wait_for_function("document.querySelector('#webrtc-output').value.length>20",timeout=30000)
        answer=guest.input_value('#webrtc-output')
        host.fill('#webrtc-input',answer)
        host.click('[data-action=connect]')
        for page in [host,guest]:page.wait_for_function(READY,timeout=45000)
        print('Connected: native WebRTC data channel established between two browser contexts',flush=True)

        def synced():
            host.wait_for_function(READY,timeout=60000)
            revision=host.evaluate(f"{SCENE}.revision")
            guest.wait_for_function(f"{READY} && {SCENE}.revision==={revision}",timeout=60000)
            assert host.evaluate(SNAPSHOT)==guest.evaluate(SNAPSHOT),'Board or scores diverged'
            assert not errors,errors

        def fixture(special=False):
            host.evaluate('''special => {
                const s=window.game.scene.getScene('OnlineDuelScene');
                const layout=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*2+c)%6+1));
                if(special){layout[0].splice(0,4,1,1,2,1);layout[1][2]=1;}
                else{layout[0].splice(0,3,1,2,1);layout[1][1]=1;}
                s.board.loadLevel({gridLayout:layout,availableGems:['red','green','blue','purple','yellow','orange']});s.publish();
            }''',special)
            synced()

        def swap(page,move,distance=1,hold_ms=0):
            previous=host.evaluate(f"{SCENE}.revision")
            r1,c1,r2,c2=move
            page.mouse.move(45+c1*54+27,360+r1*54+27)
            page.mouse.down()
            if hold_ms:page.wait_for_timeout(hold_ms)
            page.mouse.move(45+c1*54+27+(c2-c1)*54*distance,360+r1*54+27+(r2-r1)*54*distance,steps=3)
            page.mouse.up()
            host.wait_for_function(f"{SCENE}.revision>{previous}",timeout=10000)
            synced()

        synced()
        assert host.evaluate(f"{SCENE}.peer.channel.readyState")=='open'
        assert host.evaluate(f"{SCENE}.canPlayerAct()") and not guest.evaluate(f"{SCENE}.canPlayerAct()")
        assert guest.evaluate(f"{SCENE}.boardDimmer.visible")
        host.screenshot(path='/tmp/jungle-online-host.png')
        host.evaluate(f"{SCENE}.time.timeScale=5;{SCENE}.tweens.timeScale=5")
        fixture()
        before=host.evaluate(SNAPSHOT)
        swap(host,[8,7,8,8])
        assert host.evaluate(SNAPSHOT)==before,'Invalid swap spent an opportunity'
        fixture(True)
        swap(host,[0,2,1,2],distance=0.4)
        assert host.evaluate(f"{SCENE}.duel.swapsLeft") == 2
        fixture();swap(host,[0,1,1,1],hold_ms=700)
        fixture();swap(host,[0,1,1,1],distance=2.8)
        assert host.evaluate(f"{SCENE}.duel.actor")=='ai'
        assert guest.evaluate(f"{SCENE}.canPlayerAct()") and host.evaluate(f"{SCENE}.boardDimmer.visible")
        fixture(True)
        swap(guest,[0,2,1,2],distance=0.4)
        assert host.evaluate(f"{SCENE}.duel.swapsLeft") == 2
        assert host.evaluate(f"{SCENE}.duel.scores.ai")>0

        # Shared pause and resume initiated by the guest.
        guest.mouse.click(509,58)
        for page in [host,guest]:page.wait_for_function(f"{SCENE}.paused")
        before=host.evaluate(SNAPSHOT)
        host.wait_for_timeout(500)
        assert host.evaluate(SNAPSHOT)==before
        guest.mouse.click(288,510)
        for page in [host,guest]:page.wait_for_function(f"!{SCENE}.paused")
        synced()
        before=host.evaluate(SNAPSHOT)
        guest.evaluate(f"{SCENE}.peer.send({{type:'move',matchId:{SCENE}.matchId,revision:{SCENE}.revision-1,move:{{r1:0,c1:0,r2:0,c2:1}}}})")
        host.wait_for_timeout(150)
        synced()
        assert host.evaluate(SNAPSHOT)==before,'Stale move was accepted'

        def next_move(page):
            return page.evaluate('''() => {
                const b=window.game.scene.getScene('OnlineDuelScene').board,ordinary=[],special=[];
                for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(const[r2,c2]of[[r,c+1],[r+1,c]]){
                    const a=b.grid[r]?.[c],d=b.grid[r2]?.[c2];if(!a||!d)continue;
                    b.grid[r][c]=d;b.grid[r2][c2]=a;const groups=b.findAllMatches();b.grid[r][c]=a;b.grid[r2][c2]=d;
                    if(groups.length||b.isPowerup(a)||b.isPowerup(d))(groups.some(g=>g.length>=4)?special:ordinary).push([r,c,r2,c2]);
                }return ordinary[0]||special[0];
            }''')
        for _ in range(110):
            synced()
            if host.evaluate(f"{SCENE}.duel.finished"):break
            page=host if host.evaluate(f"{SCENE}.duel.actor")=='player' else guest
            move=next_move(page)
            assert move,'No playable move'
            swap(page,move)
        assert host.evaluate(f"{SCENE}.duel.finished && {SCENE}.duel.round===10 && {SCENE}.resultShown")
        assert guest.evaluate(f"{SCENE}.resultShown")
        guest.mouse.click(288,605)
        host.wait_for_timeout(200)
        assert host.evaluate(f"{SCENE}.duel.finished"),'Rematch must require both players'
        host.mouse.click(288,605)
        host.wait_for_function(f"!{SCENE}.duel.finished")
        synced()
        assert host.evaluate(f"{SCENE}.duel.round===1 && {SCENE}.duel.scores.player===0 && {SCENE}.duel.scores.ai===0")
        guest.evaluate(f"{SCENE}.peer.close()")
        host.wait_for_function(f"!{SCENE}.connectionReady",timeout=20000)
        assert not host.evaluate(f"{SCENE}.canPlayerAct()")
        assert host.evaluate(f"{SCENE}.boardDimmer.visible")
        host.mouse.click(67,58)
        host.wait_for_selector('[data-action=host]')
        assert host.evaluate("window.game.events.listenerCount('addScore')") == 0
        assert not errors,errors
        assert not failures,failures
        print('PASS: real WebRTC link, short/slow/overshot drags, shared board, invalid/bonus swaps for both players, guest turn, pause/resume, stale-request rejection, 10 rounds, mutual rematch and disconnect lock')
    except Exception:
        for page in [host,guest]:
            print(json.dumps(page.evaluate('''() => {
                const s=window.game?.scene.getScene('OnlineDuelScene');
                return {revision:s?.revision,ready:s?.connectionReady,busy:s?.board?.boardBusy,actor:s?.duel?.actor,
                    round:s?.duel?.round,swaps:s?.duel?.swapsLeft,pending:s?.duel?.pending,connection:s?.peer?.pc.connectionState,
                    boardComplete:s?.board?.grid.every(r=>r.every(g=>g?.value)),scores:s?.duel?.scores};
            }''')))
        raise
    finally:
        if errors:print(json.dumps({'page_errors':errors}))
        browser.close()
