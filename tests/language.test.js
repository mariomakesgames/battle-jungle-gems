import test from 'node:test';
import assert from 'node:assert/strict';
import LanguageManager, { LANGUAGES, resolveLanguage } from '../src/i18n/LanguageManager.js';
import { PHOTO_LEVELS } from '../src/beauty/PhotoRules.js';

test('first visit defaults to English regardless of browser locale and preserves explicit choices', async () => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let saved;
    globalThis.localStorage = { getItem: () => saved };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'zh-CN' } });
    try {
        const first = (await import('../src/i18n/LanguageManager.js?first-english')).default;
        assert.equal(first.language, 'en');
        saved = 'zh-CN';
        const selected = (await import('../src/i18n/LanguageManager.js?saved-chinese')).default;
        assert.equal(selected.language, 'zh-CN');
        saved = 'invalid';
        const invalid = (await import('../src/i18n/LanguageManager.js?invalid-saved')).default;
        assert.equal(invalid.language, 'en');
    } finally {
        delete globalThis.localStorage;
        if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
        else delete globalThis.navigator;
    }
});

test('browser locale mapping and unsupported locale fallback', () => {
    assert.equal(resolveLanguage('zh-TW'), 'zh-CN');
    assert.equal(resolveLanguage('vi-VN'), 'vi');
    assert.equal(resolveLanguage('en-US'), 'en');
    assert.equal(resolveLanguage('fr-FR'), 'en');
});

test('all languages translate gameplay labels and interpolate level numbers', () => {
    for (const { code } of LANGUAGES) {
        LanguageManager.setLanguage(code);
        for (const key of ['start', 'classicMode', 'settings', 'language', 'moves', 'score', 'missions', 'restart', 'aiDuel', 'duelRules', 'duelYourTurn', 'duelBonus', 'duelWin', 'duelTutorial', 'duelTutorialIntroTitle', 'duelTutorialSwapBody', 'duelTutorialBonusBody', 'duelTutorialAIBody', 'duelTutorialFinishBody']) {
            assert.notEqual(LanguageManager.t(key), key);
        }
        assert.ok(LanguageManager.t('stage', { level: 12 }).includes('12'));
        for (const key of ['onlineDuel', 'onlineRules', 'linkCreate', 'linkJoin', 'linkHostSteps', 'linkGuestSteps', 'linkDisconnected']) {
            assert.notEqual(LanguageManager.t(key), key);
        }
        for (const key of ['baddieGalleryEmpty', 'baddieGallery', 'baddieContinue', 'baddieMapError', 'baddieLevels', 'beautyMode', 'beautyIntro', 'beautyGarden', 'beautySunset', 'beautyCity', 'beautyRules', 'beautyUnlocked', 'beautyImageError']) {
            assert.notEqual(LanguageManager.t(key), key);
        }
        for (const key of [...PHOTO_LEVELS.map(level => level.title), 'beautyPreviousPage', 'beautyNextPage', 'beautyPage']) {
            assert.notEqual(LanguageManager.t(key, { page: 4, total: 4 }), key);
        }
        for (const key of ['beautyClassicLevelGoal', 'beautyCurrentScore', 'beautyGoalProgress', 'beautyClassicRules', 'beautyLevelError', 'beautyGoalRemaining',
            ...['Red', 'Green', 'Blue', 'Purple', 'Yellow', 'Orange', 'Stone', 'Rope'].map(type => `beautyGoal${type}`)]) {
            assert.notEqual(LanguageManager.t(key), key);
        }
    }
});

test('invalid selection preserves language; listeners can unsubscribe', () => {
    LanguageManager.setLanguage('en');
    let changes = 0;
    const unsubscribe = LanguageManager.subscribe(() => changes++);
    assert.equal(LanguageManager.setLanguage('invalid'), false);
    assert.equal(LanguageManager.language, 'en');
    LanguageManager.setLanguage('zh-CN');
    assert.equal(changes, 1);
    unsubscribe();
    LanguageManager.setLanguage('vi');
    assert.equal(changes, 1);
});

test('switching works when browser storage is unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.equal(LanguageManager.setLanguage('zh-CN'), true);
    assert.equal(LanguageManager.t('start'), '开始游戏');
    delete globalThis.localStorage;
});
