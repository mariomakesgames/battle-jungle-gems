// Distances use Phaser's logical board coordinates, so they scale with the canvas.
export function dragDirection(start, end, cellSize) {
    const dx = end.x - start.x, dy = end.y - start.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(cellSize) || cellSize <= 0) return null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(8, cellSize * 0.25)) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export function boardCellAt(point, board) {
    if (!board || !Number.isFinite(point.x) || !Number.isFinite(point.y) || board.cellSize <= 0) return null;
    const r = Math.floor((point.y - board.offsetY) / board.cellSize);
    const c = Math.floor((point.x - board.offsetX) / board.cellSize);
    return r >= 0 && r < board.grid.length && c >= 0 && c < board.grid[r].length ? { r, c } : null;
}

// A release outside the canvas still completes a drag. Losing focus or cancelling
// a touch discards it, so a later mouse-up cannot reuse an old starting cell.
export function bindPointerLifecycle(scene, release, cancel) {
    const reset = () => cancel.call(scene);
    const hidden = () => { if (document.hidden) reset(); };
    const canvas = scene.game.canvas;
    scene.input.on('pointerupoutside', release, scene);
    scene.events.on('pause', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', hidden);
    canvas.addEventListener('pointercancel', reset, true);
    canvas.addEventListener('touchcancel', reset, true);
    return () => {
        scene.input.off('pointerupoutside', release, scene);
        scene.events.off('pause', reset);
        window.removeEventListener('blur', reset);
        document.removeEventListener('visibilitychange', hidden);
        canvas.removeEventListener('pointercancel', reset, true);
        canvas.removeEventListener('touchcancel', reset, true);
        reset();
    };
}
