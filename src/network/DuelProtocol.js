const VALUES = new Set(['red', 'green', 'blue', 'purple', 'yellow', 'orange', 'bomb', 'stripe', 'color_bomb']);
export function newMatchId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validGrid(grid) {
    return Array.isArray(grid) && grid.length === 9 && grid.every(row =>
        Array.isArray(row) && row.length === 9 && row.every(value => VALUES.has(value)));
}

export function validState(packet) {
    const state = packet?.duel;
    return packet?.type === 'state' && packet.version === 1 && typeof packet.matchId === 'string' && packet.matchId.length > 0 && packet.matchId.length <= 80 &&
        Number.isSafeInteger(packet.revision) && packet.revision >= 0 && typeof packet.busy === 'boolean' && typeof packet.paused === 'boolean' &&
        validGrid(packet.grid) && state && ['player', 'ai'].includes(state.actor) &&
        Number.isInteger(state.round) && state.round >= 1 && state.round <= 10 && state.totalRounds === 10 &&
        Number.isInteger(state.swapsLeft) && state.swapsLeft >= 0 && state.swapsLeft <= 2 && typeof state.finished === 'boolean' &&
        ['player', 'ai'].every(actor => Number.isFinite(state.scores?.[actor]) && state.scores[actor] >= 0);
}

export function validMove(move) {
    return move && ['r1', 'c1', 'r2', 'c2'].every(key => Number.isInteger(move[key]) && move[key] >= 0 && move[key] < 9) &&
        Math.abs(move.r1 - move.r2) + Math.abs(move.c1 - move.c2) === 1;
}

export function canAcceptRemoteMove(packet, state) {
    return packet?.type === 'move' && packet.matchId === state.matchId && packet.revision === state.revision &&
        validMove(packet.move) && state.actor === 'ai' && !state.busy && !state.paused && !state.finished;
}
