"""Profile cold production loading stages. Run after npm run build + npm run preview.

Requires Playwright/Chromium. JUNGLE_GEMS_URL defaults to the preview server;
CHROMIUM_EXECUTABLE can override the installed Chromium path.
"""
import json
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 576, 'height': 1024})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(os.environ.get('JUNGLE_GEMS_URL', 'http://127.0.0.1:4173/'))
    if '/@vite/client' in response.text():
        raise RuntimeError('Profile the production preview, not the development server.')
    stages = []
    def record(name):
        rows = page.evaluate('performance.getEntriesByType("resource").map(r => ({path: new URL(r.name).pathname, bytes:r.encodedBodySize})).sort((a,b)=>b.bytes-a.bytes)')
        stages.append({'stage': name, 'cumulative_MiB': round(sum(r['bytes'] for r in rows) / 1048576, 3), 'largest_resources': rows[:5]})
    page.wait_for_function("window.game?.scene.isActive('TitleScene')")
    record('title_ready')
    page.mouse.click(288, 613)
    page.wait_for_function("window.game.scene.isActive('MapScene')", timeout=60000)
    record('map_interactive')
    page.evaluate("window.game.scene.getScene('MapScene').children.list.find(x => x.levelId === 1).button.emit('pointerdown')")
    page.wait_for_function("window.game.scene.isActive('LevelReviewPopup')")
    record('level_1_review')
    page.mouse.click(288, 750)
    page.wait_for_function("window.game.scene.isActive('GameScene') && window.game.scene.isActive('UIScene') && window.game.scene.getScene('GameScene').board?.gems.length > 0", timeout=60000)
    record('level_1_playable')
    page.wait_for_function("window.game.cache.audio.exists('map_01') && window.game.scene.getScene('GameScene').bgMusic?.isPlaying", timeout=60000)
    record('level_1_music_ready')
    assert not errors, errors
    print(json.dumps({'mode': 'production', 'fresh_browser': True, 'stages': stages}, ensure_ascii=False, indent=2))
    browser.close()
