"""Verify deferred popup assets against a running Vite or production preview server.

Requires Python + Playwright and Chromium. Supports JUNGLE_GEMS_URL and
CHROMIUM_EXECUTABLE, like loading-smoke.py.
"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'],
    )
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors, failures, requests, pending = [], [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    page.route('**/assets/images/ui/shop/background.png', lambda route: pending.append(route))
    page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:5173/'))
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.mouse.click(288, 613)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    # Entry to the map must not wait for unused popup or gameplay assets.
    deferred = ['map1_background', 'shop_background', 'spin_background', 'setting_ui', 'friend_ui_bg', 'level_review_ui']
    assert page.evaluate('(keys) => keys.every(key => !window.game.textures.exists(key))', deferred)

    def launch(key):
        page.evaluate('(key) => window.game.scene.start(key)', key)

    def missing_textures(key):
        return page.evaluate('''key => {
            const missing = [];
            function walk(items) {
                for (const item of items) {
                    if (item.texture?.key === '__MISSING') missing.push(item.name || item.type);
                    if (Array.isArray(item.list)) walk(item.list);
                }
            }
            walk(window.game.scene.getScene(key).children.list);
            return missing;
        }''', key)

    launch('ShopPopup')
    page.wait_for_function("window.game.scene.getScene('ShopPopup').load.isLoading()")
    page.wait_for_timeout(300)
    assert len(pending) == 1
    assert page.evaluate("window.game.scene.isPaused('MapScene') && !window.game.scene.isActive('ShopPopup')")
    pending[0].continue_()
    page.wait_for_function("window.game.scene.isActive('ShopPopup') && window.game.scene.getScene('ShopPopup').itemsLayer?.list.length > 0", timeout=60000)
    assert not missing_textures('ShopPopup')
    page.evaluate("window.game.scene.getScene('ShopPopup').close()")
    page.wait_for_function("window.game.scene.isActive('MapScene')")
    request_count = len(requests)
    launch('ShopPopup')
    page.wait_for_function("window.game.scene.isActive('ShopPopup') && window.game.scene.getScene('ShopPopup').itemsLayer?.list.length > 0")
    assert len(requests) == request_count, requests[request_count:]
    page.evaluate("window.game.scene.getScene('ShopPopup').close()")

    for key, ready in [
        ('SettingsPopup', "window.game.scene.getScene('SettingsPopup').children.list.some(x => x.type === 'Text' && x.text === 'BAPLUOC')"),
        ('FriendPopup', "window.game.scene.getScene('FriendPopup').friends.length > 0"),
        ('SpinPopup', "window.game.scene.getScene('SpinPopup').items.length === 8"),
    ]:
        launch(key)
        page.wait_for_function(f"window.game.scene.isActive('{key}') && ({ready})", timeout=60000)
        assert not missing_textures(key), (key, missing_textures(key))
        if key == 'SpinPopup':
            page.evaluate("window.game.scene.getScene('SpinPopup').spinButton.emit('pointerdown')")
            page.wait_for_function("window.game.scene.getScene('SpinPopup').isSpinning")
            page.wait_for_function("!window.game.scene.getScene('SpinPopup').isSpinning", timeout=30000)
        page.evaluate('(key) => window.game.scene.getScene(key).closePopup()', key)
        page.wait_for_function("window.game.scene.isActive('MapScene')")
    assert not errors, errors
    assert not failures, failures
    print('PASS: map skips unused assets; pending shop pauses map; cached shop reopen makes no requests; settings, friends and spin render with complete textures; spin completes')
    browser.close()
