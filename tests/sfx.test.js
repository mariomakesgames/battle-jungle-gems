import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { GAME_SFX_PATHS } from '../src/audio/SfxPalette.js';

const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
const { default: audio } = await import('../src/managers/AudioManager.js');
const { playGameSfx } = await import('../src/managers/GameSfx.js');

function fixture() {
    const calls = [], voices = [], game = { events: new EventEmitter() };
    const scene = { game, cache: { audio: { exists: () => true } }, sound: {
        getAllPlaying: () => voices.filter(v => !v.stopped),
        play(key, config) {
            calls.push({ key, ...config });
            voices.push({ key, volume: config.volume, stop() { this.stopped = true; }, setVolume(v) { this.volume = v; } });
            return true;
        },
    } };
    audio.setGame(game); audio.setSoundVolume(.5);
    return { scene, calls, voices };
}

test('short WAV assets decode consistently, are distinct and never clip', () => {
    const hashes = new Set();
    for (const { path } of GAME_SFX_PATHS) {
        const b = readFileSync(new URL(`../public/${path}`, import.meta.url));
        assert.equal(b.toString('ascii', 0, 4), 'RIFF');
        assert.equal(b.toString('ascii', 8, 12), 'WAVE');
        assert.equal(b.readUInt16LE(22), 1); assert.equal(b.readUInt32LE(24), 22050);
        assert.equal(b.readUInt16LE(34), 16);
        let peak = 0, energy = 0;
        for (let i = 44; i < b.length; i += 2) { const v = b.readInt16LE(i); peak = Math.max(peak, Math.abs(v)); energy += v * v; }
        assert.ok(peak > 1000 && peak < 32767); assert.ok(energy > 0);
        assert.ok((b.length - 44) / 44100 <= 1.1);
        hashes.add(createHash('sha256').update(b).digest('hex'));
    }
    assert.equal(hashes.size, 25);
});

test('match variants rotate; cascades rise in pitch with a bounded rate', () => {
    const { scene, calls } = fixture();
    for (let i = 0; i < 3; i++) assert.ok(playGameSfx(scene, 'match', {}, i * 100));
    assert.equal(new Set(calls.map(c => c.key)).size, 3);
    playGameSfx(scene, 'match', { chain: 2 }, 400);
    playGameSfx(scene, 'match', { chain: 5 }, 600);
    assert.match(calls[3].key, /cascade/); assert.ok(calls[4].rate > calls[3].rate);
    playGameSfx(scene, 'match', { chain: 100 }, 800);
    assert.ok(calls.at(-1).rate <= 1.8);
});

test('dense impacts are throttled and voices capped while preserving key feedback', () => {
    const { scene, calls } = fixture();
    assert.ok(playGameSfx(scene, 'stone_break', {}, 0));
    assert.equal(playGameSfx(scene, 'stone_break', {}, 20), false);
    for (let i = 0; i < 7; i++) playGameSfx(scene, 'match', {}, 100 + i * 100);
    assert.equal(playGameSfx(scene, 'ui', {}, 1000), false);
    assert.ok(playGameSfx(scene, 'win', { strength: 100 }, 1200));
    assert.equal(scene.sound.getAllPlaying().length, 8);
    assert.ok(calls.every(c => c.volume <= 1));
});

test('volume changes affect active voices, mute immediately and prevent new sounds', () => {
    const { scene, voices, calls } = fixture();
    playGameSfx(scene, 'rocket', {}, 0);
    const before = voices[0].volume;
    audio.setSoundVolume(.25); assert.equal(voices[0].volume, before / 2);
    audio.setSoundVolume(0); assert.ok(voices[0].stopped);
    assert.equal(playGameSfx(scene, 'bomb', {}, 500), false); assert.equal(calls.length, 1);
    audio.setSoundVolume(.5); scene.cache.audio.exists = () => false;
    assert.equal(playGameSfx(scene, 'win', {}, 1000), false);
});
