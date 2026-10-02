"""Check nonblocking optional music and cached/theme-specific level entry.

Start Vite or production preview. Requires Playwright + Chromium; supports
JUNGLE_GEMS_URL and CHROMIUM_EXECUTABLE.
"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures, requests, pending = [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    page.route('**/map_01.m4a', lambda route: pending.append(route))
    page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:5173/'))
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288, 768)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    page.evaluate("window.game.scene.getScene('MapScene').children.list.find(x => x.levelId === 1).button.emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('LevelReviewPopup')")
    page.mouse.click(288, 750)
    ready = "window.game.scene.isActive('GameScene') && window.game.scene.isActive('UIScene') && window.game.scene.getScene('GameScene').board?.gems.length > 0"
    page.wait_for_function(ready, timeout=60000)
    # Gameplay must already be usable while the optional music request is held.
    if not pending:
        page.wait_for_event('request', predicate=lambda request: '/map_01.m4a' in request.url, timeout=10000)
    page.wait_for_timeout(100)
    assert len(pending) == 1
    assert '/assets/sounds/optimized/map_01.m4a' in pending[0].request.url
    assert page.evaluate("window.game.scene.isActive('GameScene') && !window.game.cache.audio.exists('map_01')")
    assert page.evaluate("['playground2_background','pause_ui','victory_background','lose_background'].every(key => !window.game.textures.exists(key))")
    pending[0].continue_()
    page.wait_for_function("window.game.cache.audio.exists('map_01') && window.game.scene.getScene('GameScene').bgMusic?.isPlaying", timeout=60000)
    # Full-length compressed music must also survive the loop boundary.
    duration = page.evaluate("window.game.cache.audio.get('map_01').duration")
    assert abs(duration - 63.667) < 0.1, duration
    page.evaluate("window.game.scene.getScene('GameScene').bgMusic.seek = window.game.cache.audio.get('map_01').duration - 0.2")
    page.wait_for_function("window.game.scene.getScene('GameScene').bgMusic?.isPlaying && window.game.scene.getScene('GameScene').bgMusic.seek < 2", timeout=5000)
    first_count = len(requests)
    page.evaluate("""() => {
        window.game.scene.stop('UIScene'); window.game.scene.stop('GameScene');
        window.game.scene.start('LevelLoaderScene', {levelId: 1});
    }""")
    page.wait_for_function(ready, timeout=60000)
    page.wait_for_timeout(400)
    assert not any('/map_01.m4a' in url or '/assets/images/vfx/' in url for url in requests[first_count:])
    page.evaluate("""() => {
        window.game.scene.stop('UIScene'); window.game.scene.stop('GameScene');
        window.game.scene.start('LevelLoaderScene', {levelId: 5});
    }""")
    page.wait_for_function(ready, timeout=60000)
    assert page.evaluate("window.game.textures.exists('playground2_background')")
    page.wait_for_function("window.game.cache.audio.exists('map_05') && window.game.scene.getScene('GameScene').bgMusic?.isPlaying", timeout=60000)
    assert page.evaluate("window.game.cache.audio.getKeys().filter(key => /^map_\\d+$/.test(key))") == ['map_05']
    assert not errors, errors
    assert not failures, failures
    print('PASS: playable board precedes compressed music; full-duration music loops; first level skips theme 2/pause/results; cached replay makes no music/VFX requests; level 5 loads theme 2 and evicts old music')
    browser.close()
