"""Generate optimized WebP backgrounds while preserving the original PNGs (requires Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    'assets/images/map/map1-background.png',
    'assets/images/map/map.png',
]

if __name__ == '__main__':
    before = after = 0
    for name in FILES:
        source = ROOT / 'public' / name
        target = source.with_suffix('.webp')
        with Image.open(source) as image:
            if image.width > 1152:
                # Keep about 2x display resolution. MapScene retains the
                # original logical geometry independently of image pixels.
                image.thumbnail((1152, 2049), Image.Resampling.LANCZOS)
            image.save(target, 'WEBP', lossless=True, method=4, exact=True)
            # Encoding preserves every pixel of the output image, including alpha.
            with Image.open(target) as result:
                assert image.size == result.size
                assert image.convert('RGBA').tobytes() == result.convert('RGBA').tobytes()
        before += source.stat().st_size
        after += target.stat().st_size
        print(f'{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes', flush=True)
    print(f'Total: {before / 1048576:.2f} -> {after / 1048576:.2f} MiB', flush=True)
