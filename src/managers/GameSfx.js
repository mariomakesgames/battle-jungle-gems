import AudioManager from './AudioManager.js';
import { SFX_EVENTS } from '../audio/SfxPalette.js';

const states = new WeakMap();
const LEGACY_EVENTS = { bomb: 'bomb', stripe: 'stripe', spin_collect: 'color', shake: 'shuffle', rocket: 'rocket' };
export const sfxEventForKey = key => LEGACY_EVENTS[key];

export function playGameSfx(scene, requested, options = {}, now = performance.now()) {
    const event = requested === 'match' && options.chain > 1 ? 'cascade' : requested;
    const definition = SFX_EVENTS[event];
    const volume = AudioManager.getSoundVolume();
    if (!definition || !scene?.sound || !(volume > 0)) return false;
    let state = states.get(scene.sound);
    if (!state) {
        state = { last: new Map(), variants: new Map(), volume };
        states.set(scene.sound, state);
        scene.game.events.on('soundVolumeChanged', next => {
            for (const sound of scene.sound.getAllPlaying()) {
                if (!sound.key.startsWith('sfx_')) continue;
                if (next <= 0) sound.stop();
                else sound.setVolume(Math.min(1, sound.volume * next / (state.volume || 1)));
            }
            state.volume = next;
        });
    }
    if (now - (state.last.get(event) ?? -Infinity) < definition.cooldown) return false;
    const index = state.variants.get(event) || 0;
    const key = definition.keys[index % definition.keys.length];
    if (!scene.cache.audio.exists(key)) return false;
    const playing = scene.sound.getAllPlaying().filter(sound => sound.key.startsWith('sfx_'));
    if (playing.length >= 8) {
        if (definition.priority < 3) return false;
        playing[0].stop();
    }
    const chainRate = event === 'cascade' ? 2 ** (Math.min(5, Math.max(0, (options.chain || 2) - 2)) * 2 / 12) : 1;
    const played = scene.sound.play(key, {
        volume: Math.min(1, volume * definition.volume * Math.min(1.4, Math.max(.1, options.strength || 1))),
        rate: Math.max(.65, Math.min(1.8, (options.rate || 1) * chainRate)),
        detune: (index % 3 - 1) * 8,
        pan: Math.max(-.45, Math.min(.45, options.pan || 0)),
    });
    if (played) {
        state.last.set(event, now);
        state.variants.set(event, index + 1);
        state.volume = volume;
    }
    return played;
}
