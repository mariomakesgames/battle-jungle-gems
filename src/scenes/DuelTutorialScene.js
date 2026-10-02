import Phaser from 'phaser';
import LanguageManager from '../i18n/LanguageManager';
import { bindText } from '../ui/LocalizedUI';

export const DUEL_TUTORIAL_KEY = 'jungle-gems-ai-tutorial-v1';
export function needsDuelTutorial() {
    try { return localStorage.getItem(DUEL_TUTORIAL_KEY) !== 'seen'; }
    catch { return true; }
}

// Practice has its own sprites and counters; the real duel stays paused.
export class DuelTutorialScene extends Phaser.Scene {
    constructor() { super('DuelTutorialScene'); }

    create() {
        this.step = 0;
        this.completed = false;
        this.busy = false;
        this.selected = null;
        this.downCell = null;
        this.practice = this.add.container(0, 0);
        this.add.rectangle(288, 512, 576, 1024, 0x08120d, 0.9).setInteractive();
        this.add.rectangle(288, 512, 524, 824, 0x213d30).setStrokeStyle(3, 0xe8bd70);
        this.title = this.text(288, 163, '', 30, 470);
        this.progress = this.text(288, 208, 'duelTutorialStep', 18,
            470, () => ({ step: this.step + 1, total: 5 }));
        this.body = this.text(288, 280, '', 21, 462);
        this.counter = this.text(288, 355, '', 23, 460);
        this.feedback = this.text(288, 613, '', 22, 460);
        this.hint = this.text(288, 675, '', 18, 460);
        this.nextButton = this.add.rectangle(288, 766, 290, 54, 0x986125)
            .setStrokeStyle(2, 0xffdc91).setInteractive({ useHandCursor: true }).setName('tutorial-next');
        this.nextLabel = this.text(288, 766, 'duelTutorialNext', 24, 270);
        this.nextButton.on('pointerdown', () => this.next());
        this.add.rectangle(288, 852, 230, 44, 0x345344)
            .setInteractive({ useHandCursor: true }).setName('tutorial-skip')
            .on('pointerdown', () => this.close());
        this.text(288, 852, 'duelTutorialSkip', 21, 210);
        // Add practice last, above the card but below the independently positioned labels.
        this.children.bringToTop(this.practice);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointerup', this.onUp, this);
        this.unsubscribe = LanguageManager.subscribe(() => this.refresh());
        this.events.once('shutdown', () => {
            this.unsubscribe();
            this.input.off('pointerdown', this.onDown, this);
            this.input.off('pointerup', this.onUp, this);
        });
        this.showStep();
    }

    text(x, y, key, size, width, params = {}) {
        const label = this.add.text(x, y, '', {
            fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color: '#fff5df',
            align: 'center', wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 7,
        }).setOrigin(0.5);
        if (key) bindText(label, key, params, width);
        return label;
    }

    showStep() {
        this.practice.removeAll(true);
        this.completed = this.step === 0 || this.step === 4;
        this.busy = false;
        this.selected = null;
        this.downCell = null;
        this.swaps = this.step === 2 ? 1 : 2;
        this.targetCol = this.step === 2 ? 2 : 1;
        this.matchCount = this.step === 2 ? 4 : 3;
        this.practice.add(this.add.rectangle(288, 477, 412, 208, 0x18291f).setStrokeStyle(2, 0xb48b53));
        const rows = this.step === 2
            ? [['red', 'red', 'green', 'red', 'purple'], ['blue', 'purple', 'red', 'orange', 'green']]
            : [['red', 'green', 'red', 'purple', 'blue'], ['purple', 'red', 'green', 'blue', 'orange']];
        this.gems = rows.map((row, r) => row.map((color, c) => {
            const gem = this.add.image(144 + c * 72, 437 + r * 80, `gem_${color}`)
                .setDisplaySize(58, 58);
            this.practice.add(gem);
            return gem;
        }));
        if (this.step === 1 || this.step === 2) {
            for (let r = 0; r < 2; r++) {
                this.practice.add(this.add.rectangle(144 + this.targetCol * 72, 437 + r * 80, 66, 66)
                    .setStrokeStyle(3, 0xffdf82).setFillStyle(0, 0));
            }
            this.practice.add(this.add.text(144 + this.targetCol * 72, 477, '↕', {
                fontFamily: 'Arial, sans-serif', fontSize: '30px', color: '#ffdf82',
            }).setOrigin(0.5));
        }
        if (this.step === 3) {
            this.practice.add(this.add.rectangle(288, 477, 412, 208, 0x08120d, 0.4));
            this.time.delayedCall(900, () => this.demoSwap());
        }
        this.refresh();
    }

    refresh() {
        const names = ['Intro', 'Swap', 'Bonus', 'AI', 'Finish'];
        const name = names[this.step];
        this.title.setText(LanguageManager.t(`duelTutorial${name}Title`));
        this.body.setText(LanguageManager.t(`duelTutorial${name}Body`));
        this.progress.setText(LanguageManager.t('duelTutorialStep', { step: this.step + 1, total: 5 }));
        this.counter.setText(LanguageManager.t(this.step === 3 ? 'duelTutorialAICounter' : 'duelSwaps', { count: this.swaps }));
        this.feedback.setText(LanguageManager.t(this.completed && (this.step === 1 || this.step === 2 || this.step === 3)
            ? this.step === 2 ? 'duelTutorialBonusDone' : this.step === 3 ? 'duelTutorialAIDone' : 'duelTutorialSwapDone'
            : 'duelTutorialPractice'));
        this.hint.setText(LanguageManager.t(this.step === 1 || this.step === 2 ? 'duelTutorialGesture' : 'duelTutorialNoScore'));
        this.nextLabel.setText(LanguageManager.t(this.step === 4 ? 'duelTutorialPlay' : 'duelTutorialNext'));
        this.nextButton.setFillStyle(this.completed ? 0x986125 : 0x345344);
        this.nextButton.setAlpha(this.completed ? 1 : 0.5);
        this.nextLabel.setAlpha(this.completed ? 1 : 0.5);
    }

    cellAt(pointer) {
        for (let r = 0; r < 2; r++) {
            const gem = this.gems[r][this.targetCol];
            if (Math.abs(pointer.x - gem.x) <= 33 && Math.abs(pointer.y - gem.y) <= 33) return r;
        }
        return null;
    }

    onDown(pointer) {
        this.downCell = !this.busy && !this.completed && (this.step === 1 || this.step === 2) ? this.cellAt(pointer) : null;
    }

    onUp(pointer) {
        if (this.downCell === null || this.busy || this.completed) return;
        const from = this.downCell, to = this.cellAt(pointer);
        this.downCell = null;
        if (to === null) return;
        if (to !== from || (this.selected !== null && this.selected !== to)) this.demoSwap();
        else {
            this.selected = this.selected === to ? null : to;
            for (let r = 0; r < 2; r++) this.gems[r][this.targetCol].setTint(r === this.selected ? 0xffdf82 : 0xffffff);
        }
    }

    demoSwap() {
        if (this.busy || this.completed) return;
        this.busy = true;
        this.selected = null;
        const a = this.gems[0][this.targetCol], b = this.gems[1][this.targetCol];
        a.clearTint(); b.clearTint();
        this.tweens.add({ targets: a, y: 517, duration: 320 });
        this.tweens.add({ targets: b, y: 437, duration: 320, onComplete: () => {
            this.gems[0][this.targetCol] = b;
            this.gems[1][this.targetCol] = a;
            this.swaps -= 1;
            if (this.step === 2) this.swaps += 1;
            const matches = this.gems[0].slice(0, this.matchCount);
            for (const gem of matches) gem.setTint(0xffdf82);
            this.tweens.add({ targets: matches, alpha: 0, duration: 450, delay: 250, onComplete: () => {
                this.completed = true;
                this.busy = false;
                this.refresh();
            }});
        }});
    }

    next() {
        if (!this.completed || this.busy) return;
        if (this.step === 4) this.close();
        else { this.step++; this.showStep(); }
    }

    close() {
        try { localStorage.setItem(DUEL_TUTORIAL_KEY, 'seen'); } catch { /* Still close without storage. */ }
        this.scene.stop();
        this.scene.resume('AIDuelScene');
    }
}
