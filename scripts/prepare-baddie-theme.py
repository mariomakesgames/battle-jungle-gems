"""Package generated fashion artwork and deterministic UI symbols for Phaser."""
import argparse
from pathlib import Path
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--background', type=Path, required=True)
p.add_argument('--pieces', type=Path, required=True)
args = p.parse_args()
root = Path(__file__).resolve().parents[1] / 'public/assets/images/baddie'
root.mkdir(parents=True, exist_ok=True)
with Image.open(args.background) as image:
    image.convert('RGB').resize((576, 1024), Image.Resampling.LANCZOS).save(root / 'studio.webp', quality=85)
with Image.open(args.pieces) as image:
    w, h = image.size
    for index, name in enumerate(['red', 'green', 'blue', 'purple', 'yellow', 'orange']):
        x, y = index % 3, index // 3
        cell = image.crop((round(x*w/3), round(y*h/2), round((x+1)*w/3), round((y+1)*h/2)))
        cell.resize((256, 256), Image.Resampling.LANCZOS).save(root / f'{name}.png', optimize=True)

def svg(name, content):
    (root / f'{name}.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="rose" x2=".7" y2="1"><stop stop-color="#f0a5bd"/><stop offset=".5" stop-color="#b34672"/><stop offset="1" stop-color="#59243f"/></linearGradient><linearGradient id="gold" x2=".7" y2="1"><stop stop-color="#fff1c8"/><stop offset=".5" stop-color="#dcb46e"/><stop offset="1" stop-color="#91623c"/></linearGradient><linearGradient id="dark" x2="1" y2="1"><stop stop-color="#492539"/><stop offset="1" stop-color="#190f1d"/></linearGradient></defs>''' + content + '</svg>', encoding='utf-8')

svg('cell', '<rect x="4" y="4" width="120" height="120" rx="18" fill="#27212e"/><path d="M23 5h82" stroke="#aa829e" stroke-opacity=".12" stroke-width="2"/>')
svg('bomb', '<rect x="50" y="12" width="28" height="14" rx="4" fill="url(#gold)"/><path d="M58 27v11h12V27" fill="url(#gold)"/><rect x="29" y="38" width="70" height="74" rx="19" fill="url(#rose)" stroke="#ffe2ab" stroke-width="3"/><path d="M40 53v40" stroke="#fff1ef" opacity=".5" stroke-width="6"/><path d="M64 91L47 73a10 10 0 0117-10 10 10 0 0117 10z" fill="url(#gold)"/><path d="M85 23l9-8m-4 18h13m-20-23V2" stroke="#ffedbf" stroke-width="4" stroke-linecap="round"/>')
svg('stripe', '<path d="M64 111L8 50Q64-9 120 50z" fill="url(#rose)" stroke="#f7d09e" stroke-width="4"/><path d="M64 108L27 34M64 108L48 22M64 108V18M64 108L80 22M64 108l37-74" stroke="#f7d09e" stroke-width="2"/><circle cx="64" cy="107" r="6" fill="url(#gold)"/><path d="M42 64h43m-9-9l10 9-10 9" stroke="#fff4d3" stroke-width="6" fill="none" stroke-linecap="round"/>')
compact='<circle cx="64" cy="64" r="49" fill="url(#gold)"/><circle cx="64" cy="64" r="41" fill="url(#rose)" stroke="#ffecc5" stroke-width="2"/><path d="M64 93L35 63a17 17 0 0129-17 17 17 0 0129 17z" fill="#ffdeea"/><path d="M28 25l5-13 5 13 13 5-13 5-5 13-5-13-13-5z" fill="#fff5d6"/>'
svg('color_bomb', compact)
svg('color_bomb_op', compact.replace('#ffdeea', '#ffffff'))
for health in [1, 2]:
    crack='<path d="M65 20l-9 30 19 13-22 22 9 23" fill="none" stroke="#120a13" stroke-width="6"/>' if health==1 else ''
    svg(f'stone_{health}', '<rect x="12" y="17" width="104" height="96" rx="20" fill="url(#dark)" stroke="#dcb46e" stroke-width="5"/><path d="M23 31h82M23 98h82" stroke="#a56880" stroke-width="3"/><rect x="47" y="57" width="34" height="31" rx="5" fill="url(#gold)"/><path d="M53 57V45a11 11 0 0122 0v12" fill="none" stroke="#f6deb0" stroke-width="5"/><circle cx="64" cy="70" r="4" fill="#472439"/>' + crack)
links=''.join(f'<ellipse cx="{25+i*20}" cy="{25+i*20}" rx="20" ry="12" transform="rotate(45 {25+i*20} {25+i*20})" fill="none" stroke="url(#gold)" stroke-width="7"/>' for i in range(5))
svg('rope', links)
for locked in [False, True]:
    fill = '#302936' if locked else '#a9577a'
    svg('node_lock' if locked else 'node_unlock', f'<circle cx="64" cy="64" r="55" fill="{fill}"/><circle cx="64" cy="64" r="60" fill="none" stroke="#c6a7b7" stroke-opacity=".25" stroke-width="1"/>')

tools={
 'hammer':'<path d="M60 55l-8 58h15l7-58" fill="url(#rose)" stroke="#e6bf89" stroke-width="3"/><rect x="25" y="24" width="78" height="37" rx="10" transform="rotate(9 64 43)" fill="url(#gold)"/><path d="M34 32l55 9" stroke="#fff4d5" stroke-width="5"/>',
 'swap':'<path d="M23 42h78L83 24M105 86H27l18 18" fill="none" stroke="url(#gold)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
 'rocket':'<path d="M63 11Q32 34 44 82h40Q94 34 63 11z" fill="url(#gold)"/><circle cx="64" cy="47" r="13" fill="url(#rose)"/><path d="M44 61L25 90l22-6M83 61l20 29-22-6" fill="url(#rose)"/><path d="M54 88l10 31 10-31" fill="#f7a9b5"/>',
 'shuffle':'<path d="M22 29h84L80 70v34l-32 10V70z" fill="url(#rose)" stroke="#e6bf89" stroke-width="4"/><circle cx="49" cy="43" r="6" fill="#fff1ce"/><circle cx="74" cy="43" r="6" fill="#fff1ce"/>',
}
for name, content in tools.items(): svg(f'booster_{name}', content)
svg('brand', '<rect width="128" height="128" rx="30" fill="#211321"/><path d="M64 14l44 50-44 50L20 64z" fill="url(#rose)" stroke="#e6bf89" stroke-width="4"/><path d="M43 87V40h21q28 0 18 23 19 25-18 24zM56 50v12h10q12-6 0-12zM56 72v5h13q10-5 0-9H56" fill="#fff1da" fill-rule="evenodd"/>')
print(f'Packaged {len(list(root.iterdir()))} fashion theme assets')
