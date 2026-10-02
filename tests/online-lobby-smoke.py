"""Check mobile/translated lobby, map fullscreen entry and overlay cleanup.

Requires Playwright/Chromium and production preview. Signaling/gameplay are
covered separately by webrtc-smoke.py using a real peer connection.
"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/'))
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    page.evaluate("window.game.scene.getScene('TitleScene').children.getByName('online-duel-entry').emit('pointerdown')")
    page.wait_for_selector('.jungle-online-lobby')
    for code, label in [('zh-CN', '双人联机'), ('en', 'Play with a friend'), ('vi', 'Đấu với bạn')]:
        page.select_option('.jungle-online-lobby select', code)
        assert page.inner_text('.jungle-online-lobby h1') == label
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.click('[data-action=back]')
    page.wait_for_function("window.game.scene.isActive('TitleScene')")
    point = page.evaluate('''() => {
        const rect = window.game.canvas.getBoundingClientRect();
        return {x:rect.left + rect.width/2, y:rect.top + rect.height*.75};
    }''')
    page.mouse.click(point['x'], point['y'])
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    page.wait_for_function("!!document.fullscreenElement")
    page.evaluate("window.game.scene.getScene('MapScene').children.getByName('online-duel-entry').emit('pointerdown')")
    page.wait_for_selector('.jungle-online-lobby')
    # Playwright checks real hit-testing; fullscreen must not cover these controls.
    page.click('[data-action=guest]')
    page.fill('#webrtc-input', 'invalid')
    page.click('[data-action=connect]')
    page.wait_for_function("window.game.scene.getScene('OnlineLobbyScene').statusKey === 'linkInvalidCode'")
    page.evaluate("document.exitFullscreen()")
    page.wait_for_function("!document.fullscreenElement && document.querySelector('.jungle-online-lobby')?.parentElement === document.body")
    page.select_option('.jungle-online-lobby select', 'zh-CN')
    page.click('[data-action=guest]')
    page.screenshot(path='/tmp/jungle-online-mobile-lobby.png')
    page.click('[data-action=back]')
    page.wait_for_function("window.game.scene.isActive('MapScene')")
    assert page.locator('.jungle-online-lobby').count() == 0
    assert not errors, errors
    print('PASS: mobile lobby, three languages, title/map return, fullscreen hit-testing and exit, invalid-code recovery and DOM cleanup')
    browser.close()
