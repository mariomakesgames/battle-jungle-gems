const POWERS = new Set(['bomb', 'stripe', 'color_bomb']);
export const DUEL_COLORS = ['red', 'green', 'blue', 'purple', 'yellow', 'orange'];

// Connected horizontal/vertical runs form one match, including T/L shapes.
export function findMatches(grid) {
    const runs = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const value = grid[r][c];
            if (!value || POWERS.has(value)) continue;
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                if (grid[r - dr]?.[c - dc] === value) continue;
                const run = [];
                for (let y = r, x = c; grid[y]?.[x] === value; y += dr, x += dc) run.push(`${y},${x}`);
                if (run.length >= 3) runs.push(new Set(run));
            }
        }
    }
    const groups = [];
    while (runs.length) {
        const group = runs.shift();
        let merged = true;
        while (merged) {
            merged = false;
            for (let i = runs.length - 1; i >= 0; i--) {
                if ([...runs[i]].some(cell => group.has(cell))) {
                    for (const cell of runs.splice(i, 1)[0]) group.add(cell);
                    merged = true;
                }
            }
        }
        groups.push(group);
    }
    return groups;
}

export function listMoves(grid) {
    const copy = grid.map(row => [...row]);
    const moves = [];
    for (let r1 = 0; r1 < grid.length; r1++) {
        for (let c1 = 0; c1 < grid[r1].length; c1++) {
            for (const [r2, c2] of [[r1 + 1, c1], [r1, c1 + 1]]) {
                const a = grid[r1][c1], b = grid[r2]?.[c2];
                if (!a || !b) continue;
                copy[r1][c1] = b; copy[r2][c2] = a;
                const groups = findMatches(copy).filter(group => group.has(`${r1},${c1}`) || group.has(`${r2},${c2}`));
                copy[r1][c1] = a; copy[r2][c2] = b;
                const power = POWERS.has(a) || POWERS.has(b);
                if (!groups.length && !power) continue;
                const special = groups.some(group => group.size >= 4);
                // Estimate visible clears, never inspect future random refills.
                let clears = groups.reduce((total, group) => total + group.size, 0);
                if (power) {
                    if (a === 'color_bomb' && b === 'color_bomb') clears += grid.flat().filter(Boolean).length;
                    else if (a === 'color_bomb' || b === 'color_bomb') {
                        const color = a === 'color_bomb' ? b : a;
                        clears += POWERS.has(color) ? 25 : grid.flat().filter(value => value === color).length;
                    } else clears += a === 'stripe' || b === 'stripe' ? grid.length : 9;
                }
                moves.push({ r1, c1, r2, c2, special, value: clears * 10 + (special ? 100 : 0) });
            }
        }
    }
    return moves;
}

export function chooseMove(grid, random = Math.random) {
    const moves = listMoves(grid);
    if (!moves.length) return null;
    const best = Math.max(...moves.map(move => move.value));
    const candidates = moves.filter(move => move.value === best);
    return candidates[Math.floor(random() * candidates.length)];
}

export function makeDuelGrid(random = Math.random) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const grid = Array.from({ length: 9 }, () => Array(9));
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
            const colors = DUEL_COLORS.filter(color =>
                !(c >= 2 && grid[r][c - 1] === color && grid[r][c - 2] === color) &&
                !(r >= 2 && grid[r - 1][c] === color && grid[r - 2][c] === color));
            grid[r][c] = colors[Math.floor(random() * colors.length)];
        }
        if (listMoves(grid).length) return grid;
    }
    throw new Error('Could not generate a playable duel board');
}
