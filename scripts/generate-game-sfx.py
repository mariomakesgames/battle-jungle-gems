"""Original deterministic game sounds; stdlib only, no third-party recordings."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
ROOT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/gameplay'
ROOT.mkdir(parents=True, exist_ok=True)


def sound(name, duration, notes=(), noise=0, sweep=None, seed=1):
    rng = random.Random(seed)
    samples = []
    low = 0
    phase = 0
    for i in range(round(duration * RATE)):
        t = i / RATE
        value = 0
        for start, frequency, length, gain in notes:
            age = t - start
            if 0 <= age < length:
                env = min(1, age / .004) * math.exp(-5 * age / length) * min(1, (length-age)/.018)
                angle = 2 * math.pi * frequency * age
                value += gain * env * (math.sin(angle) + .23 * math.sin(2*angle) + .07 * math.sin(3*angle))
        white = rng.uniform(-1, 1)
        low += .15 * (white - low)
        if noise:
            env = min(1, t/.006) * math.exp(-6*t/duration) * min(1,(duration-t)/.025)
            value += noise * env * (.65 * low + .35 * white)
        if sweep:
            start, end, gain = sweep
            freq = start * (end/start) ** (t/duration)
            phase += 2 * math.pi * freq / RATE
            value += gain * math.sin(phase) * min(1,t/.008) * math.exp(-5*t/duration) * min(1,(duration-t)/.025)
        samples.append(value)
    peak = max(max(map(abs, samples)), .001)
    # Headroom plus a final fade avoids clipping/clicks, even for layered voices.
    gain = .78 / peak
    with wave.open(str(ROOT / f'{name}.wav'), 'wb') as out:
        out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(struct.pack('<h', round(max(-1,min(1,s*gain))*32767)) for s in samples))


for i, base in enumerate([440, 494, 523], 1):
    sound(f'match_{i}', .23, [(0,base,.21,.7),(.025,base*1.5,.18,.3)], noise=.12, seed=i)
for i, base in enumerate([330, 370, 392], 1):
    sound(f'cascade_{i}', .36, [(j*.045,base*ratio,.19,.5) for j,ratio in enumerate([1,1.25,1.5,2])], noise=.04, seed=i)
for i in [1, 2]:
    sound(f'swap_{i}', .10, noise=.45, sweep=(420+i*40,190,.4),seed=i+10)
    sound(f'bomb_{i}', .58, noise=1, sweep=(130-i*10,36,.95),seed=i+20)
    sound(f'stripe_{i}', .30, noise=.35, sweep=(320+i*70,1400,.7),seed=i+30)
sound('invalid', .20, [(0,300,.12,.5),(.065,210,.13,.45)])
sound('special', .46, [(j*.06,440*r,.25,.5) for j,r in enumerate([1,1.25,1.5,2])])
sound('stone_hit', .16, noise=.9, sweep=(220,75,.8),seed=41)
sound('stone_break', .28, noise=1, notes=[(0,105,.24,.5),(.04,180,.12,.2)],seed=42)
sound('rope', .19, noise=.45, sweep=(900,240,.6),seed=43)
sound('hammer', .28, noise=.75, sweep=(150,48,1),seed=44)
sound('rocket', .50, noise=.8, sweep=(180,1800,.7),seed=45)
sound('shuffle', .58, [(j*.055,260*r,.18,.5) for j,r in enumerate([1,1.5,1.25,2,1.5,2.5,2])],noise=.2,seed=46)
sound('color', .72, [(j*.055,392*r,.29,.42) for j,r in enumerate([1,1.25,1.5,2,2.5,2,1.5,2])],noise=.04)
sound('ui', .08, [(0,660,.07,.6)],noise=.08)
sound('low_moves', .33, [(0,660,.16,.5),(.17,660,.15,.4)])
sound('win', 1.05, [(j*.10,330*r,.44,.5) for j,r in enumerate([1,1.25,1.5,2,2.5,3])])
sound('lose', .72, [(j*.15,f,.30,.4) for j,f in enumerate([392,330,294])])
print(f'Generated {len(list(ROOT.glob("*.wav")))} original WAV sounds')
