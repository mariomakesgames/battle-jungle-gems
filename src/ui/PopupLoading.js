import LanguageManager from '../i18n/LanguageManager';
import { queueAssetGroup } from '../utils/AssetGroups';

export function preloadPopupAssets(scene, group, parentKeys) {
    // Pause the same parents as the popup's create method, before downloads begin.
    const paused = parentKeys.filter(key => scene.scene.isActive(key));
    paused.forEach(key => scene.scene.pause(key));
    scene.events.once('shutdown', () => paused.forEach(key => {
        if (scene.scene.isPaused(key)) scene.scene.resume(key);
    }));
    if (!queueAssetGroup(scene, group)) return;

    const { width, height } = scene.scale;
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x17120c, 0.9)
        .setInteractive().setDepth(100);
    const label = scene.add.text(width / 2, height / 2, '', {
        fontFamily: 'UTMCookies, Arial, sans-serif', fontSize: '26px', color: '#fff5df'
    }).setOrigin(0.5).setDepth(101);
    const refresh = progress => label.setText(LanguageManager.t('loading', { percent: Math.floor(progress * 100) }));
    refresh(0);
    scene.load.on('progress', refresh);
    scene.load.once('complete', () => {
        scene.load.off('progress', refresh);
        overlay.destroy();
        label.destroy();
    });
}
