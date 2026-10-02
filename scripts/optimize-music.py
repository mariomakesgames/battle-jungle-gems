"""Generate full-length AAC-LC playback copies; keep source audio unchanged.

Requires ffmpeg and ffprobe. Run from any directory with Python 3.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/assets/sounds/maps'
OUTPUT = ROOT / 'public/assets/sounds/optimized'
FILES = [f'map_{level:02d}.m4a' for level in range(1, 10)] + ['stream.mp3']


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,profile,channels,sample_rate',
        '-of', 'json', str(path),
    ]))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    before = after = 0
    for name in FILES:
        source = SOURCE / name
        target = OUTPUT / Path(name).with_suffix('.m4a')
        # Publish each file only after duration and full decoding have passed.
        with tempfile.TemporaryDirectory(prefix='.encode-', dir=OUTPUT) as temp:
            encoded = Path(temp) / target.name
            subprocess.run([
                'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                '-i', str(source), '-map', '0:a:0', '-vn', '-c:a', 'aac',
                '-profile:a', 'aac_low', '-b:a', '80k', '-ar', '44100',
                '-ac', '2', '-map_metadata', '-1', '-movflags', '+faststart',
                str(encoded),
            ], check=True)
            original, result = probe(source), probe(encoded)
            stream = result['streams'][0]
            if (stream['codec_name'], stream['profile'], stream['channels']) != ('aac', 'LC', 2):
                raise RuntimeError(f'{name}: unexpected audio encoding')
            if abs(float(original['format']['duration']) - float(result['format']['duration'])) > 0.1:
                raise RuntimeError(f'{name}: duration changed')
            if encoded.stat().st_size >= source.stat().st_size:
                raise RuntimeError(f'{name}: no size reduction')
            subprocess.run([
                'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                '-xerror', '-i', str(encoded), '-f', 'null', '-',
            ], check=True)
            os.replace(encoded, target)
        before += source.stat().st_size
        after += target.stat().st_size
        print(f'{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes', flush=True)
    print(f'Total: {before / 1048576:.2f} -> {after / 1048576:.2f} MiB '
          f'({(1 - after / before) * 100:.1f}% smaller)', flush=True)


if __name__ == '__main__':
    main()
