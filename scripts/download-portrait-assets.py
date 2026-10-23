"""Download explicitly selected Pixabay assets and record their provenance."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('selection', type=Path)
parser.add_argument('--folder', default='glamour-04')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'public/assets/images/beauty/downloads'
folder = root / args.folder
folder.mkdir(parents=True, exist_ok=True)
manifest = folder / 'sources.json'
assets = json.loads(manifest.read_text(encoding='utf-8'))['assets'] if manifest.exists() else []
known = {a['source'] for a in assets}
selection = json.loads(args.selection.read_text(encoding='utf-8'))
selected_assets = selection['assets'] if isinstance(selection, dict) else selection
failed = []
for selected in selected_assets:
    if selected['source'] in known:
        continue
    url = selected['download_url']
    ident = selected.get('id') or selected['file'].split('-')[-1].split('_')[0]
    if not url.startswith('https://cdn.pixabay.com/photo/'):
        raise ValueError('Expected an explicitly selected Pixabay CDN image')
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://pixabay.com/'})
        data = urllib.request.urlopen(request, timeout=30).read()
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
        filename = url.rsplit('/', 1)[-1]
        (folder / filename).write_bytes(data)
        assets.append({
            'file': filename, 'title': selected['source'].rstrip('/').rsplit('/', 1)[-1],
            'creator': None, 'source': selected['source'], 'download_url': url,
            'ai_generated': selected['ai_generated'], 'width': width, 'height': height,
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        })
        known.add(selected['source'])
        print(f"Downloaded {ident}: {width}x{height}", flush=True)
        manifest.write_text(json.dumps({
            'license': 'Pixabay Content License', 'license_url': 'https://pixabay.com/service/license-summary/',
            'assets': assets,
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except Exception as error:
        failed.append(ident)
        print(f"FAILED {ident}: {error}", flush=True)
if failed:
    raise SystemExit(f'Could not download {len(failed)} selected assets')
