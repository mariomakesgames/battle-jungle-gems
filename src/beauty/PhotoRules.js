export const PHOTO_LEVELS = [
    { id: 'garden', title: 'beautyGarden', target: 900, moves: 24 },
    { id: 'sunset', title: 'beautySunset', target: 1400, moves: 24 },
    { id: 'city', title: 'beautyCity', target: 1900, moves: 26 },
];
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

    settle() {
        this.pending = null;
        this.won = this.score >= this.target;
        this.finished = this.won || this.movesLeft === 0;
    }

    get progress() { return Math.min(1, this.score / this.target); }
}

// Deterministic mosaic ordering spreads each new reveal across the portrait.
export const REVEAL_ORDER = Array.from({ length: 48 }, (_, index) => (index * 17 + 15) % 48);
