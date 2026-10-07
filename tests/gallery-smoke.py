"""Collected pictures only: no legacy level cards, goals or challenge controls."""
import json
from playwright.sync_api import sync_playwright

URL='http://127.0.0.1:4173/'
A="window.game.scene.getScene('PhotoAlbumScene')"
SAVE='jungle-gems-photo-collection-v1'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    errors=[]
    def click(page,scene,name):
        point=page.evaluate('''([scene,name])=>{const b=window.game.scene.getScene(scene).children.getByName(name).getBounds(),r=window.game.canvas.getBoundingClientRect();return {x:r.left+b.centerX*r.width/576,y:r.top+b.centerY*r.height/1024}}''',[scene,name])
        page.mouse.click(point['x'],point['y']);page.wait_for_timeout(80)
    for saved,lang in [(0,'en'),(1,'en'),(10,'zh-CN'),(30,'vi')]:
        page=browser.new_page(viewport={'width':390,'height':844})
        requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:requests.append(request.url))
        page.add_init_script(f"localStorage.setItem('{SAVE}',JSON.stringify({{completed:{saved}}}));localStorage.setItem('jungle-gems-language','{lang}')")
        page.goto(URL);page.wait_for_function("window.game?.scene.isActive('TitleScene')")
        click(page,'TitleScene','beauty-entry')
        page.wait_for_function("window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready")
        assert not any('/images/beauty/' in url for url in requests)
        click(page,'BaddieMapScene','baddie-gallery')
        page.wait_for_function(f"window.game.scene.isActive('PhotoAlbumScene') && {A}.ready")
        assert page.evaluate(f"!{A}.children.list.some(x=>x.name?.startsWith('beauty-photo-'))")
        assert page.evaluate(f"!{A}.children.list.some(x=>x.text?.includes('Goal:')||x.text?.includes('valid swaps')||x.text?.includes('Start revealing'))")
        pictures=lambda:[url for url in requests if '/images/beauty/' in url]
        if saved:
            assert len(pictures())==1
            assert page.evaluate(f"{A}.index==={saved-1} && !!{A}.children.getByName('beauty-gallery-photo')")
            assert page.evaluate(f"!{A}.nextPage.input.enabled")
            if saved>1:
                click(page,'PhotoAlbumScene','beauty-page-previous')
                page.wait_for_function(f"{A}.ready && {A}.index==={saved-2}")
                assert len(pictures())==2
                click(page,'PhotoAlbumScene','beauty-page-next')
                page.wait_for_function(f"{A}.ready && {A}.index==={saved-1}")
                assert len(pictures())==2, 'Viewed images are cached'
            page.screenshot(path=f'/tmp/baddie-gallery-{saved}.png')
        else:
            assert not pictures()
            assert page.evaluate(f"!!{A}.children.getByName('beauty-gallery-levels') && !{A}.children.getByName('beauty-gallery-photo')")
        assert json.loads(page.evaluate(f"localStorage.getItem('{SAVE}')"))['completed']==saved
        click(page,'PhotoAlbumScene','beauty-album-back')
        page.wait_for_function("window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready")
        assert not any('/levels/' in url for url in requests)
        page.close()
    failed=browser.new_page(viewport={'width':390,'height':844})
    failed.on('pageerror',lambda error:errors.append(str(error)))
    failed.add_init_script(f"localStorage.setItem('{SAVE}',JSON.stringify({{completed:1}}))")
    failed.route('**/beauty/garden.webp',lambda route:route.abort())
    failed.goto(URL);failed.wait_for_function("window.game?.scene.isActive('TitleScene')")
    click(failed,'TitleScene','beauty-entry')
    failed.wait_for_function("window.game.scene.isActive('BaddieMapScene') && window.game.scene.getScene('BaddieMapScene').ready")
    click(failed,'BaddieMapScene','baddie-gallery')
    failed.wait_for_function(f"window.game.scene.isActive('PhotoAlbumScene') && {A}.children.getByName('beauty-gallery-retry')")
    failed.unroute('**/beauty/garden.webp')
    click(failed,'PhotoAlbumScene','beauty-gallery-retry')
    failed.wait_for_function(f"{A}.ready && !!{A}.children.getByName('beauty-gallery-photo')")
    assert not errors,errors
    print('PASS: no legacy selection UI, collected-only viewer, 0/1/10/30 saves, three languages, one-image lazy loading, caching, map return and image retry')
    browser.close()
