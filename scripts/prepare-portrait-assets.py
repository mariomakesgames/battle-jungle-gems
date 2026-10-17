"""Build proportion-preserving runtime portraits from the downloaded sources (Pillow)."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/images/beauty'
OUTPUT = ROOT / 'portraits'
OUTPUT.mkdir(exist_ok=True)
assets = []
for folder in ['glamour', 'glamour-02']:
    source = ROOT / 'downloads' / folder
    for entry in json.loads((source / 'sources.json').read_text(encoding='utf-8'))['assets']:
        ident = entry['file'].split('-')[-1].split('_')[0]
        with Image.open(source / entry['file']) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image = ImageOps.pad(image, (640, 800), color='#101c30', method=Image.Resampling.LANCZOS)
            image.save(OUTPUT / f'{ident}.webp', quality=82, method=6)
        assets.append({**entry, 'runtime_file': f'{ident}.webp'})
(OUTPUT / 'sources.json').write_text(json.dumps({
    'license': 'Pixabay Content License',
    'license_url': 'https://pixabay.com/service/license-summary/',
    'assets': assets,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
