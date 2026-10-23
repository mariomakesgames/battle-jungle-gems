import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { PHOTO_LEVELS, PORTRAITS, NEW_PORTRAITS, PhotoRun, PhotoCollection, PHOTO_SAVE_KEY, REVEAL_ORDER, photoPath, photoKey, photoBoardPath, classicPhotoKey, copyClassicPhotoBoard } from '../src/beauty/PhotoRules.js';

test('invalid swaps cost no moves; cascades add score but spend only one move', () => {
    const run = new PhotoRun({ target: 900, moves: 24 });
    run.begin(); run.settle();
    assert.equal(run.movesLeft, 24);
    assert.equal(run.addScore(100), false);
    run.begin();
    assert.equal(run.begin(), false);
    run.accept();
    assert.equal(run.accept(), false);
    run.addScore(30); run.addScore(60); run.addScore(120);
    assert.equal(run.addScore(NaN), false);
    assert.equal(run.movesLeft, 23);
    assert.equal(run.score, 210);
    assert.equal(run.finished, false);
    run.settle();
    assert.equal(run.progress, 210 / 900);
});

test('the final valid move can still win; otherwise running out ends the attempt', () => {
    for (const won of [true, false]) {
        const run = new PhotoRun({ target: 90, moves: 1 });
        run.begin(); run.accept(); run.addScore(won ? 100 : 30);
        assert.equal(run.finished, false, 'Wait for the board to settle before showing a result');
        run.settle();
        assert.equal(run.finished, true);
        assert.equal(run.won, won);
        assert.equal(run.progress, won ? 1 : 1 / 3);
        assert.equal(run.begin(), false);
    }
});

test('boosters count toward goals and cascades without spending moves or overlapping actions', () => {
    const run = new PhotoRun({ moves: 2, objectives: [{ target: 'blocker', type: 'stone', count: 2 }] });
    assert.equal(run.beginBooster(), true);
    assert.equal(run.begin(), false);
    assert.equal(run.beginBooster(), false);
    assert.equal(run.accept(), false, 'The swap booster also emits swapAccepted');
    assert.equal(run.movesLeft, 2);
    assert.equal(run.addScore(100), true);
    assert.equal(run.updateObjective('blocker_stone', 1), true);
    run.settle();
    assert.equal(run.progress, 0.5);
    assert.equal(run.won, false);
    run.beginBooster();
    run.updateObjective('blocker_stone', 0);
    run.settle();
    assert.equal(run.won, true);
    assert.equal(run.progress, 1);
    assert.equal(run.movesLeft, 2);
    assert.equal(run.beginBooster(), false);
});

test('collection unlocks sequentially, persists, rejects corrupt saves and works without storage', () => {
    const values = new Map();
    globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    try {
        const collection = new PhotoCollection();
        assert.equal(collection.collect(2), false);
        assert.equal(collection.collect(0), true);
        assert.equal(collection.collect(0), true);
        assert.equal(collection.completed, 1);
        assert.equal(collection.canPlay(1), true);
        assert.equal(collection.isCollected(1), false);
        assert.equal(new PhotoCollection().isCollected(0), true);
        values.set(PHOTO_SAVE_KEY, '{bad');
        assert.equal(new PhotoCollection().completed, 0);
        values.set(PHOTO_SAVE_KEY, '{"completed":99}');
        assert.equal(new PhotoCollection().completed, 0);
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
        const blocked = new PhotoCollection();
        assert.equal(blocked.collect(0), true);
        assert.equal(blocked.isCollected(0), true);
    } finally { delete globalThis.localStorage; }
});

test('existing portrait saves continue through all 84 levels without resetting progress', () => {
    const values = new Map([[PHOTO_SAVE_KEY, JSON.stringify({ completed: 3 })]]);
    globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    try {
        assert.equal(PHOTO_LEVELS.length, 84);
        assert.equal(new Set(PHOTO_LEVELS.map(level => level.id)).size, 84);
        for (const saved of [3, 10, 30, 54, 83]) {
            values.set(PHOTO_SAVE_KEY, JSON.stringify({ completed: saved }));
            const collection = new PhotoCollection();
            for (let index = 0; index < saved; index++) assert.equal(collection.isCollected(index), true);
            for (let index = saved; index < PHOTO_LEVELS.length; index++) {
                assert.equal(collection.canPlay(index), true);
                assert.equal(collection.collect(index + 1), false, 'Cannot skip an uncompleted portrait');
                assert.equal(collection.collect(index), true);
                assert.equal(new PhotoCollection().completed, index + 1);
            }
            assert.equal(collection.canPlay(PHOTO_LEVELS.length), false);
            assert.equal(collection.isCollected(PHOTO_LEVELS.length - 1), true);
        }
    } finally { delete globalThis.localStorage; }
});

test('all 84 challenges use authored goals, budgets and independently cloned layouts', () => {
    const additions = PHOTO_LEVELS;
    assert.equal(additions.length, 84);
    assert.deepEqual([...new Set(additions.filter(level => level.classicLevel).map(level => level.classicLevel))].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const level of additions) {
        const source = JSON.parse(readFileSync(new URL(`../public/${photoBoardPath(level)}`, import.meta.url)));
        assert.equal(level.moves, source.maxMoves);
        assert.deepEqual(level.objectives, source.objectives);
        const board = copyClassicPhotoBoard(source);
        assert.deepEqual(board.gridLayout, source.gridLayout);
        assert.deepEqual(board.blockerLayout, source.blockerLayout);
        assert.deepEqual(board.availableGems, source.availableGems);
        assert.equal(board.starTimes, undefined, 'Campaign timer and results stay separate');
        board.gridLayout[0][0] = 99;
        board.objectives[0].count = 99;
        assert.notEqual(source.gridLayout[0][0], 99);
        assert.notEqual(source.objectives[0].count, 99);
    }
});

test('every level has its own portrait, texture and recorded source', () => {
    assert.equal(PORTRAITS.length, 84);
    assert.equal(new Set(PHOTO_LEVELS.map((_, index) => photoPath(index))).size, 84);
    assert.equal(new Set(PHOTO_LEVELS.map((_, index) => photoKey(index))).size, 84);
    assert.notEqual(photoKey(0), photoKey(11));
    assert.notEqual(photoPath(0), photoPath(11));
    assert.notEqual(classicPhotoKey(PHOTO_LEVELS[0]), classicPhotoKey(PHOTO_LEVELS[11]));
    const manifest = JSON.parse(readFileSync(new URL('../public/assets/images/beauty/portraits/sources.json', import.meta.url)));
    for (const id of PORTRAITS) assert.ok(manifest.assets.some(asset => asset.runtime_file === `${id}.webp` && asset.source.startsWith('https://pixabay.com/')));
});

test('20 imported layouts preserve every source cell, obstacle hit count, powerup and move budget', () => {
    const imported = PHOTO_LEVELS.filter(level => level.importedLevel);
    assert.equal(imported.length, 75);
    assert.equal(new Set(imported.map(level => level.importedLevel)).size, 20);
    const layouts = new Set();
    const colors = { r: 1, g: 2, b: 3, y: 5 };
    const specials = { hro: 'stripe', vro: 'stripe', tnt: 'bomb', lb: 'color_bomb' };
    for (const level of imported) {
        const id = String(level.importedLevel).padStart(2, '0');
        const source = JSON.parse(readFileSync(new URL(`../reference/match3-levels/alperen-garip/original/level_${id}.json`, import.meta.url)));
        const board = JSON.parse(readFileSync(new URL(`../public/${photoBoardPath(level)}`, import.meta.url)));
        assert.equal(board.maxMoves, source.move_count);
        assert.equal(board.gridSize, Math.max(9, source.grid_width, source.grid_height));
        assert.equal(board.gridLayout.flat().filter(cell => cell !== null).length, source.grid.length);
        const { top, left } = board.source;
        let obstacles = 0, powerups = 0;
        source.grid.forEach((code, index) => {
            const row = top + Math.floor(index / source.grid_width), col = left + index % source.grid_width;
            assert.equal(board.gridLayout[row][col], colors[code] || 0);
            const hits = code === 'v' ? 2 : ['bo', 's'].includes(code) ? 1 : 0;
            assert.equal(board.stoneHealthLayout[row][col], hits);
            assert.equal(board.blockerLayout[row][col], hits ? 2 : 0);
            if (hits) obstacles++;
            if (specials[code]) {
                powerups++;
                assert.ok(board.initialPowerups.some(p => p.row === row && p.col === col && p.type === specials[code]));
            }
        });
        assert.equal(board.objectives[0].count, obstacles);
        assert.equal(board.initialPowerups.length, powerups);
        const cloned = copyClassicPhotoBoard(board);
        assert.deepEqual(cloned.initialPowerups, board.initialPowerups);
        assert.deepEqual(cloned.stoneHealthLayout, board.stoneHealthLayout);
        layouts.add(JSON.stringify([board.gridLayout, board.blockerLayout, board.initialPowerups]));
    }
    assert.equal(layouts.size, 20);
});

test('unique replacements keep the first 11 and last 30 level assignments and saved progression', () => {
    const original = ['8059755', '8363683', '9013533', '8790150', '8105566', '8400104', '8682657', '8933700', '9504564', '8584916', '8682687'];
    for (let index = 0; index < 11; index++) assert.equal(PHOTO_LEVELS[index].portrait, original[index]);
    const replacements = PHOTO_LEVELS.slice(11, 54);
    assert.equal(replacements.length, 43);
    assert.equal(new Set(replacements.map(level => level.portrait)).size, 43);
    assert.ok(replacements.every(level => !original.includes(level.portrait) && !NEW_PORTRAITS.includes(level.portrait)));
    const additions = PHOTO_LEVELS.slice(54);
    assert.equal(additions.length, 30);
    assert.equal(new Set(additions.map(level => level.portrait)).size, 30);
    assert.deepEqual(additions.map(level => level.portrait), NEW_PORTRAITS);
    assert.ok(additions.every(level => !original.includes(level.portrait)));
    const manifest = JSON.parse(readFileSync(new URL('../public/assets/images/beauty/portraits/sources.json', import.meta.url)));
    assert.equal(new Set(manifest.assets.map(asset => asset.sha256)).size, manifest.assets.length);
});

test('classic goals govern reveals and last-move results, even after a large score or rope regrowth', () => {
    const run = new PhotoRun({ moves: 2, objectives: [{ target: 'gem', type: 'red', count: 3 }, { target: 'blocker', type: 'rope', count: 2 }] });
    assert.equal(run.updateObjective('gem_red', 0), false, 'Ignore foreign/initial board updates');
    run.begin(); run.accept(); run.addScore(10000);
    run.updateObjective('gem_red', 0);
    run.updateObjective('blocker_rope', 1);
    const revealed = run.progress;
    run.updateObjective('blocker_rope', 4);
    assert.equal(run.progress, revealed, 'Regrowth never re-covers the picture');
    run.settle();
    assert.equal(run.won, false, 'Score cannot bypass a remaining classic goal');
    assert.equal(run.finished, false);
    run.begin(); run.accept();
    assert.equal(run.movesLeft, 0);
    assert.equal(run.updateObjective('blocker_stone', 0), false);
    assert.equal(run.updateObjective('blocker_rope', NaN), false);
    run.updateObjective('blocker_rope', 0);
    assert.ok(run.progress < 1, 'Finish the cascade before uncovering the whole photo');
    run.settle();
    assert.equal(run.won, true);
    assert.equal(run.finished, true);
    assert.equal(run.progress, 1);
});

test('reveal tiles cover the whole portrait exactly once and assets stay small', () => {
    assert.deepEqual([...REVEAL_ORDER].sort((a, b) => a - b), Array.from({ length: 48 }, (_, index) => index));
    PHOTO_LEVELS.forEach((_, index) => {
        const path = new URL(`../public/${photoPath(index)}`, import.meta.url);
        assert.ok(existsSync(path));
        assert.ok(statSync(path).size < 150000, 'Each portrait should be less than 150 KB');
    });
});


test('first nine challenges use the original campaign, followed by imported boards in order', () => {
    for (let index = 0; index < 9; index++) {
        assert.equal(PHOTO_LEVELS[index].classicLevel, index + 1);
        assert.equal(PHOTO_LEVELS[index].importedLevel, undefined);
        assert.equal(photoBoardPath(PHOTO_LEVELS[index]), `assets/levels/level_${index + 1}.json`);
    }
    for (let index = 9; index < PHOTO_LEVELS.length; index++) {
        assert.equal(PHOTO_LEVELS[index].importedLevel, (index - 9) % 20 + 1);
        assert.equal(PHOTO_LEVELS[index].classicLevel, undefined);
    }
});
