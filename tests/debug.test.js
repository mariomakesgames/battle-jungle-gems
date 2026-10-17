import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDebugMode } from '../src/utils/DebugMode.js';
import { canEnterPhotoLevel, PhotoCollection, PHOTO_LEVELS } from '../src/beauty/PhotoRules.js';

test('local dev and loopback previews enable debug by default; production remains locked', () => {
    for (const hostname of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]', '::1', 'game.localhost']) {
        assert.equal(resolveDebugMode({ hostname }), true);
        assert.equal(resolveDebugMode({ hostname, search: '?debug=0' }), false);
    }
    assert.equal(resolveDebugMode({ hostname: '192.168.1.10', development: true }), true);
    assert.equal(resolveDebugMode({ hostname: 'game.example.com' }), false);
    assert.equal(resolveDebugMode({ hostname: 'game.example.com', search: '?debug=1' }), false);
    assert.equal(resolveDebugMode({ hostname: 'localhost.example.com' }), false);
    assert.equal(resolveDebugMode(), false);
});

test('debug allows all valid photo levels without fabricating collection progress', () => {
    const collection = new PhotoCollection();
    for (let index = 0; index < PHOTO_LEVELS.length; index++) {
        assert.equal(canEnterPhotoLevel(index, collection, true), true);
        assert.equal(canEnterPhotoLevel(index, collection, false), index === 0);
        assert.equal(collection.isCollected(index), false);
    }
    for (const index of [-1, PHOTO_LEVELS.length, undefined, '1', 1.5]) {
        assert.equal(canEnterPhotoLevel(index, collection, true), false);
    }
    assert.equal(collection.completed, 0);
});
