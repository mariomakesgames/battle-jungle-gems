import test from 'node:test';
import assert from 'node:assert/strict';
import { DuelRules } from '../src/ai/DuelRules.js';
import { chooseMove, findMatches, listMoves, makeDuelGrid } from '../src/ai/ChooseMove.js';

function play(duel, actor, special = false, points = 30) {
    assert.equal(duel.begin(actor), true);
    duel.accept(special);
    duel.addScore(points);
    duel.settle();
}

test('turns switch after two settled valid swaps; cascades belong to the acting side', () => {
    const duel = new DuelRules();
    play(duel, 'player');
    assert.equal(duel.swapsLeft, 1);
    assert.equal(duel.begin('ai'), false);
    assert.equal(duel.begin('player'), true);
    duel.accept(false);
    duel.addScore(30);
    duel.addScore(60);
    assert.equal(duel.actor, 'player');
    assert.equal(duel.begin('player'), false);
    duel.settle();
    assert.deepEqual(duel.scores, { player: 120, ai: 0 });
    assert.equal(duel.actor, 'ai');
    play(duel, 'ai'); play(duel, 'ai');
    assert.equal(duel.actor, 'player');
    assert.equal(duel.round, 2);
});

test('invalid swaps do not cost moves and specials earn exactly one for either side', () => {
    const duel = new DuelRules();
    duel.begin('player'); duel.addScore(1000); duel.settle();
    assert.equal(duel.swapsLeft, 2);
    assert.equal(duel.scores.player, 0);
    duel.begin('player'); duel.accept(true); duel.accept(true); duel.settle();
    assert.equal(duel.swapsLeft, 2);
    play(duel, 'player'); play(duel, 'player');
    play(duel, 'ai', true);
    assert.equal(duel.swapsLeft, 2);
});

test('final round grants both sides their complete turn and handles wins and ties', () => {
    for (const [playerPoints, aiPoints, winner] of [[40, 30, 'player'], [20, 40, 'ai'], [30, 30, 'draw']]) {
        const duel = new DuelRules(1);
        play(duel, 'player', false, playerPoints); play(duel, 'player', false, playerPoints);
        assert.equal(duel.finished, false);
        play(duel, 'ai', true, 0);
        play(duel, 'ai', false, aiPoints); play(duel, 'ai', false, aiPoints);
        assert.equal(duel.finished, true);
        assert.equal(duel.winner, winner);
        assert.equal(duel.begin('player'), false);
    }
});

test('matches merge T/L intersections while independent triples stay ordinary', () => {
    assert.equal(findMatches([
        ['a', 'a', 'a'], ['b', 'a', 'c'], ['c', 'a', 'b'],
    ])[0].size, 5);
    assert.deepEqual(findMatches([
        ['a', 'a', 'a'], ['b', 'c', 'd'], ['b', 'b', 'b'],
    ]).map(group => group.size), [3, 3]);
    assert.equal(findMatches([['stripe', 'stripe', 'stripe']]).length, 0);
});

test('AI evaluates valid swaps and prefers special matches without changing the board', () => {
    const grid = [
        ['a', 'a', 'b', 'a', 'c'],
        ['b', 'c', 'a', 'd', 'b'],
        ['c', 'd', 'b', 'c', 'd'],
        ['d', 'b', 'c', 'b', 'a'],
        ['a', 'c', 'd', 'a', 'c'],
    ];
    const before = structuredClone(grid);
    const move = chooseMove(grid, () => 0);
    assert.equal(move.special, true);
    assert.deepEqual(grid, before);
    assert.equal(chooseMove([['a', 'b'], ['c', 'd']]), null);
    assert.ok(listMoves([['color_bomb', 'a'], ['b', 'c']]).length > 0);
});

test('fresh duel boards have no existing matches and at least one playable swap', () => {
    for (let seed = 1; seed <= 20; seed++) {
        let state = seed;
        const grid = makeDuelGrid(() => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296));
        assert.equal(findMatches(grid).length, 0);
        assert.ok(listMoves(grid).length > 0);
        assert.equal(grid.length, 9);
    }
});
