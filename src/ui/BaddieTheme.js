export const BADDIE = {
    ink: 0x100f16, panel: 0x1c1923, raised: 0x2b2533, rose: 0xb65d80,
    pink: 0xf2b2c8, gold: 0xbba18a, text: '#fff0f4', muted: '#a89aa9',
    body: 'Arial, "Microsoft YaHei", sans-serif',
    font: 'UTMCookies, "Microsoft YaHei", sans-serif', heading: 'NABILA, "Microsoft YaHei", serif',
};

export const FASHION_PIECES = ['red', 'green', 'blue', 'purple', 'yellow', 'orange'];
const SYMBOLS = ['cell', 'bomb', 'stripe', 'color_bomb', 'color_bomb_op', 'stone_1', 'stone_2', 'rope',
    'node_lock', 'node_unlock', 'booster_hammer', 'booster_swap', 'booster_rocket', 'booster_shuffle', 'brand'];

export function queueBaddieTheme(scene) {
    if (!scene.textures.exists('baddie_studio')) scene.load.image('baddie_studio', 'assets/images/baddie/studio.webp');
    for (const color of FASHION_PIECES) {
        if (!scene.textures.exists(`baddie_${color}`)) scene.load.image(`baddie_${color}`, `assets/images/baddie/pieces-editorial/${color}.png`);
    }
    for (const name of SYMBOLS) {
        const size = name.startsWith('node_') ? 128 : 256;
        if (!scene.textures.exists(`baddie_${name}`)) scene.load.svg(`baddie_${name}`, `assets/images/baddie/${name}.svg`, { width: size, height: size });
    }
}

export function fashionBackground(scene, dim = .22) {
    if (!scene.textures.exists('baddie_atelier')) {
        const texture = scene.textures.createCanvas('baddie_atelier', 576, 1024);
        const ctx = texture.context;
        const base = ctx.createLinearGradient(0, 0, 576, 1024);
        base.addColorStop(0, '#251b2a'); base.addColorStop(.5, '#100f16'); base.addColorStop(1, '#19131d');
        ctx.fillStyle = base; ctx.fillRect(0, 0, 576, 1024);
        const glow = ctx.createRadialGradient(430, 80, 0, 430, 80, 500);
        glow.addColorStop(0, 'rgba(158,78,110,.16)'); glow.addColorStop(1, 'rgba(158,78,110,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 576, 1024);
        // Small distant lights add atmosphere without competing with the board.
        for (let i = 0; i < 24; i++) {
            const x = (i * 173 + 21) % 576, y = (i * 281 + 41) % 1024;
            if (x > 95 && x < 481) continue;
            ctx.fillStyle = 'rgba(244,189,216,.22)';
            ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 1.8 : 1, 0, Math.PI * 2); ctx.fill();
        }
        texture.refresh();
    }
    return scene.add.image(288, 512, 'baddie_atelier').setDisplaySize(576, 1024).setDepth(-50);
}

export function fashionPanel(scene, x, y, width, height, depth = 0) {
    return scene.add.rectangle(x, y, width, height, BADDIE.panel, .96)
        .setStrokeStyle(1, BADDIE.gold, .65).setDepth(depth);
}

export function fashionHover(button, base = BADDIE.raised) {
    button.on('pointerover', () => button.setFillStyle(base === BADDIE.rose ? 0xd9789b : BADDIE.rose));
    button.on('pointerout', () => button.setFillStyle(base));
    return button;
}

// Non-interactive surfaces keep board gestures and button hit areas unobstructed.
export function fashionCard(scene, x, y, width, height, radius = 16) {
    const card = scene.add.graphics();
    card.fillStyle(0x000000, .24).fillRoundedRect(x - width / 2, y - height / 2 + 5, width, height, radius);
    card.fillStyle(BADDIE.panel, .97).fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    card.lineStyle(1, 0xc2a4b7, .12).strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    return card;
}


export function gameLettering(text, title = false) {
    const small = parseFloat(text.style.fontSize) < 19;
    return text.setFontFamily(small ? BADDIE.body : BADDIE.font)
        .setColor(title ? '#ffe5b5' : '#fff0f6')
        .setStroke('#301529', small ? 0 : title ? 4 : 2)
        .setShadow(0, 2, '#08050e', 2, true, true);
}
