import { AIDuelScene } from './AIDuelScene';
import { DuelRules } from '../ai/DuelRules';
import { DUEL_COLORS } from '../ai/ChooseMove';
import { validState, validMove, canAcceptRemoteMove, newMatchId } from '../network/DuelProtocol';
import LanguageManager from '../i18n/LanguageManager';

export class OnlineDuelScene extends AIDuelScene {
    constructor() { super('OnlineDuelScene'); }
    supportsTutorial() { return false; }

    init(data) {
        super.init(data);
        this.peer = data.peer;
        this.host = data.host;
        this.localActor = this.host ? 'player' : 'ai';
        this.connectionReady = false;
        this.awaiting = false;
        this.revision = 0;
        this.matchId = this.host ? newMatchId() : null;
        this.wantsRematch = false;
        this.remoteWantsRematch = false;
        this.resultPanel = null;
    }

    create() {
        super.create();
        this.notice.setFontSize(18).setWordWrapWidth(520, true).setAlign('center');
        this.removeMessage = this.peer.on('message', packet => this.receive(packet));
        this.removeState = this.peer.on('state', state => this.onPeerState(state));
        this.peer.send({ type: 'ready', version: 1 });
        if (!this.peer.connected) this.onPeerState('disconnected');
    }

    makeLabel(x, y, key, size, params = {}, width = 500) {
        const map = {
            aiDuel: 'onlineDuel', duelRules: 'onlineRules',
            duelYou: this.host ? 'onlineHostYou' : 'onlineHost',
            duelAI: this.host ? 'onlineGuest' : 'onlineGuestYou',
            duelBack: 'linkBackLobby', quit: 'linkBackLobby',
        };
        return super.makeLabel(x, y, map[key] || key, size, params, width);
    }

    refresh() {
        super.refresh();
        const unavailable = !this.connectionReady || !this.peer?.connected;
        this.boardDimmer.setVisible(unavailable || this.duel.actor !== this.localActor || this.awaiting);
        this.turnLabel.setText(LanguageManager.t(unavailable ? 'linkWaitingSync' : this.duel.actor === this.localActor ? 'duelYourTurn' : 'onlineTheirTurn'));
        this.notice.setText(LanguageManager.t(unavailable ? 'linkDisconnected' : this.awaiting ? 'linkWaitingSync' :
            this.noticeKey || (this.host ? 'onlineHostYou' : 'onlineGuestYou')));
    }

    canPlayerAct() {
        return this.connectionReady && this.peer.connected && !this.awaiting && !this.paused && !this.duel.finished &&
            !this.duel.pending && this.duel.actor === this.localActor && !this.board.boardBusy;
    }

    // The inherited gesture router calls the actor 'player'; map it to this peer.
    performMove(move) {
        if (!validMove(move) || !this.canPlayerAct()) return false;
        if (this.host) return this.executeMove(move, 'player');
        this.board.clearSelection();
        this.awaiting = true;
        if (!this.peer.send({ type: 'move', matchId: this.matchId, revision: this.revision, move })) this.onPeerState('disconnected');
        this.refresh();
        return true;
    }

    executeMove(move, actor) {
        const result = super.performMove(move, actor);
        if (result) this.publish(move);
        return result;
    }

    scheduleAI() {} // Both turns belong to people.

    onBusy(busy) {
        if (!this.host) return;
        super.onBusy(busy);
        if (!busy && this.board.consecutiveShuffleFailures < 3) this.publish();
    }

    onScore(points) { if (this.host) super.onScore(points); }

    snapshot(move = null) {
        return {
            type: 'state', version: 1, matchId: this.matchId, revision: this.revision,
            grid: this.board.grid.map(row => row.map(gem => gem?.value)),
            busy: this.board.boardBusy, paused: this.paused, move,
            duel: {
                actor: this.duel.actor, round: this.duel.round, totalRounds: 10,
                swapsLeft: this.duel.swapsLeft, finished: this.duel.finished,
                scores: { ...this.duel.scores },
            },
            special: this.noticeKey === 'duelBonus',
        };
    }

    publish(move = null) {
        this.revision++;
        if (!this.peer.send(this.snapshot(move))) this.onPeerState('disconnected');
    }

    receive(packet) {
        if (packet.type === 'ready' && packet.version === 1) {
            if (this.host && this.peer.connected) {
                this.connectionReady = true;
                this.publish();
                this.refresh();
            }
            return;
        }
        if (!this.host) {
            if (validState(packet)) this.applyState(packet);
            return;
        }
        if (!this.connectionReady || !this.peer.connected) return;
        if (packet.type === 'move') {
            const current = { matchId: this.matchId, revision: this.revision, actor: this.duel.actor,
                busy: this.board.boardBusy || !!this.duel.pending, paused: this.paused, finished: this.duel.finished };
            if (canAcceptRemoteMove(packet, current)) this.executeMove(packet.move, 'ai');
            else this.publish();
        } else if (packet.matchId === this.matchId && packet.type === 'pause') {
            if (packet.revision === this.revision && typeof packet.paused === 'boolean' && !this.board.boardBusy && !this.duel.finished) {
                this.applyPause(packet.paused);
            }
            this.publish();
        } else if (packet.matchId === this.matchId && packet.type === 'rematch' && this.duel.finished) {
            this.remoteWantsRematch = true;
            if (this.wantsRematch) this.newMatch();
        }
    }

    applyState(packet) {
        if (packet.revision <= this.revision) return;
        const newMatch = this.matchId !== packet.matchId;
        this.matchId = packet.matchId;
        this.revision = packet.revision;
        this.connectionReady = this.peer.connected;
        this.awaiting = false;
        if (newMatch) {
            this.resultPanel?.destroy(true);
            this.resultPanel = null;
            this.resultShown = false;
            this.wantsRematch = false;
        }
        const { actor, round, totalRounds, swapsLeft, finished, scores } = packet.duel;
        Object.assign(this.duel, { actor, round, totalRounds, swapsLeft, finished, scores: { ...scores }, pending: null });
        const values = [...DUEL_COLORS, 'bomb', 'color_bomb', 'stripe'];
        // Guests display the host's resolved board instead of rolling their own refills.
        this.tweens.killTweensOf(this.board.gems);
        this.board.loadLevel({ gridLayout: packet.grid.map(row => row.map(value => values.indexOf(value) + 1)), availableGems: DUEL_COLORS });
        this.board.boardBusy = packet.busy;
        this.input.enabled = true;
        this.noticeKey = packet.special ? 'duelBonus' : null;
        if (packet.busy && validMove(packet.move)) {
            const { r1, c1, r2, c2 } = packet.move;
            const a = this.board.grid[r1][c1].sprite, b = this.board.grid[r2][c2].sprite;
            const x = a.x, y = a.y;
            this.tweens.add({ targets: a, x: b.x, y: b.y, duration: 300 });
            this.tweens.add({ targets: b, x, y, duration: 300 });
        }
        this.applyPause(packet.paused);
        this.refresh();
        if (this.duel.finished) this.showResult();
    }

    showPause() {
        if (!this.connectionReady || this.board.boardBusy || this.duel.finished || this.paused) return;
        if (this.host) { this.applyPause(true); this.publish(); }
        else this.peer.send({ type: 'pause', matchId: this.matchId, revision: this.revision, paused: true });
    }

    resumePause() {
        if (this.host) { this.applyPause(false); this.publish(); }
        else this.peer.send({ type: 'pause', matchId: this.matchId, revision: this.revision, paused: false });
    }

    applyPause(paused) {
        if (paused && !this.paused) super.showPause();
        if (!paused && this.paused) super.resumePause();
    }

    onPeerState(state) {
        if (['disconnected', 'failed', 'closed'].includes(state)) {
            this.connectionReady = false;
            this.awaiting = false;
            this.refresh();
        } else if (state === 'connected' && this.peer.connected) {
            this.peer.send({ type: 'ready', version: 1 });
        }
    }

    showResult() {
        if (this.resultShown) return;
        this.resultShown = true;
        this.resultPanel = this.add.container(0, 0).setDepth(100);
        this.resultPanel.add(this.add.rectangle(288, 512, 576, 1024, 0x08120d, 0.9).setInteractive());
        const won = this.duel.winner === this.localActor;
        this.resultPanel.add(this.makeLabel(288, 385, this.duel.winner === 'draw' ? 'duelDraw' : won ? 'duelWin' : 'onlineLose', 38));
        this.resultPanel.add(this.makeLabel(288, 465, 'onlineFinalScore', 25, () => this.duel.scores));
        this.rematchLabel = this.makeLabel(288, 535, 'onlineRematchHint', 19);
        this.resultPanel.add(this.rematchLabel);
        this.button(288, 605, 260, 'onlineRematch', () => this.requestRematch(), 'online-rematch', this.resultPanel);
        this.button(288, 685, 260, 'linkBackLobby', () => this.leave(), 'duel-result-exit', this.resultPanel);
    }

    requestRematch() {
        if (!this.peer.connected || !this.duel.finished || this.wantsRematch) return;
        this.wantsRematch = true;
        this.rematchLabel.setText(LanguageManager.t('onlineWaitingRematch'));
        if (this.host) {
            if (this.remoteWantsRematch) this.newMatch();
        } else this.peer.send({ type: 'rematch', matchId: this.matchId });
    }

    newMatch() {
        this.resultPanel.destroy(true);
        this.resultPanel = null;
        this.duel = new DuelRules();
        this.matchId = newMatchId();
        this.wantsRematch = false;
        this.remoteWantsRematch = false;
        this.resultShown = false;
        this.noticeKey = null;
        this.loadBoard();
        this.refresh();
        this.publish();
    }

    leave() { this.scene.start('OnlineLobbyScene', { returnScene: this.returnScene }); }

    cleanup() {
        this.removeMessage?.();
        this.removeState?.();
        this.peer?.close();
        super.cleanup();
    }
}
