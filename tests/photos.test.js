import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { PHOTO_LEVELS, PhotoRun, PhotoCollection, PHOTO_SAVE_KEY, REVEAL_ORDER, photoPath, copyClassicPhotoBoard } from '../src/beauty/PhotoRules.js';

test('invalid swaps cost no moves; cascades add score but spend only one move', () => {
    const run = new PhotoRun(PHOTO_LEVELS[0]);
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

test('three- and ten-portrait saves continue through all thirty portraits without resetting collected art', () => {
    const values = new Map([[PHOTO_SAVE_KEY, JSON.stringify({ completed: 3 })]]);
    globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    try {
        assert.equal(PHOTO_LEVELS.length, 30);
        assert.equal(new Set(PHOTO_LEVELS.map(level => level.id)).size, 30);
        for (const saved of [3, 10]) {
            values.set(PHOTO_SAVE_KEY, JSON.stringify({ completed: saved }));
            const collection = new PhotoCollection();
            for (let index = 0; index < saved; index++) assert.equal(collection.isCollected(index), true);
            for (let index = saved; index < PHOTO_LEVELS.length; index++) {
                assert.equal(collection.canPlay(index), true);
                assert.equal(collection.collect(index + 1), false, 'Cannot skip an uncompleted portrait');
                assert.equal(collection.collect(index), true);
                assert.equal(new PhotoCollection().completed, index + 1);
            }
            assert.equal(collection.canPlay(30), false);
            assert.equal(collection.isCollected(29), true);
        }
    } finally { delete globalThis.localStorage; }
});

test('twenty new challenges reuse actual classic goals, budgets and independently cloned layouts', () => {
    const additions = PHOTO_LEVELS.slice(10);
    assert.equal(additions.length, 20);
    assert.deepEqual([...new Set(additions.map(level => level.classicLevel))].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const level of additions) {
        const source = JSON.parse(readFileSync(new URL(`../public/assets/levels/level_${level.classicLevel}.json`, import.meta.url)));
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
