/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * High-level async aMule EC client (port of jamule AmuleClient.kt). Ties the
 * WebSocket transport, request builders and response parsers together, does
 * the salt/MD5 authentication handshake, and exposes friendly methods. All
 * EC exchanges are serialized (aMule's core is a single connection).
 */

import { WebSocketTransport } from './transport.js';
import { hashPassword } from './md5.js';
import { EcPrefs } from './codes.js';
import * as req from './requests.js';
import { parseResponse } from './responses.js';

export const SearchType = req.SearchType;
export const DownloadCommand = req.DownloadCommand;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function hexToBytes(hex) {
	const m = hex.match(/../g) || [];
	return Uint8Array.from(m, (b) => parseInt(b, 16));
}

export class AmuleClient {
	constructor(transport) {
		this._t = transport;
		this._chain = Promise.resolve();
		this.version = null;
	}

	/** Open a WebSocket to the relay, authenticate, and return a ready client. */
	static async connect(wsUrl, password) {
		const transport = new WebSocketTransport(wsUrl);
		await transport.connect();
		const client = new AmuleClient(transport);
		try {
			await client._authenticate(password);
		} catch (e) {
			transport.close();
			throw e;
		}
		return client;
	}

	close() { this._t.close(); }

	// serialize every EC exchange behind a single chain
	_request(packet) {
		const p = this._chain.then(() => this._t.send(packet)).then(parseResponse);
		this._chain = p.then(() => {}, () => {});
		return p;
	}

	async _authenticate(password) {
		const salt = await this._request(req.saltRequest());
		if (salt.type === 'authFail') throw new Error('Authentication failed: ' + salt.reason);
		if (salt.type !== 'salt') throw new Error('Unable to get auth salt');
		const hashed = hashPassword(password, salt.salt);
		const ok = await this._request(req.authRequest(hashed));
		if (ok.type === 'authFail') throw new Error('Authentication failed: ' + ok.reason);
		if (ok.type !== 'authOk') throw new Error('Authentication failed');
		this.version = ok.version;
	}

	_check(r) { if (r.type === 'error') throw new Error(r.message); return r; }

	// --- stats / lists ---------------------------------------------------
	async getStats() { return this._check(await this._request(req.statsRequest())); }
	async getDownloadQueue() { return this._check(await this._request(req.downloadQueueRequest())).partFiles || []; }
	async getSharedFiles() { return this._check(await this._request(req.sharedFilesRequest())).files || []; }
	async getCategories() {
		const r = this._check(await this._request(req.getPreferencesRequest(EcPrefs.EC_PREFS_CATEGORIES)));
		return r.categories || [];
	}

	// --- commands (hashes are hex strings) -------------------------------
	async addEd2kLink(link) { return this._check(await this._request(req.addLinkRequest(link))); }
	async sendDownloadCommand(hashHex, command) {
		const op = req.DownloadCommand[command];
		if (op === undefined) throw new Error('Unknown command: ' + command);
		return this._check(await this._request(req.downloadCommandRequest(hexToBytes(hashHex), op)));
	}
	async downloadSearchResult(hashHex) {
		return this._check(await this._request(req.downloadSearchResultRequest(hexToBytes(hashHex))));
	}
	async setFileCategory(hashHex, category) {
		return this._check(await this._request(req.setFileCategoryRequest(hexToBytes(hashHex), category)));
	}

	// --- search ----------------------------------------------------------
	async searchStart(query, type = req.SearchType.GLOBAL, filters = {}) {
		const r = this._check(await this._request(req.searchRequest(query, type, filters)));
		return r.string;
	}
	async searchStatus() {
		const r = this._check(await this._request(req.searchStatusRequest()));
		return r.type === 'searchStatus' ? r.status : 0;
	}
	async searchResults() {
		return this._check(await this._request(req.searchResultsRequest())).files || [];
	}
	async searchStop() { return this._check(await this._request(req.searchStopRequest())); }

	/** Start a search and block until it finishes (mirrors jamule search_sync). */
	async searchSync(query, type = req.SearchType.GLOBAL, filters = {}, timeoutMs = 8000) {
		await this.searchStart(query, type, filters);
		// aMule returns 100% immediately if not given a moment: 15 polls of 200ms
		for (let i = 0; i < 15; i++) { await this.searchStatus(); await sleep(200); }
		const start = Date.now();
		while ((await this.searchStatus()) < 1.0) {
			if (Date.now() - start > timeoutMs) break;
			await sleep(100);
		}
		return this.searchResults();
	}
}
