import Phaser from 'phaser';
import LanguageManager, { LANGUAGES } from '../i18n/LanguageManager';
import { PeerLink } from '../network/PeerLink';

export class OnlineLobbyScene extends Phaser.Scene {
    constructor() { super('OnlineLobbyScene'); }

    init(data = {}) {
        this.returnScene = data.returnScene || 'TitleScene';
        this.peer = null;
        this.transferred = false;
        this.role = null;
        this.attempt = (this.attempt || 0) + 1;
        this.generating = false;
        this.statusKey = 'linkChoose';
    }

    create() {
        this.sound.stopAll();
        this.labels = [];
        this.root = document.createElement('section');
        this.root.className = 'jungle-online-lobby';
        this.root.setAttribute('aria-label', LanguageManager.t('onlineDuel'));
        const styles = document.createElement('style');
        styles.textContent = `
            .jungle-online-lobby { position:fixed;inset:0;z-index:30;overflow:auto;background:#10261c;color:#fff5df;
                font:18px Arial,sans-serif;padding:24px;box-sizing:border-box; }
            .jungle-online-lobby .card { max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:18px; }
            .jungle-online-lobby h1 { margin:18px 0 0;font-size:32px;text-align:center; }
            .jungle-online-lobby p { margin:0;line-height:1.55;white-space:pre-line; }
            .jungle-online-lobby button { background:#713719;color:#fff5df;border:2px solid #e8bd70;border-radius:10px;
                padding:13px 16px;font:inherit;cursor:pointer;min-height:48px; }
            .jungle-online-lobby button:disabled { opacity:.45;cursor:default; }
            .jungle-online-lobby .choices { display:flex;gap:14px; }
            .jungle-online-lobby .choices button { flex:1; }
            .jungle-online-lobby .connection { display:flex;flex-direction:column;gap:12px; }
            .jungle-online-lobby textarea { display:block;width:100%;height:115px;resize:vertical;background:#092017;
                color:#fff5df;border:1px solid #bfa064;border-radius:8px;padding:12px;box-sizing:border-box;
                font:14px monospace;user-select:text;-webkit-user-select:text;-webkit-touch-callout:default; }
            .jungle-online-lobby label { display:block;margin-bottom:8px; }
            .jungle-online-lobby .status { padding:14px;border:1px solid #e8bd70;border-radius:8px;background:#244a37;
                line-height:1.5;white-space:pre-line; }
            .jungle-online-lobby select { color:#fff5df;background:#244a37;padding:8px;font:inherit;border-radius:6px; }
            .jungle-online-lobby [hidden] { display:none !important; }
        `;
        this.root.append(styles);
        this.card = this.element('div', this.root);
        this.card.className = 'card';
        this.element('h1', this.card, 'onlineDuel');
        this.element('p', this.card, 'linkIntro');
        const choices = this.element('div', this.card);
        choices.className = 'choices';
        this.hostButton = this.button(choices, 'linkCreate', 'host', () => this.choose('host'));
        this.guestButton = this.button(choices, 'linkJoin', 'guest', () => this.choose('guest'));
        this.status = this.element('div', this.card);
        this.status.className = 'status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.connection = this.element('div', this.card);
        this.connection.className = 'connection';
        this.connection.hidden = true;
        this.instructions = this.element('p', this.connection);
        this.outputGroup = this.element('div', this.connection);
        this.outputGroup.hidden = true;
        this.outputLabel = this.element('label', this.outputGroup);
        this.outputLabel.htmlFor = 'webrtc-output';
        this.output = this.element('textarea', this.outputGroup);
        this.output.id = 'webrtc-output';
        this.output.readOnly = true;
        this.output.spellcheck = false;
        this.button(this.outputGroup, 'linkCopy', 'copy', () => this.copyCode());
        this.inputLabel = this.element('label', this.connection);
        this.inputLabel.htmlFor = 'webrtc-input';
        this.codeInput = this.element('textarea', this.connection);
        this.codeInput.id = 'webrtc-input';
        this.codeInput.spellcheck = false;
        this.connectButton = this.button(this.connection, 'linkConnect', 'connect', () => this.connect());
        this.element('p', this.card, 'linkNetworkHelp');
        const language = this.element('select', this.card);
        language.setAttribute('aria-label', LanguageManager.t('language'));
        for (const item of LANGUAGES) {
            const option = this.element('option', language);
            option.value = item.code;
            option.textContent = item.label;
        }
        language.value = LanguageManager.language;
        language.addEventListener('change', () => LanguageManager.setLanguage(language.value));
        this.button(this.card, 'duelBack', 'back', () => this.scene.start(this.returnScene));
        // A fullscreen canvas wrapper hides DOM siblings outside its top layer.
        this.mountOverlay = () => {
            const parent = document.fullscreenElement || document.webkitFullscreenElement || document.body;
            parent.append(this.root);
        };
        document.addEventListener('fullscreenchange', this.mountOverlay);
        document.addEventListener('webkitfullscreenchange', this.mountOverlay);
        this.mountOverlay();
        this.unsubscribe = LanguageManager.subscribe(() => this.refresh());
        this.events.once('shutdown', this.cleanup, this);
        this.refresh();
    }

    element(tag, parent, key) {
        const node = document.createElement(tag);
        parent.append(node);
        if (key) this.labels.push([node, key]);
        return node;
    }

    button(parent, key, action, handler) {
        const node = this.element('button', parent, key);
        node.type = 'button';
        node.dataset.action = action;
        node.addEventListener('click', handler);
        return node;
    }

    refresh() {
        for (const [node, key] of this.labels) node.textContent = LanguageManager.t(key);
        this.status.textContent = LanguageManager.t(this.statusKey);
        this.instructions.textContent = this.role ? LanguageManager.t(this.role === 'host' ? 'linkHostSteps' : 'linkGuestSteps') : '';
        this.inputLabel.textContent = LanguageManager.t(this.role === 'host' ? 'linkReplyInput' : 'linkInviteInput');
        this.outputLabel.textContent = LanguageManager.t(this.role === 'host' ? 'linkInviteOutput' : 'linkReplyOutput');
        this.connectButton.textContent = LanguageManager.t(this.role === 'host' ? 'linkConnect' : 'linkMakeReply');
        this.connectButton.disabled = this.generating;
        this.hostButton.disabled = this.generating;
        this.guestButton.disabled = this.generating;
        this.codeInput.placeholder = LanguageManager.t('linkPaste');
    }

    setStatus(key) { this.statusKey = key; this.refresh(); }

    createPeer(host) {
        this.peer?.close();
        this.peer = new PeerLink(host);
        this.peer.on('open', () => {
            this.transferred = true;
            this.scene.start('OnlineDuelScene', { peer: this.peer, host, returnScene: this.returnScene });
        });
        this.peer.on('state', state => {
            if (['failed', 'closed', 'disconnected'].includes(state)) this.setStatus('linkFailed');
        });
        return this.peer;
    }

    async choose(role) {
        const attempt = ++this.attempt;
        this.peer?.close();
        this.role = role;
        this.codeInput.value = '';
        this.output.value = '';
        this.outputGroup.hidden = true;
        this.connection.hidden = false;
        this.root.dataset.role = role;
        this.generating = role === 'host';
        this.setStatus(role === 'host' ? 'linkGenerating' : 'linkPasteInvite');
        if (role !== 'host') return;
        try {
            const code = await this.createPeer(true).offer();
            if (attempt !== this.attempt) return;
            this.output.value = code;
            this.outputGroup.hidden = false;
            this.setStatus('linkSendInvite');
        } catch (error) {
            if (attempt === this.attempt) this.setStatus(this.errorKey(error));
        } finally {
            if (attempt === this.attempt) { this.generating = false; this.refresh(); }
        }
    }

    errorKey(error) {
        return ['linkInvalidCode', 'linkUnsupported', 'linkConfigError'].includes(error.message) ? error.message : 'linkFailed';
    }

    async connect() {
        if (this.generating) return;
        const attempt = this.attempt;
        this.generating = true;
        this.setStatus('linkConnecting');
        try {
            if (this.role === 'host') await this.peer.accept(this.codeInput.value);
            else {
                const code = await this.createPeer(false).answer(this.codeInput.value);
                if (attempt !== this.attempt) return;
                this.output.value = code;
                this.outputGroup.hidden = false;
                this.setStatus('linkSendReply');
            }
        } catch (error) {
            if (attempt === this.attempt) this.setStatus(this.errorKey(error));
        } finally {
            if (attempt === this.attempt) { this.generating = false; this.refresh(); }
        }
    }

    async copyCode() {
        try {
            await navigator.clipboard.writeText(this.output.value);
            this.setStatus('linkCopied');
        } catch {
            this.output.focus();
            this.output.select();
            this.setStatus('linkCopyManual');
        }
    }

    cleanup() {
        this.attempt++;
        this.unsubscribe?.();
        document.removeEventListener('fullscreenchange', this.mountOverlay);
        document.removeEventListener('webkitfullscreenchange', this.mountOverlay);
        this.root.remove();
        // Remove lobby listeners before handing the live connection to gameplay.
        this.peer?.events.get('open')?.clear();
        this.peer?.events.get('state')?.clear();
        if (!this.transferred) this.peer?.close();
    }
}
