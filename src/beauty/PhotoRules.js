// Small gallery metadata; the actual board JSON is loaded only when played.
export const CLASSIC_PHOTO_TEMPLATES = [
    { moves: 20, objectives: [{ target: 'gem', type: 'red', count: 15 }] },
    { moves: 25, objectives: [{ target: 'blocker', type: 'stone', count: 5 }] },
    { moves: 20, objectives: [{ target: 'blocker', type: 'rope', count: 6 }] },
    { moves: 25, objectives: [{ target: 'blocker', type: 'stone', count: 6 }, { target: 'gem', type: 'purple', count: 15 }] },
    { moves: 28, objectives: [{ target: 'blocker', type: 'rope', count: 9 }, { target: 'blocker', type: 'stone', count: 8 }] },
    { moves: 26, objectives: [{ target: 'blocker', type: 'rope', count: 12 }, { target: 'gem', type: 'blue', count: 20 }] },
    { moves: 30, objectives: [{ target: 'blocker', type: 'stone', count: 10 }, { target: 'gem', type: 'red', count: 25 }] },
    { moves: 24, objectives: [{ target: 'blocker', type: 'rope', count: 15 }, { target: 'blocker', type: 'stone', count: 8 }] },
    { moves: 35, objectives: [{ target: 'blocker', type: 'rope', count: 18 }, { target: 'blocker', type: 'stone', count: 12 }, { target: 'gem', type: 'yellow', count: 30 }] },
];

const NEW_PORTRAITS = [
    'lake', 'lavender', 'desert', 'harbor', 'cafe', 'orchard', 'waterfall', 'library', 'rainbow', 'terrace',
    'bamboo', 'rose', 'countryside', 'marina', 'moonlight', 'festival', 'cliff', 'bridge', 'island', 'spring',
];

export const PHOTO_LEVELS = [
    { id: 'garden', title: 'beautyGarden', target: 900, moves: 24 },
    { id: 'sunset', title: 'beautySunset', target: 1400, moves: 24 },
    { id: 'city', title: 'beautyCity', target: 1900, moves: 26 },
    { id: 'coast', title: 'beautyCoast', target: 2200, moves: 27 },
    { id: 'forest', title: 'beautyForest', target: 2500, moves: 28 },
    { id: 'meadow', title: 'beautyMeadow', target: 2800, moves: 29 },
    { id: 'autumn', title: 'beautyAutumn', target: 3100, moves: 30 },
    { id: 'blossom', title: 'beautyBlossom', target: 3400, moves: 31 },
    { id: 'snow', title: 'beautySnow', target: 3700, moves: 32 },
    { id: 'starlight', title: 'beautyStarlight', target: 4000, moves: 34 },
    ...NEW_PORTRAITS.map((id, index) => ({
        ...CLASSIC_PHOTO_TEMPLATES[index % CLASSIC_PHOTO_TEMPLATES.length],
        id, title: `beauty${id[0].toUpperCase()}${id.slice(1)}`,
        classicLevel: index % CLASSIC_PHOTO_TEMPLATES.length + 1,
    })),
];
export const classicPhotoKey = level => `photo_classic_${level.classicLevel}`;
export function copyClassicPhotoBoard(source) {
    // Board loading normalizes blocker counts; never mutate campaign/cache data.
    const { gridLayout, blockerLayout, availableGems, objectives, maxMoves } = source;
    return structuredClone({ gridLayout, blockerLayout, availableGems, objectives, maxMoves });
}
export const photoKey = index => `beauty_${PHOTO_LEVELS[index].id}`;
export const photoPath = index => `assets/images/beauty/${PHOTO_LEVELS[index].id}.webp`;
export const PHOTO_SAVE_KEY = 'jungle-gems-photo-collection-v1';

// Keep collectible progression separate from campaign lives, coins and boosters.
export class PhotoCollection {
    constructor() {
        this.completed = 0;
        try {
            const saved = JSON.parse(globalThis.localStorage?.getItem(PHOTO_SAVE_KEY) || 'null');
            if (Number.isInteger(saved?.completed) && saved.completed >= 0 && saved.completed <= PHOTO_LEVELS.length) {
                this.completed = saved.completed;
            }
        } catch { /* Keep session progress usable when storage is unavailable. */ }
    }

    canPlay(index) {
        return Number.isInteger(index) && index >= 0 && index < PHOTO_LEVELS.length && index <= this.completed;
    }

    isCollected(index) { return this.canPlay(index) && index < this.completed; }

    collect(index) {
        if (!this.canPlay(index)) return false;
        this.completed = Math.max(this.completed, index + 1);
        try { globalThis.localStorage?.setItem(PHOTO_SAVE_KEY, JSON.stringify({ completed: this.completed })); }
        catch { /* Retain unlocked photos for this session. */ }
        return true;
    }
}

export const photoCollection = new PhotoCollection();

export class PhotoRun {
    constructor(level) {
        this.target = level.target;
        this.movesLeft = level.moves;
        this.score = 0;
        this.pending = null;
        this.finished = false;
        this.won = false;
        this.objectives = (level.objectives || []).map(goal => ({ ...goal, remaining: goal.count }));
        this.revealedProgress = 0;
    }

    begin() {
        if (this.finished || this.pending || this.movesLeft <= 0) return false;
        this.pending = { accepted: false };
        return true;
    }

    accept() {
        if (!this.pending || this.pending.accepted) return false;
        this.pending.accepted = true;
        this.movesLeft--;
        return true;
    }

    addScore(points) {
        if (!this.pending?.accepted || !Number.isFinite(points) || points <= 0) return false;
        this.score += points;
        return true;
    }

    updateObjective(key, remaining) {
        if (!this.pending?.accepted || !Number.isFinite(remaining) || remaining < 0) return false;
        const goal = this.objectives.find(goal => `${goal.target}_${goal.type}` === key);
        if (!goal) return false;
        goal.remaining = remaining;
        const progress = this.objectives.reduce((sum, goal) => sum + Math.max(0, 1 - goal.remaining / goal.count), 0) / this.objectives.length;
        this.revealedProgress = Math.max(this.revealedProgress, progress);
        return true;
    }

    settle() {
        this.pending = null;
        this.won = this.objectives.length ? this.objectives.every(goal => goal.remaining === 0) : this.score >= this.target;
        this.finished = this.won || this.movesLeft === 0;
    }

    get progress() {
        if (this.objectives.length) return this.won ? 1 : Math.min(0.98, this.revealedProgress);
        return Math.min(1, this.score / this.target);
    }
}

// Deterministic mosaic ordering spreads each new reveal across the portrait.
export const REVEAL_ORDER = Array.from({ length: 48 }, (_, index) => (index * 17 + 15) % 48);
