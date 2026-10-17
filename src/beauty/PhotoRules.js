import { IMPORTED_PHOTO_LEVELS } from './ImportedPhotoLevels.js';
import { isDebugMode } from '../utils/DebugMode.js';

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

const ORIGINAL_PORTRAITS = [
    '8059755', '8363683', '9013533', '8790150', '8105566', '8400104',
    '8682657', '8933700', '9504564', '8584916', '8682687',
];

export const NEW_PORTRAITS = [
    '8682647', '8272727', '8400107', '8664000', '8649045', '8689093',
    '8180950', '8673376', '8229667', '8914183', '8101076', '8566075',
    '8653458', '8814852', '8814854', '9023680', '8741978', '9966192',
    '9331244', '8589710', '8669954', '9658273', '8371252', '8764204',
    '8114807', '8205238', '10011345', '8326283', '9496536', '8510527',
];
export const PORTRAITS = [...ORIGINAL_PORTRAITS, ...NEW_PORTRAITS];

// Preserve the first 54 levels' art so existing collections stay consistent.
// The first 20 challenges use imported layouts; later challenges retain classic boards.
export const PHOTO_LEVELS = Array.from({ length: 54 + NEW_PORTRAITS.length }, (_, index) => ({
    ...(IMPORTED_PHOTO_LEVELS[index] || {
        ...structuredClone(CLASSIC_PHOTO_TEMPLATES[index % CLASSIC_PHOTO_TEMPLATES.length]),
        classicLevel: index % CLASSIC_PHOTO_TEMPLATES.length + 1,
    }),
    id: `portrait-${index + 1}`,
    portrait: index < 54 ? ORIGINAL_PORTRAITS[index % ORIGINAL_PORTRAITS.length] : NEW_PORTRAITS[index - 54],
    title: 'beautyPortraitLevel',
    titleParams: { level: index + 1 },
}));
export const classicPhotoKey = level => level.importedLevel ? `photo_imported_${level.importedLevel}` : `photo_classic_${level.classicLevel}`;
export const photoBoardPath = level => level.importedLevel
    ? `assets/levels/imported/level_${level.importedLevel}.json`
    : `assets/levels/level_${level.classicLevel}.json`;
export function copyClassicPhotoBoard(source) {
    // Board loading normalizes blocker counts; never mutate campaign/cache data.
    const { gridLayout, blockerLayout, availableGems, objectives, maxMoves, gridSize, stoneHealthLayout, initialPowerups } = source;
    return structuredClone({ gridLayout, blockerLayout, availableGems, objectives, maxMoves, gridSize, stoneHealthLayout, initialPowerups });
}
export const photoKey = index => `beauty_pixabay_${PHOTO_LEVELS[index].portrait}`;
export const photoPath = index => `assets/images/beauty/portraits/${PHOTO_LEVELS[index].portrait}.webp`;
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

export function canEnterPhotoLevel(index, collection = photoCollection, debug = isDebugMode()) {
    return Number.isInteger(index) && index >= 0 && index < PHOTO_LEVELS.length &&
        (debug || collection.canPlay(index));
}

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
