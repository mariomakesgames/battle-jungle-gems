import { SOUND_PATHS, SOUND_KEYS } from './SoundAssets.js';

// Assets are queued only when their screen is first opened. Shared keys use Phaser's cache.
export const ASSET_GROUPS = {
    theme1: {
        images: [
            ['playground1_border', 'assets/images/map/playground-border.png'],
            ['playground1_background', 'assets/images/map/playground.png'],
        ],
    },
    theme2: {
        images: [
            ['playground2_border', 'assets/images/map/playground2_border.png'],
            ['playground2_background', 'assets/images/map/playground2_background.png'],
        ],
    },
    pause: {
        images: [
            ['pause_ui', 'assets/images/ui/pause/UI.png'],
            ['pause_continue', 'assets/images/ui/pause/countinue.png'],
            ['pause_quit', 'assets/images/ui/pause/quit.png'],
            ['pause_restart', 'assets/images/ui/pause/Restart.png'],
            ['pause_bar', 'assets/images/ui/pause/Bar.png'],
            ['pause_music', 'assets/images/ui/pause/music.png'],
            ['pause_sound', 'assets/images/ui/pause/sound.png'],
        ],
    },
    win: {
        images: [
            ['victory_background', 'assets/images/ui/victory/background1.png'],
            ['star_off', 'assets/images/ui/star_off.png'],
            ['star_on', 'assets/images/ui/star_on.png'],
            ['pause_continue', 'assets/images/ui/pause/countinue.png'],
            ['pause_restart', 'assets/images/ui/pause/Restart.png'],
        ],
        audio: SOUND_PATHS.filter(sound => sound.key === SOUND_KEYS.WIN_GAME),
    },
    lose: {
        images: [
            ['lose_background', 'assets/images/ui/lose/background1.png'],
            ['star_off', 'assets/images/ui/star_off.png'],
            ['star_on', 'assets/images/ui/star_on.png'],
            ['pause_continue', 'assets/images/ui/pause/countinue.png'],
            ['pause_restart', 'assets/images/ui/pause/Restart.png'],
        ],
        audio: SOUND_PATHS.filter(sound => sound.key === SOUND_KEYS.LOSE_GAME),
    },
    mapEffects1: {
        images: [
            ['vfx_steam_1_1_bot_nuoc', 'assets/images/map/vfx/steam/1.1. Bot nuoc.png'],
            ['vfx_steam_1_2_bot_nuoc', 'assets/images/map/vfx/steam/1.2. Bot nuoc.png'],
            ['vfx_steam_1_3_bot_nuoc', 'assets/images/map/vfx/steam/1.3. Bot nuoc.png'],
            ['vfx_steam_1_4_bot_nuoc', 'assets/images/map/vfx/steam/1.4.  Bot nuoc.png'],
            ['steam_cay_chuoi1', 'assets/images/map/vfx/steam/cay_chuoi1.png'],
            ['steam_cay_chuoi2', 'assets/images/map/vfx/steam/cay_chuoi2.png'],
            ['steam_coc_go', 'assets/images/map/vfx/steam/coc_go.png'],
            ['vfx_steam_10_mat_nuoc_loang_1', 'assets/images/map/vfx/steam/10. Mat nuoc loang 1.png'],
            ['vfx_steam_11_mat_nuoc_loang_1', 'assets/images/map/vfx/steam/11. Mat nuoc loang 1.png'],
            ['vfx_steam_13_mat_nuoc_loang_3', 'assets/images/map/vfx/steam/13. Mat nuoc loang 3.png'],
            ['vfx_steam_15_nuoc_chay_chan_thac', 'assets/images/map/vfx/steam/15. Nuoc chay chan thac.png'],
            ['vfx_steam_16_nuoc_chay_chan_thac', 'assets/images/map/vfx/steam/16. nuoc chay chan thac.png'],
            ['vfx_steam_17_nuoc_loang_chan_thac', 'assets/images/map/vfx/steam/17. Nuoc loang chan thac.png'],
            ['vfx_steam_3_nuoc_dau_ngon_thac', 'assets/images/map/vfx/steam/3. Nuoc dau ngon thac.png'],
            ['vfx_steam_4_nuoc_dau_ngon_thac', 'assets/images/map/vfx/steam/4. Nuoc dau ngon thac.png'],
            ['vfx_steam_5_giot_nuoc_ngon_thac', 'assets/images/map/vfx/steam/5. Giot nuoc ngon thac.png'],
            ['vfx_steam_6_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/6. Nuoc chay giua ngon thac.png'],
            ['vfx_steam_7_nuoc_chay_giua_angon_thac', 'assets/images/map/vfx/steam/7. Nuoc chay giua angon thac.png'],
            ['vfx_steam_8_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/8. Nuoc chay giua ngon thac.png'],
            ['vfx_steam_9_nuoc_chay_giua_ngon_thac', 'assets/images/map/vfx/steam/9. Nuoc chay giua ngon thac.png'],
            ['vfx_steam_mat_nuoc_loang_2', 'assets/images/map/vfx/steam/Mat nuoc loang 2.png'],
            ['vfx_steam_mat_nuoc_loang_4', 'assets/images/map/vfx/steam/Mat nuoc loang 4.png'],
            ['vfx_steam_thac_nuoc', 'assets/images/map/vfx/steam/Thac nuoc.png'],
            ['vfx_decanter_dong_nuoc_chinh', 'assets/images/map/vfx/decanter/Dong nuoc chinh.png'],
            ['vfx_decanter_giot_nuoc_1', 'assets/images/map/vfx/decanter/Giot nuoc 1.png'],
            ['vfx_decanter_giot_nuoc_2', 'assets/images/map/vfx/decanter/Giot nuoc 2.png'],
            ['vfx_decanter_giot_nuoc_3', 'assets/images/map/vfx/decanter/Giot nuoc 3.png'],
            ['vfx_decanter_giot_nuoc_4', 'assets/images/map/vfx/decanter/Giot nuoc 4.png'],
            ['vfx_decanter_nuoc_chay_1', 'assets/images/map/vfx/decanter/Nuoc chay 1.png'],
            ['vfx_decanter_nuoc_chay_2', 'assets/images/map/vfx/decanter/Nuoc chay 2.png'],
            ['vfx_decanter_nuoc_chay_3', 'assets/images/map/vfx/decanter/Nuoc chay 3.png'],
            ['vfx_decanter_nuoc_chay_4', 'assets/images/map/vfx/decanter/Nuoc chay 4.png'],
            ['vfx_bambo_cay_tre', 'assets/images/map/vfx/bambo/Cay tre.png'],
            ['vfx_bambo_mat_sau_quai_trong_dong', 'assets/images/map/vfx/bambo/Mat sau quai trong dong.png'],
            ['vfx_bambo_quai_trong_dong_1', 'assets/images/map/vfx/bambo/Quai trong dong 1.png'],
            ['vfx_bambo_quai_trong_dong_2', 'assets/images/map/vfx/bambo/Quai trong dong 2.png'],
            ['vfx_banana_buong_chuoi', 'assets/images/map/vfx/banana/Buong chuoi.png'],
            ['vfx_banana_cay_chuoi', 'assets/images/map/vfx/banana/Cay chuoi.png'],
        ],
        audio: [
            { key: 'stream', path: 'assets/sounds/optimized/stream.m4a' },
        ],
    },
    mapEffects2: {
        images: [
            ['map_part2_cay_chuoi', 'assets/images/map/vfx/map_part2/Cay chuoi.png'],
            ['map_part2_chum_bap', 'assets/images/map/vfx/map_part2/Chum bap.png'],
            ['map_part2_la_cay', 'assets/images/map/vfx/map_part2/La cay.png'],
            ['map_part2_fish_1_1', 'assets/images/map/vfx/map_part2/fish/1.1.png'],
            ['map_part2_fish_1_2', 'assets/images/map/vfx/map_part2/fish/1.2.png'],
            ['map_part2_fish_2_1', 'assets/images/map/vfx/map_part2/fish/2.1.png'],
            ['map_part2_fish_2_2', 'assets/images/map/vfx/map_part2/fish/2.2.png'],
            ['map_part2_fish_3_1', 'assets/images/map/vfx/map_part2/fish/3.1.png'],
            ['map_part2_fish_3_2', 'assets/images/map/vfx/map_part2/fish/3.2.png'],
            ['map_part2_fish_4_1', 'assets/images/map/vfx/map_part2/fish/4.1.png'],
            ['map_part2_fish_4_2', 'assets/images/map/vfx/map_part2/fish/4.2.png'],
            ['map_part2_fish_4_3', 'assets/images/map/vfx/map_part2/fish/4.3.png'],
            ['map_part2_fish_4_4', 'assets/images/map/vfx/map_part2/fish/4.4.png'],
            ['map_part2_steam_base', 'assets/images/map/vfx/map_part2/steam/base.png'],
            ['map_part2_steam_0', 'assets/images/map/vfx/map_part2/steam/0. Bot nuoc.png'],
            ['map_part2_steam_1', 'assets/images/map/vfx/map_part2/steam/1. Nuoc ban len.png'],
            ['map_part2_steam_2', 'assets/images/map/vfx/map_part2/steam/2. Nuoc chay 1.png'],
            ['map_part2_steam_3', 'assets/images/map/vfx/map_part2/steam/3. Nuoc chay 2.png'],
            ['map_part2_steam_4', 'assets/images/map/vfx/map_part2/steam/4. Nuoc chay 3.png'],
            ['map_part2_steam_5', 'assets/images/map/vfx/map_part2/steam/5. Nuoc chay 4.png'],
        ],
        audio: [
            { key: 'monkey', path: 'assets/sounds/maps/monkey.mp3' },
            { key: 'water-drop', path: 'assets/sounds/maps/water-drop.m4a' },
        ],
    },
    mapArea2: { images: [['map_part2', 'assets/images/map/map_part_2.png']] },
    mapMusic: { images: [], audio: [{ key: 'background', path: 'assets/sounds/maps/background.ogg' }] },

    gameplay: {
        images: [
            ['map1_background', 'assets/images/map/map1-background.webp'],
            ['cell', 'assets/images/map/cell.png'],
            ['progress_bar_background', 'assets/images/ui/progress_bar_background.png'],
            ['progress_bar_fill', 'assets/images/ui/progress_bar_fill.png'],
            ['star_off_pgb', 'assets/images/ui/star_off_pgb.png'],
            ['star_on_pgb', 'assets/images/ui/star_on_pgb.png'],
        ],
        audio: SOUND_PATHS.filter(sound => ![SOUND_KEYS.SPIN_BACKGROUND_EFFECT, SOUND_KEYS.WIN_GAME, SOUND_KEYS.LOSE_GAME].includes(sound.key)),
    },
    settings: {
        images: [
            ['setting_ui', 'assets/images/ui/setting/Bang UI Setting.png'],
            ['facebook', 'assets/images/ui/setting/facebook.png'],
            ['share', 'assets/images/ui/setting/share.png'],
            ['information', 'assets/images/ui/setting/information.png'],
            ['email', 'assets/images/ui/setting/email.png'],
            ['notice', 'assets/images/ui/setting/notice.png'],
            ['pause_bar', 'assets/images/ui/pause/Bar.png'],
            ['pause_music', 'assets/images/ui/pause/music.png'],
            ['pause_sound', 'assets/images/ui/pause/sound.png'],
        ],
    },
    levelReview: {
        images: [
            ['level_review_ui', 'assets/images/ui/level_review/UI1.png'],
            ['play_button', 'assets/images/ui/level_review/play.png'],
            ['booster_background', 'assets/images/ui/level_review/booster_background.png'],
        ],
    },
    shop: {
        images: [
            ['shop_background', 'assets/images/ui/shop/background.png'],
            ['shop_price_background', 'assets/images/ui/shop/price_background.png'],
            ['shop_discount_40', 'assets/images/ui/shop/discount_40.png'],
            ['next_button', 'assets/images/ui/shop/next.png'],
            ['previous_button', 'assets/images/ui/shop/previous.png'],
            ['heart_2', 'assets/images/ui/shop/heart_2.png'],
            ['coin_x2', 'assets/images/ui/shop/coin_x2.png'],
            ['shuffle_2', 'assets/images/ui/shop/shuffle_2.png'],
            ['rocket_2', 'assets/images/ui/shop/rocket_2.png'],
            ['hammer_2', 'assets/images/ui/shop/hammer_2.png'],
            ['swap_2', 'assets/images/ui/shop/swap_2.png'],
            ['booster_rocket_2', 'assets/images/ui/shop/rocket_2.png'],
        ],
        audio: SOUND_PATHS.filter(sound => sound.key === SOUND_KEYS.SPIN_COLLECT),
    },
    spin: {
        images: [
            ['spin_background', 'assets/images/ui/spin/background.png'],
            ['spin_button', 'assets/images/ui/spin/button.png'],
            ['spin_pointer', 'assets/images/ui/spin/pointer.png'],
            ['spin_board', 'assets/images/ui/spin/board.png'],
            ['spin_center', 'assets/images/ui/spin/center.png'],
            ['spin_led', 'assets/images/ui/spin/led.png'],
            ['heart_2', 'assets/images/ui/shop/heart_2.png'],
            ['coin_x2', 'assets/images/ui/shop/coin_x2.png'],
            ['shuffle_2', 'assets/images/ui/shop/shuffle_2.png'],
            ['rocket_2', 'assets/images/ui/shop/rocket_2.png'],
            ['hammer_2', 'assets/images/ui/shop/hammer_2.png'],
            ['swap_2', 'assets/images/ui/shop/swap_2.png'],
            ['booster_rocket_2', 'assets/images/ui/shop/rocket_2.png'],
        ],
        audio: SOUND_PATHS.filter(sound => [SOUND_KEYS.SPIN_BACKGROUND_EFFECT, SOUND_KEYS.SPIN_COLLECT].includes(sound.key)),
    },
    friends: {
        images: [
            ['friend_ui_bg', 'assets/images/ui/friend/UI.png'],
            ['friend_item_bg', 'assets/images/ui/friend/item_background.png'],
            ['friend_cover', 'assets/images/ui/friend/cover.png'],
            ['friend_decor', 'assets/images/ui/friend/friend_decor.png'],
            ['friend_msg_icon', 'assets/images/ui/friend/message_icon.png'],
            ['friend_select_all_text', 'assets/images/ui/friend/select_all.png'],
            ['friend_send_button', 'assets/images/ui/friend/send_all.png'],
            ['friend_tick', 'assets/images/ui/friend/tick.png'],
            ['avt1', 'assets/images/ui/friend/avt1.png'],
            ['avt2', 'assets/images/ui/friend/avt2.png'],
            ['avt3', 'assets/images/ui/friend/avt3.png'],
            ['avt4', 'assets/images/ui/friend/avt4.png'],
        ],
    },
};

export function queueAssetGroup(scene, name) {
    const group = ASSET_GROUPS[name];
    if (!group) throw new Error(`Unknown asset group: ${name}`);
    let queued = 0;
    for (const [key, path] of group.images) {
        if (!scene.textures.exists(key)) {
            scene.load.image(key, path);
            queued++;
        }
    }
    for (const { key, path } of group.audio || []) {
        if (!scene.cache.audio.exists(key)) {
            scene.load.audio(key, path);
            queued++;
        }
    }
    return queued;
}
