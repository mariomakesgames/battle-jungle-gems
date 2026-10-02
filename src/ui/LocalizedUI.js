import LanguageManager, { LANGUAGES } from '../i18n/LanguageManager';

// Refresh individual labels without restarting scenes or losing a running level.
export function bindText(text, key, params = {}, maxWidth = 0) {
    text.setFontFamily('UTMCookies, Arial, sans-serif');
    const refresh = () => {
        text.setText(LanguageManager.t(key, typeof params === 'function' ? params() : params));
        text.setScale(1);
        if (maxWidth && text.width > maxWidth) text.setScale(maxWidth / text.width);
    };
    const unsubscribe = LanguageManager.subscribe(refresh);
    text.once('destroy', unsubscribe);
    refresh();
    return text;
}

export function localizedLabel(scene, x, y, key, width = 220, height = 42, depth = 6) {
    scene.add.rectangle(x, y, width, height, 0x713719).setStrokeStyle(2, 0xe8bd70).setDepth(depth);
    return bindText(scene.add.text(x, y, '', {
        fontSize: '24px', color: '#fff5df', align: 'center'
    }).setOrigin(0.5).setDepth(depth + 0.1), key, {}, width - 16);
}

// Cover lettering baked into an image while retaining its original hit area/handler.
export function localizeButton(scene, image, key) {
    return localizedLabel(scene, image.x, image.y, key,
        image.displayWidth, Math.min(image.displayHeight, 50), image.depth + 0.1);
}

export function createLanguageSelector(scene, y = 920) {
    const center = scene.scale.width / 2;
    const depth = 50;
    scene.add.rectangle(center, y, 440, 90, 0x312017, 0.96)
        .setStrokeStyle(2, 0xe8bd70).setDepth(depth);
    bindText(scene.add.text(center, y - 25, '', { fontSize: '20px', color: '#fff5df' })
        .setOrigin(0.5).setDepth(depth + 1), 'language');
    const buttons = LANGUAGES.map((item, index) => {
        const x = center + (index - 1) * 140;
        const bg = scene.add.rectangle(x, y + 14, 132, 36, 0x713719)
            .setInteractive({ useHandCursor: true }).setDepth(depth + 1)
            .setName(`language-${item.code}`);
        const label = scene.add.text(x, y + 14, item.label, {
            fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(depth + 2);
        bg.on('pointerdown', () => LanguageManager.setLanguage(item.code));
        return { item, bg, label };
    });
    const refresh = () => buttons.forEach(({ item, bg, label }) => {
        const selected = item.code === LanguageManager.language;
        bg.setFillStyle(selected ? 0x986125 : 0x713719).setStrokeStyle(selected ? 2 : 1, 0xffdc91);
        label.setColor(selected ? '#fff2ab' : '#ffffff');
    });
    const unsubscribe = LanguageManager.subscribe(refresh);
    scene.events.once('shutdown', unsubscribe);
    refresh();
}
