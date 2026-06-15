/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * WebSocket transport. The browser cannot open a raw TCP socket, so EC bytes
 * travel over a WebSocket to the minimal Python relay (relay.py), which pipes
 * them to aMule's EC TCP port. This class handles packet framing: WebSocket
 * messages are arbitrary TCP chunks, so incoming bytes are buffered and split
 * into complete EC packets.
 *
 * EC is strictly request/response over a single connection; sends are
 * serialized (one in flight) and responses are matched FIFO.
 */

import { writePacket, frame, decodePayload } from './packet.js';
import { concatBytes } from './encoding.js';

export class WebSocketTransport {
	constructor(url) {
		this.url = url;
		this.ws = null;
		this.buf = new Uint8Array(0);
		this.waiters = [];
		this.draining = false;
		this.closed = false;
	}

	connect() {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(this.url);
			ws.binaryType = 'arraybuffer';
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error('WebSocket error (is the relay running?)'));
			ws.onclose = () => { this.closed = true; this._failAll(new Error('connection closed')); };
			ws.onmessage = (ev) => {
				this.buf = concatBytes([this.buf, new Uint8Array(ev.data)]);
				this._drain();
			};
			this.ws = ws;
		});
	}

	/** Send a packet and resolve with the next response packet. */
	send(packet) {
		if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('transport not connected'));
		}
		return new Promise((resolve, reject) => {
			this.waiters.push({ resolve, reject });
			this.ws.send(writePacket(packet));
		});
	}

	close() {
		this.closed = true;
		if (this.ws) try { this.ws.close(); } catch (e) { /* ignore */ }
	}

	async _drain() {
		if (this.draining) return;
		this.draining = true;
		try {
			for (;;) {
				let fr;
				try { fr = frame(this.buf); } catch (e) { this._failAll(e); return; }
				if (!fr) break;
				this.buf = this.buf.slice(fr.consumed);
				const w = this.waiters.shift();
				try {
					const pkt = await decodePayload(fr.flags, fr.accepts, fr.payloadRaw);
					if (w) w.resolve(pkt);
				} catch (e) {
					if (w) w.reject(e);
				}
			}
		} finally {
			this.draining = false;
		}
		// bytes may have arrived during an await; re-drain if a full frame waits
		if (this._hasFrame()) this._drain();
	}

	_hasFrame() {
		try { return frame(this.buf) !== null; } catch (e) { return true; }
	}

	_failAll(err) {
		const ws = this.waiters;
		this.waiters = [];
		for (const w of ws) w.reject(err);
	}
}
