import test from 'node:test';
import assert from 'node:assert/strict';
import { dragDirection, boardCellAt } from '../src/input/BoardGesture.js';

test('short and slow drags resolve by dominant direction with a cell-sized threshold', () => {
    const start = { x: 100, y: 100, time: 0 };
    assert.equal(dragDirection(start, { x: 100, y: 120, time: 2000 }, 54), 'down');
    assert.equal(dragDirection(start, { x: 100, y: -140 }, 48), 'up');
    assert.equal(dragDirection(start, { x: 270, y: 175 }, 54), 'right');
    assert.equal(dragDirection(start, { x: 20, y: 40 }, 54), 'left');
    assert.equal(dragDirection(start, { x: 102, y: 104 }, 54), null, 'Tap jitter is not a drag');
    assert.equal(dragDirection(start, { x: 110, y: 100 }, 80), null, 'Larger practice cells need more movement');
    assert.equal(dragDirection(start, { x: NaN, y: 100 }, 54), null);
});

test('board coordinates include cell gaps but reject points outside the grid', () => {
    const board = { offsetX: 45, offsetY: 360, cellSize: 54, grid: Array.from({ length: 9 }, () => Array(9)) };
    assert.deepEqual(boardCellAt({ x: 45, y: 360 }, board), { r: 0, c: 0 });
    assert.deepEqual(boardCellAt({ x: 99.5, y: 414 }, board), { r: 1, c: 1 });
    assert.deepEqual(boardCellAt({ x: 530, y: 845 }, board), { r: 8, c: 8 });
    for (const point of [{ x: 44, y: 400 }, { x: 531, y: 400 }, { x: 50, y: 846 }, { x: NaN, y: 400 }]) {
        assert.equal(boardCellAt(point, board), null);
    }
});
