import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ASSET_GROUPS, queueAssetGroup } from '../src/utils/AssetGroups.js';

function fakeScene(cachedImages = [], cachedAudio = []) {
    const requested = [];
    return {
        requested,
        textures: { exists: key => cachedImages.includes(key) },
        cache: { audio: { exists: key => cachedAudio.includes(key) } },
        load: {
            image: (key, path) => requested.push(['image', key, path]),
            audio: (key, path) => requested.push(['audio', key, path])
        }
    };
}

test('each deferred group references existing assets and contains unique keys', () => {
    for (const [name, group] of Object.entries(ASSET_GROUPS)) {
        const keys = [];
        for (const [key, path] of group.images) {
            assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `${name}: ${path}`);
            keys.push(key);
        }
        for (const { key, path } of group.audio || []) {
            assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `${name}: ${path}`);
            keys.push(key);
        }
        assert.equal(new Set(keys).size, keys.length, name);
    }
});

test('cached images and decoded sounds are skipped while missing ones are queued', () => {
    const group = ASSET_GROUPS.shop;
    const scene = fakeScene([group.images[0][0]], [group.audio[0].key]);
    assert.equal(queueAssetGroup(scene, 'shop'), group.images.length - 1);
    assert.ok(scene.requested.every(([type, key]) => type === 'image' && key !== group.images[0][0]));
});

test('fully cached group queues no work, supporting immediate popup reopen', () => {
    const group = ASSET_GROUPS.spin;
    const scene = fakeScene(group.images.map(([key]) => key), group.audio.map(({ key }) => key));
    assert.equal(queueAssetGroup(scene, 'spin'), 0);
    assert.deepEqual(scene.requested, []);
});

test('shared asset keys always refer to the same file', () => {
    const paths = new Map();
    for (const group of Object.values(ASSET_GROUPS)) {
        for (const [key, path] of group.images) {
            if (paths.has(key)) assert.equal(paths.get(key), path, key);
            paths.set(key, path);
        }
    }
});
