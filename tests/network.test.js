import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSignal, decodeSignal } from '../src/network/PeerLink.js';
import { validState, validMove, canAcceptRemoteMove } from '../src/network/DuelProtocol.js';

test('connection codes round-trip and reject wrong types, malformed or oversized input', async () => {
    const description = { type: 'offer', sdp: 'v=0\r\na=application\r\n' };
    const code = await encodeSignal(description);
    assert.deepEqual(await decodeSignal(code, 'offer'), description);
    await assert.rejects(decodeSignal(code, 'answer'), /linkInvalidCode/);
    for (const invalid of ['not-a-code', 'JG1.____', 'JG1.' + 'a'.repeat(200001)]) {
        await assert.rejects(decodeSignal(invalid, 'offer'), /linkInvalidCode/);
    }
});

test('host accepts only adjacent in-bounds guest moves for the current match and revision', () => {
    const state = { matchId: 'match', revision: 7, actor: 'ai', busy: false, paused: false, finished: false };
    const packet = { type: 'move', matchId: 'match', revision: 7, move: { r1: 0, c1: 0, r2: 0, c2: 1 } };
    assert.equal(canAcceptRemoteMove(packet, state), true);
    for (const patch of [{ revision: 6 }, { matchId: 'old' }, { move: { r1: 0, c1: 0, r2: 2, c2: 0 } }]) {
        assert.equal(canAcceptRemoteMove({ ...packet, ...patch }, state), false);
    }
    for (const patch of [{ actor: 'player' }, { busy: true }, { paused: true }, { finished: true }]) {
        assert.equal(canAcceptRemoteMove(packet, { ...state, ...patch }), false);
    }
    assert.equal(validMove({ r1: -1, c1: 0, r2: 0, c2: 0 }), false);
});

test('snapshots require a complete valid board and coherent bounded turn values', () => {
    const state = { type: 'state', version: 1, matchId: 'match', revision: 1, busy: false, paused: false,
        grid: Array.from({ length: 9 }, () => Array(9).fill('red')),
        duel: { actor: 'player', round: 1, totalRounds: 10, swapsLeft: 2, finished: false, scores: { player: 0, ai: 0 } } };
    assert.equal(validState(state), true);
    assert.equal(validState({ ...state, grid: state.grid.slice(1) }), false);
    assert.equal(validState({ ...state, duel: { ...state.duel, swapsLeft: 99 } }), false);
    assert.equal(validState({ ...state, duel: { ...state.duel, scores: { player: NaN, ai: 0 } } }), false);
});
