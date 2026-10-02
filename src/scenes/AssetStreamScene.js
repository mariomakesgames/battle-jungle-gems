import Phaser from 'phaser';
import { queueAssetGroup } from '../utils/AssetGroups';

let streamId = 0;

// Every optional batch owns its loader, separate from required scene downloads.
class AssetStreamScene extends Phaser.Scene {
    constructor(key) { super({ key }); }
    init(job) { this.job = job; }

    preload() {
        if (this.job.cancelled) return;
        this.load.maxParallelDownloads = 2;
        this.load.on('progress', value => this.job.onProgress?.(value));
        for (const group of this.job.groups || []) queueAssetGroup(this, group);
        for (const { key, path } of this.job.audio || []) {
            if (!this.cache.audio.exists(key)) this.load.audio(key, path);
        }
    }

    create() {
        if (!this.job.cancelled) this.job.onComplete?.();
        this.scene.remove();
    }

    cancel() {
        this.job.cancelled = true;
        for (const file of this.load.inflight.entries) {
            const request = file.xhrLoader;
            if (request && request.readyState !== 4) {
                request.onload = request.onerror = request.onprogress = request.onabort = null;
                request.abort();
            }
        }
        // Destroying this worker prevents late decode callbacks affecting later batches.
        this.scene.remove();
    }
}

export function startAssetStream(owner, job) {
    const key = `AssetStream:${++streamId}`;
    owner.scene.add(key, new AssetStreamScene(key), true, job);
    return {
        cancel() {
            job.cancelled = true;
            owner.scene.manager.keys[key]?.cancel();
        }
    };
}
