const MAX_SIGNAL = 200000;
const MAX_PACKET = 20000;

export async function encodeSignal(description) {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: description.type, sdp: description.sdp }));
    let payload = bytes, prefix = 'JG1.';
    if (typeof CompressionStream !== 'undefined') {
        payload = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
        prefix = 'JG1z.';
    }
    let binary = '';
    for (let offset = 0; offset < payload.length; offset += 8192) binary += String.fromCharCode(...payload.slice(offset, offset + 8192));
    return prefix + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function decodeSignal(code, expectedType) {
    code = String(code).trim();
    if (code.length > MAX_SIGNAL || !/^JG1z?\.[A-Za-z0-9_-]+$/.test(code)) throw new Error('linkInvalidCode');
    const [prefix, body] = code.split('.');
    let bytes;
    try {
        bytes = Uint8Array.from(atob(body.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
        if (prefix === 'JG1z') {
            if (typeof DecompressionStream === 'undefined') throw new Error();
            const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
            const chunks = [];
            let length = 0;
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                length += value.length;
                if (length > MAX_SIGNAL) { await reader.cancel(); throw new Error(); }
                chunks.push(value);
            }
            bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        }
        const result = JSON.parse(new TextDecoder().decode(bytes));
        if (result.type !== expectedType || typeof result.sdp !== 'string' || !result.sdp.startsWith('v=0') || result.sdp.length > MAX_SIGNAL) throw new Error();
        return { type: result.type, sdp: result.sdp };
    } catch { throw new Error('linkInvalidCode'); }
}

export function iceConfiguration() {
    const configured = import.meta.env?.VITE_WEBRTC_ICE_SERVERS;
    if (configured) {
        try {
            const iceServers = JSON.parse(configured);
            if (!Array.isArray(iceServers)) throw new Error();
            return { iceServers };
        } catch { throw new Error('linkConfigError'); }
    }
    return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
}

export class PeerLink {
    constructor(host, config = iceConfiguration()) {
        if (!globalThis.RTCPeerConnection) throw new Error('linkUnsupported');
        this.host = host;
        this.events = new Map();
        this.backlog = [];
        this.closed = false;
        this.healthy = true;
        this.pc = new RTCPeerConnection(config);
        this.pc.onconnectionstatechange = () => this.emit('state', this.pc.connectionState);
        this.pc.ondatachannel = event => {
            if (event.channel.label === 'jungle-gems') this.attach(event.channel);
            else event.channel.close();
        };
        if (host) this.attach(this.pc.createDataChannel('jungle-gems', { ordered: true }));
    }

    get connected() {
        return !this.closed && this.healthy && this.channel?.readyState === 'open' && !['disconnected', 'failed', 'closed'].includes(this.pc.connectionState);
    }

    on(event, listener) {
        if (!this.events.has(event)) this.events.set(event, new Set());
        this.events.get(event).add(listener);
        if (event === 'message') {
            const pending = this.backlog.splice(0);
            queueMicrotask(() => { for (const packet of pending) if (!this.closed) listener(packet); });
        }
        return () => this.events.get(event)?.delete(listener);
    }

    emit(event, value) { for (const listener of this.events.get(event) || []) listener(value); }

    attach(channel) {
        this.channel = channel;
        channel.onopen = () => {
            this.lastMessage = Date.now();
            this.heartbeat = setInterval(() => {
                if (Date.now() - this.lastMessage > 15000 && this.healthy) {
                    this.healthy = false;
                    this.emit('state', 'disconnected');
                }
                this.send({ type: '__ping' });
            }, 3000);
            this.emit('open');
        };
        channel.onclose = () => { clearInterval(this.heartbeat); this.emit('state', 'closed'); };
        channel.onerror = () => this.emit('state', 'failed');
        channel.onmessage = event => {
            if (typeof event.data !== 'string' || event.data.length > MAX_PACKET) return;
            let packet;
            try { packet = JSON.parse(event.data); } catch { return; }
            if (!packet || typeof packet !== 'object') return;
            this.lastMessage = Date.now();
            if (!this.healthy) { this.healthy = true; this.emit('state', 'connected'); }
            if (packet.type === '__ping') { this.send({ type: '__pong' }); return; }
            if (packet.type === '__pong') return;
            if (this.events.get('message')?.size) this.emit('message', packet);
            else { this.backlog.push(packet); if (this.backlog.length > 16) this.backlog.shift(); }
        };
    }

    send(packet) {
        if (this.closed || this.channel?.readyState !== 'open') return false;
        const encoded = JSON.stringify(packet);
        if (encoded.length > MAX_PACKET || this.channel.bufferedAmount > 1000000) return false;
        try { this.channel.send(encoded); return true; } catch { return false; }
    }

    async gather() {
        if (this.pc.iceGatheringState === 'complete') return;
        await new Promise(resolve => {
            const finish = () => { clearTimeout(timer); this.pc.removeEventListener('icegatheringstatechange', changed); resolve(); };
            const changed = () => { if (this.pc.iceGatheringState === 'complete' || this.closed) finish(); };
            // Return the candidates collected so far if a STUN service is unreachable.
            const timer = setTimeout(finish, 10000);
            this.pc.addEventListener('icegatheringstatechange', changed);
        });
        if (this.closed) throw new Error('linkCancelled');
    }

    async offer() {
        await this.pc.setLocalDescription(await this.pc.createOffer());
        await this.gather();
        return encodeSignal(this.pc.localDescription);
    }

    async answer(code) {
        await this.pc.setRemoteDescription(await decodeSignal(code, 'offer'));
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        await this.gather();
        return encodeSignal(this.pc.localDescription);
    }

    async accept(code) { await this.pc.setRemoteDescription(await decodeSignal(code, 'answer')); }

    close() {
        if (this.closed) return;
        this.closed = true;
        clearInterval(this.heartbeat);
        this.events.clear();
        this.channel?.close();
        this.pc.close();
        this.backlog.length = 0;
    }
}
