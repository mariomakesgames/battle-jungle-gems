"""Exercise map-area batches, cancellation and first-use result panels.

Requires a running server plus Playwright/Chromium. Supports JUNGLE_GEMS_URL and
CHROMIUM_EXECUTABLE.
"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append((response.status, response.url)) if response.status >= 400 else None)
    page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/'))
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288, 768)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    assert page.evaluate("!window.game.textures.exists('map_part2') && !window.game.textures.exists('vfx_steam_1_1_bot_nuoc') && !window.game.cache.audio.exists('background')")

    def missing(key):
        return page.evaluate('''key => {
            const result=[];
            function walk(items) { for (const item of items) {
                if (item.texture?.key === '__MISSING') result.push(item.type);
                if (Array.isArray(item.list)) walk(item.list);
            }}
            walk(window.game.scene.getScene(key).children.list); return result;
        }''', key)

    # Start a decoration batch, then select a level before it completes.
    page.evaluate("window.game.scene.getScene('MapScene').effectsReadyAt = 0")
    page.wait_for_function("window.game.scene.getScene('MapScene').streamingGroup === 'mapEffects1'")
    page.evaluate("window.game.scene.getScene('MapScene').children.list.find(x => x.levelId === 1).button.emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('LevelReviewPopup')", timeout=10000)
    page.wait_for_function("window.game.scene.scenes.every(s => !s.scene.key.startsWith('AssetStream:'))")
    assert page.evaluate("window.game.scene.isPaused('MapScene')")
    page.evaluate("window.game.scene.getScene('LevelReviewPopup').closePopup()")
    page.wait_for_function("window.game.scene.getScene('MapScene').readyEffects.has('map_part1') && window.game.scene.getScene('MapScene').mapMusicStarted", timeout=60000)
    assert not missing('MapScene')
    assert page.evaluate("!window.game.textures.exists('map_part2')")
    # Scroll into the upper section: its background and effects arrive on demand.
    page.evaluate("window.game.scene.getScene('MapScene').cameras.main.scrollY = 0")
    page.wait_for_function("window.game.textures.exists('map_part2') && window.game.scene.getScene('MapScene').readyEffects.has('map_part2')", timeout=60000)
    assert not missing('MapScene')
    assert page.evaluate("window.game.scene.getScene('MapScene').children.list.find(x => x.levelId === 1).y") == 1990

    ready = "window.game.scene.isActive('GameScene') && window.game.scene.isActive('UIScene') && window.game.scene.getScene('GameScene').board?.gems.length > 0"
    def level():
        page.evaluate("window.game.scene.stop('MapScene'); window.game.scene.start('LevelLoaderScene', {levelId:1})")
        page.wait_for_function(ready, timeout=60000)

    level()
    page.evaluate("window.game.scene.start('PausePopup', {levelId:1})")
    page.wait_for_function("window.game.scene.isActive('PausePopup')")
    assert not missing('PausePopup')
    page.evaluate("window.game.scene.getScene('PausePopup').closePopup()")
    page.wait_for_function(ready)
    for popup in ['WinPopup', 'LosePopup']:
        if popup == 'LosePopup': level()
        page.evaluate('(key) => window.game.scene.start(key, {levelId:1, stars:1})', popup)
        page.wait_for_function(f"window.game.scene.isActive('{popup}')", timeout=60000)
        assert not missing(popup), (popup, missing(popup))
        page.evaluate('(key) => window.game.scene.getScene(key).goToMenu()', popup)
        page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    assert not errors, errors
    assert not failures, failures
    print('PASS: map starts without decoration/audio; level selection cancels independent batch; resume restores effects; upper map loads on scroll with fixed coordinates; pause/win/lose panels load without missing textures')
    browser.close()
