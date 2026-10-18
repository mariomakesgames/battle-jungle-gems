const keys = (name, count = 1) => Array.from({ length: count }, (_, i) => `sfx_${name}${count > 1 ? `_${i + 1}` : ''}`);

export const SFX_EVENTS = {
    match: { keys: keys('match', 3), volume: .58, cooldown: 75, priority: 1 },
    cascade: { keys: keys('cascade', 3), volume: .62, cooldown: 95, priority: 2 },
    swap: { keys: keys('swap', 2), volume: .42, cooldown: 65, priority: 1 },
    invalid: { keys: keys('invalid'), volume: .42, cooldown: 180, priority: 2 },
    special: { keys: keys('special'), volume: .6, cooldown: 180, priority: 2 },
    stone_hit: { keys: keys('stone_hit'), volume: .38, cooldown: 85, priority: 1 },
    stone_break: { keys: keys('stone_break'), volume: .48, cooldown: 100, priority: 2 },
    rope: { keys: keys('rope'), volume: .46, cooldown: 100, priority: 2 },
    hammer: { keys: keys('hammer'), volume: .7, cooldown: 180, priority: 3 },
    rocket: { keys: keys('rocket'), volume: .65, cooldown: 260, priority: 3 },
    shuffle: { keys: keys('shuffle'), volume: .62, cooldown: 300, priority: 3 },
    bomb: { keys: keys('bomb', 2), volume: .7, cooldown: 160, priority: 3 },
    stripe: { keys: keys('stripe', 2), volume: .6, cooldown: 160, priority: 3 },
    color: { keys: keys('color'), volume: .6, cooldown: 260, priority: 3 },
    ui: { keys: keys('ui'), volume: .35, cooldown: 65, priority: 1 },
    low_moves: { keys: keys('low_moves'), volume: .5, cooldown: 1000, priority: 3 },
    win: { keys: keys('win'), volume: .7, cooldown: 500, priority: 4 },
    lose: { keys: keys('lose'), volume: .52, cooldown: 500, priority: 4 },
};

export const GAME_SFX_PATHS = Object.values(SFX_EVENTS).flatMap(event => event.keys.map(key => ({
    key, path: `assets/sounds/gameplay/${key.slice(4)}.wav`,
})));
