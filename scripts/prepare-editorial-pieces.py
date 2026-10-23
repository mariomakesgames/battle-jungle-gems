from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = root / 'reference/baddie-theme/pieces-editorial-source.png'
out = root / 'public/assets/images/baddie/pieces-editorial'
out.mkdir(parents=True, exist_ok=True)
with Image.open(source) as image:
    w, h = image.size
    for i, name in enumerate(['red', 'green', 'blue', 'purple', 'yellow', 'orange']):
        x, y = i % 3, i // 3
        cell = image.crop((round(x*w/3), round(y*h/2), round((x+1)*w/3), round((y+1)*h/2)))
        cell.resize((256, 256), Image.Resampling.LANCZOS).save(out / f'{name}.png', optimize=True)
print('Packaged six transparent editorial fashion pieces')
