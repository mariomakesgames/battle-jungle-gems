"""Readable fashion silhouettes for the small 9x9 and 10x10 boards."""
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'public/assets/images/baddie/pieces'
root.mkdir(parents=True, exist_ok=True)
pieces = {
    'red': '''<path d="M26 14l23 34-7 23c8 9 25 16 42 18l24 4q12 2 10 14H39q-12-1-17-14L12 66z" fill="#ff577b"/><path d="M17 72l8 40h10l-1-30" fill="#ff577b"/><path d="M42 34L28 64q8 17 32 24" fill="none" stroke="#ffbdcf" stroke-width="7"/>''',
    'green': '''<path d="M24 18l18-5q22 17 44 0l18 5-11 43 12 47q-41 16-82 0l12-47z" fill="#51df9a"/><path d="M48 27l10 73M80 27l-10 73" fill="none" stroke="#b9ffe0" stroke-width="6"/><path d="M57 43l16 13-17 14 16 15" fill="none" stroke="#237c63" stroke-width="6"/>''',
    'blue': '''<path d="M47 13h48l-9 64 22 20q10 14-6 18H53q-22-2-22-19l9-37z" fill="#66caff"/><path d="M45 13h51l-3 22H42z" fill="#ceefff"/><path d="M55 48l-7 33q-2 14 11 18" fill="none" stroke="#ceefff" stroke-width="7"/>''',
    'purple': '''<path d="M23 49l5-32h12l-1 32M89 49l-1-32h12l5 32" fill="none" stroke="#bd8bff" stroke-width="9"/><path d="M13 58l23-8h56l23 8-8 42H21z" fill="#bd8bff"/><path d="M16 54q17-17 35-1l12 33Q31 111 16 87zM112 54q-17-17-35-1L65 86q32 25 47 1z" fill="#bd8bff"/><path d="M26 60q11-7 21 1M83 61q10-8 20-1" fill="none" stroke="#ead6ff" stroke-width="6"/><path d="M57 83l7-7 7 7-7 8z" fill="#ead6ff"/>''',
    'yellow': '''<path d="M64 12l14 15-14 15-14-15z" fill="#fff1b8"/><path d="M64 40v12" fill="none" stroke="#ffd15c" stroke-width="11"/><ellipse cx="64" cy="82" rx="35" ry="32" fill="#ffd15c"/><ellipse cx="64" cy="82" rx="18" ry="17" fill="#291932"/><path d="M41 73q4-12 16-15" fill="none" stroke="#fff1b8" stroke-width="6"/>''',
    'orange': '''<path d="M16 31q48 18 96 0l-9 30-29 50H54L25 61z" fill="#ff9464"/><path d="M17 31q47 18 94 0l-5 19q-42 18-84 0z" fill="#ffd0b2"/><path d="M48 67l16 30 16-30" fill="none" stroke="#ffd0b2" stroke-width="6"/>''',
}
for name, content in pieces.items():
    (root / f'{name}.svg').write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128">'
        '<g stroke="#291932" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">'
        + content + '</g></svg>\n', encoding='utf-8')
print('Generated six simple fashion silhouettes')
