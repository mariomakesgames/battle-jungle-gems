import test from 'node:test';
import assert from 'node:assert/strict';
import LanguageManager, { LANGUAGES, resolveLanguage } from '../src/i18n/LanguageManager.js';

test('browser locale mapping and unsupported locale fallback', () => {
    assert.equal(resolveLanguage('zh-TW'), 'zh-CN');
    assert.equal(resolveLanguage('vi-VN'), 'vi');
    assert.equal(resolveLanguage('en-US'), 'en');
    assert.equal(resolveLanguage('fr-FR'), 'en');
});

test('all languages translate gameplay labels and interpolate level numbers', () => {
    for (const { code } of LANGUAGES) {
        LanguageManager.setLanguage(code);
        for (const key of ['start', 'settings', 'language', 'moves', 'score', 'missions', 'restart', 'aiDuel', 'duelRules', 'duelYourTurn', 'duelBonus', 'duelWin', 'duelTutorial', 'duelTutorialIntroTitle', 'duelTutorialSwapBody', 'duelTutorialBonusBody', 'duelTutorialAIBody', 'duelTutorialFinishBody']) {
            assert.notEqual(LanguageManager.t(key), key);
        }
        assert.ok(LanguageManager.t('stage', { level: 12 }).includes('12'));
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
