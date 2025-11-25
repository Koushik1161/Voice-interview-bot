/**
 * Voice
 *
 * "True simplicity is derived from so much more than just
 *  the absence of clutter and ornamentation. It's about
 *  bringing order to complexity."
 *
 * — Jony Ive
 */

class Voice {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.stream = null;
        this.connected = false;
        this.audio = new Audio();
        this.audio.autoplay = true;

        this.orb = document.getElementById('orbWrapper');
        this.status = document.getElementById('status');
        this.transcript = document.getElementById('transcript');
        this.toast = document.getElementById('toast');
        this.loading = document.getElementById('loading');
        this.questions = document.getElementById('questions');

        this.init();
    }

    init() {
        // Reveal
        setTimeout(() => this.loading.classList.add('hidden'), 800);

        // Events
        this.orb.addEventListener('click', () => this.toggle());
        this.orb.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Question buttons
        document.querySelectorAll('.question').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                if (prompt && this.connected && this.dc?.readyState === 'open') {
                    this.sendTextMessage(prompt);
                } else if (!this.connected) {
                    this.showToast('Connect first to ask questions');
                }
            });
        });
    }

    setState(state) {
        // Remove all states
        this.orb.classList.remove('active', 'speaking');
        this.status.classList.remove('active');

        switch (state) {
            case 'idle':
                this.setStatus('Tap to connect');
                break;

            case 'connecting':
                this.setStatus('Connecting');
                this.status.classList.add('active');
                break;

            case 'listening':
                this.orb.classList.add('active');
                this.setStatus('Listening');
                this.status.classList.add('active');
                break;

            case 'processing':
                this.orb.classList.add('active');
                this.setStatus('Thinking');
                this.status.classList.add('active');
                break;

            case 'speaking':
                this.orb.classList.add('active', 'speaking');
                this.setStatus('Speaking');
                this.status.classList.add('active');
                break;
        }
    }

    setStatus(text) {
        this.status.textContent = text;
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('visible');
        setTimeout(() => this.toast.classList.remove('visible'), 3000);
    }

    addMessage(role, text) {
        if (!text?.trim()) return;

        this.transcript.classList.add('visible');

        const msg = document.createElement('div');
        msg.className = 'message';
        msg.innerHTML = `
            <div class="message-role">${role === 'user' ? 'You' : 'Koushik'}</div>
            <div class="message-text">${this.escape(text)}</div>
        `;

        // Keep only last 2 messages for minimal UI
        while (this.transcript.children.length >= 2) {
            this.transcript.removeChild(this.transcript.firstChild);
        }

        this.transcript.appendChild(msg);
    }

    escape(str) {
        const el = document.createElement('div');
        el.textContent = str;
        return el.innerHTML;
    }

    sendTextMessage(text) {
        if (!this.dc || this.dc.readyState !== 'open') return;

        // Create conversation item with text
        const event = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text }]
            }
        };

        this.dc.send(JSON.stringify(event));
        this.dc.send(JSON.stringify({ type: 'response.create' }));
        this.addMessage('user', text);
        this.setState('processing');
    }

    async toggle() {
        if (this.connected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            this.setState('connecting');

            // Get ephemeral token
            const res = await fetch('/api/session', { method: 'POST' });

            if (!res.ok) {
                throw new Error('Unable to connect');
            }

            const { ephemeralKey } = await res.json();

            // Get microphone
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create peer connection
            this.pc = new RTCPeerConnection();

            this.pc.ontrack = e => {
                this.audio.srcObject = e.streams[0];
            };

            const [track] = this.stream.getAudioTracks();
            this.pc.addTrack(track, this.stream);

            // Data channel
            this.dc = this.pc.createDataChannel('oai-events');
            this.dc.onmessage = e => this.onMessage(JSON.parse(e.data));

            // Create offer
            await this.pc.setLocalDescription();

            // Connect
            const offerRes = await fetch('https://api.openai.com/v1/realtime/calls', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ephemeralKey}`,
                    'Content-Type': 'application/sdp'
                },
                body: this.pc.localDescription.sdp
            });

            if (!offerRes.ok) {
                throw new Error('Voice service unavailable');
            }

            const answer = await offerRes.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answer });

            // Wait for connection
            await this.waitForConnection();

            this.connected = true;
            this.setState('listening');

        } catch (err) {
            console.error('Connection error:', err);
            this.showToast(err.message);
            this.setState('idle');
            this.cleanup();
        }
    }

    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);

            const check = () => {
                const state = this.pc?.connectionState;
                if (state === 'connected') {
                    clearTimeout(timeout);
                    resolve();
                } else if (state === 'failed' || state === 'disconnected') {
                    clearTimeout(timeout);
                    reject(new Error('Connection failed'));
                }
            };

            this.pc.onconnectionstatechange = check;
            check();
        });
    }

    onMessage(msg) {
        switch (msg.type) {
            case 'input_audio_buffer.speech_started':
                this.setState('listening');
                break;

            case 'input_audio_buffer.speech_stopped':
                this.setState('processing');
                break;

            case 'conversation.item.input_audio_transcription.completed':
                if (msg.transcript) {
                    this.addMessage('user', msg.transcript);
                }
                break;

            case 'response.output_audio_transcript.done':
                if (msg.transcript) {
                    this.addMessage('assistant', msg.transcript);
                }
                break;

            case 'response.output_audio.delta':
                this.setState('speaking');
                break;

            case 'response.output_audio.done':
            case 'response.done':
                this.setState('listening');
                break;

            case 'error':
                console.error('API error:', msg.error);
                this.showToast('An error occurred');
                break;
        }
    }

    disconnect() {
        if (this.dc?.readyState === 'open') {
            try {
                this.dc.send(JSON.stringify({ type: 'response.cancel' }));
            } catch (e) {}
        }

        this.cleanup();
        this.connected = false;
        this.setState('idle');
        this.transcript.classList.remove('visible');
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }

        if (this.dc) {
            this.dc.close();
            this.dc = null;
        }

        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        if (this.audio.srcObject) {
            this.audio.srcObject = null;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => new Voice());
