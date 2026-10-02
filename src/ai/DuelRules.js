// Scores and turn ownership stay fixed until the entire swap/cascade settles.
export class DuelRules {
    constructor(rounds = 10) {
        this.totalRounds = rounds;
        this.round = 1;
        this.actor = 'player';
        this.swapsLeft = 2;
        this.scores = { player: 0, ai: 0 };
        this.pending = null;
        this.finished = false;
    }

    begin(actor) {
        if (this.finished || this.pending || actor !== this.actor) return false;
        this.pending = { actor, accepted: false };
        return true;
    }

    accept(special) {
        if (!this.pending || this.pending.accepted) return false;
        this.pending.accepted = true;
        this.swapsLeft += special ? 0 : -1; // Spend one, earn one on a special match.
        return true;
    }

    addScore(points) {
        if (this.pending?.accepted && Number.isFinite(points) && points > 0) {
            this.scores[this.pending.actor] += points;
        }
    }

    settle() {
        if (!this.pending) return;
        const accepted = this.pending.accepted;
        this.pending = null;
        if (!accepted || this.swapsLeft > 0) return;
        if (this.actor === 'player') this.actor = 'ai';
        else if (this.round === this.totalRounds) this.finished = true;
        else { this.actor = 'player'; this.round++; }
        this.swapsLeft = this.finished ? 0 : 2;
    }

    get winner() {
        if (!this.finished) return null;
        const difference = this.scores.player - this.scores.ai;
        return difference === 0 ? 'draw' : difference > 0 ? 'player' : 'ai';
    }
}
