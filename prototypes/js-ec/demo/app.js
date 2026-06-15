/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * js-ec demo front end. Drives the JavaScript EC client (/ec) directly: the
 * browser speaks aMule's EC protocol itself; relay.py only tunnels the bytes.
 */

import { AmuleClient, SearchType } from '/ec/index.js';

/* ---- helpers ---------------------------------------------------------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fmtBytes(n) {
	n = Number(n) || 0;
	if (n < 1024) return n + ' B';
	const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
	do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
	return (Math.round(n * 100) / 100) + ' ' + u[i];
}
const fmtSpeed = (n) => (Number(n) > 0 ? fmtBytes(n) + '/s' : '–');
const wsUrl = () => (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ec';

/* ---- state ------------------------------------------------------------ */
const VIEWS = ['status', 'transfers', 'search'];
const REFRESH_MS = 4000;
const state = { client: null, view: 'status', status: null, busy: false };
let timer = null;
const viewEl = () => $('#view');

function setConn(s, bad) {
	const el = $('#conn');
	if (bad) { el.className = 'conn bad'; el.innerHTML = '<span class="dot"></span> ' + esc(bad); return; }
	if (!s) { el.className = 'conn'; el.textContent = 'offline'; return; }
	el.className = 'conn ok';
	const dl = (s.downloadSpeed) || 0; const up = (s.uploadSpeed) || 0;
	el.innerHTML = `<span class="dot"></span> ↓${esc(fmtBytes(dl))}/s ↑${esc(fmtBytes(up))}/s`;
}
function banner(msg) {
	const ex = $('.banner', viewEl()); if (ex) ex.remove();
	if (msg) viewEl().insertAdjacentHTML('afterbegin', `<div class="banner">⚠ ${esc(msg)}</div>`);
}

/* ---- connect screen --------------------------------------------------- */
function renderConnect(error) {
	$('#tabbar').hidden = true;
	viewEl().innerHTML = `
	<div class="connect">
		<h1>aMule over EC, in JavaScript</h1>
		<p>The browser speaks aMule's EC protocol directly through the
		   <code>relay.py</code> byte bridge. Enter your aMule <b>EC password</b>.</p>
		<div class="card">
			${error ? `<div class="banner">⚠ ${esc(error)}</div>` : ''}
			<div class="field">
				<label>EC password</label>
				<input id="pw" type="password" placeholder="ECPassword" autofocus />
			</div>
			<button id="go" class="primary" style="width:100%">Connect</button>
			<p class="muted" style="margin:.6rem 0 0">Relay → <code>${esc(wsUrl())}</code><br/>
			   (aMule host/port are configured on the relay.)</p>
		</div>
	</div>`;
	const connect = async () => {
		const pw = $('#pw').value;
		const btn = $('#go'); btn.disabled = true; btn.textContent = 'Connecting…';
		try {
			state.client = await AmuleClient.connect(wsUrl(), pw);
			start();
		} catch (e) {
			renderConnect(e.message);
		}
	};
	$('#go').onclick = connect;
	$('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
}

/* ---- views ------------------------------------------------------------ */
function statusLabel(f) {
	if (f.stopped) return 'Paused';
	if (f.speed > 0 || f.sourceXferCount > 0) return 'Downloading';
	if (f.sizeFull > 0 && f.sizeDone >= f.sizeFull) return 'Complete';
	return 'Waiting';
}

function renderStatus(s) {
	if (!s) return '<p class="empty">No data.</p>';
	const c = s.connection || {}; const srv = c.server;
	const pill = (on, label) => `<span class="pill ${on ? 'on' : 'off'}">${esc(label)}</span>`;
	const id = !c.ed2kId ? 'Not connected' : (c.ed2kId < 16777216 ? 'LowID ' : 'HighID ') + c.ed2kId;
	return `
	<h2 class="section">Connection</h2>
	<div class="card">
		<div class="row"><span class="grow">eD2k</span>${pill(c.ed2kConnected, c.ed2kConnecting ? 'Connecting' : c.ed2kConnected ? 'Connected' : 'Offline')}</div>
		<div class="kv"><span>ID</span><span class="mono">${esc(id)}</span></div>
		${srv ? `<div class="kv"><span>Server</span><span>${esc(srv.name || srv.address)}</span></div>
		<div class="kv"><span>Address</span><span class="mono">${esc(srv.address)}</span></div>
		<div class="kv"><span>Users / Files</span><span class="mono">${esc(Number(srv.users || 0).toLocaleString())} / ${esc(Number(srv.files || 0).toLocaleString())}</span></div>` : ''}
	</div>
	<div class="card">
		<div class="row"><span class="grow">Kademlia</span>${pill(c.kadConnected, c.kadConnected ? (c.kadFirewalled ? 'Firewalled' : 'Connected') : 'Offline')}</div>
		<div class="kv"><span>Nodes</span><span class="mono">${esc(Number(s.kadNodes || 0).toLocaleString())}</span></div>
	</div>
	<h2 class="section">Speed</h2>
	<div class="card"><div class="row">
		<div class="grow"><div class="muted">Download</div><div class="big mono">${esc(fmtSpeed(s.downloadSpeed))}</div></div>
		<div class="grow"><div class="muted">Upload</div><div class="big mono">${esc(fmtSpeed(s.uploadSpeed))}</div></div>
	</div></div>
	<h2 class="section">Network</h2>
	<div class="card">
		<div class="kv"><span>eD2k users</span><span class="mono">${esc(Number(s.ed2kUsers || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Kad users</span><span class="mono">${esc(Number(s.kadUsers || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Shared files</span><span class="mono">${esc(Number(s.sharedFileCount || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Session ▲▼</span><span class="mono">${esc(fmtBytes(s.totalSent))} / ${esc(fmtBytes(s.totalReceived))}</span></div>
	</div>`;
}

function renderTransfers(list) {
	const add = `<div class="card"><div class="field inline">
		<input id="ed2k" type="text" placeholder="Paste an ed2k:// link" />
		<button id="ed2k-add" class="shrink primary">Add</button>
	</div></div>`;
	if (!list.length) return add + '<p class="empty">No downloads.</p>';
	const rows = list.map((f) => {
		const pct = f.sizeFull > 0 ? Math.min(100, Math.round(f.sizeDone * 1000 / f.sizeFull) / 10) : 0;
		const label = statusLabel(f);
		const bar = f.stopped ? 'paused' : (pct >= 100 ? 'done' : '');
		return `<div class="item" data-hash="${esc(f.hash)}">
			<div class="name">${esc(f.name || '(unnamed) ' + (f.hash || '').slice(0, 12))}</div>
			<div class="progress"><i class="${bar}" style="width:${pct}%"></i></div>
			<div class="meta">
				<span><b>${pct}%</b> of ${esc(fmtBytes(f.sizeFull))}</span>
				<span>${esc(fmtSpeed(f.speed))}</span>
				<span><b>${esc(label)}</b></span>
				<span>src ${esc(f.sourceCount)} (${esc(f.sourceXferCount)})</span>
			</div>
			<div class="actions">
				<button data-act="resume">▶</button>
				<button data-act="pause">⏸</button>
				<button data-act="cancel" class="danger">✕</button>
			</div>
		</div>`;
	}).join('');
	return add + rows;
}

function renderSearch(files) {
	const form = `<div class="card">
		<div class="field"><input id="q" type="text" placeholder="Search the eD2k / Kad network…" /></div>
		<div class="field inline">
			<select id="stype" class="shrink" style="width:auto">
				<option value="global">Global</option><option value="kad">Kad</option><option value="local">Local</option>
			</select>
			<button id="go" class="primary">Search</button>
		</div>
		<div id="note" class="muted" style="font-size:.8rem"></div>
	</div>`;
	if (!files) return form;
	if (!files.length) return form + '<p class="empty">No results.</p>';
	const rows = files.map((f) => {
		const queued = f.downloadStatus && f.downloadStatus !== 'NEW';
		return `<div class="item" data-hash="${esc(f.hash)}">
			<div class="name">${esc(f.name)}</div>
			<div class="meta"><span><b>${esc(fmtBytes(f.sizeFull))}</b></span><span>sources ${esc(f.sourceCount)}</span>${queued ? `<span>${esc(f.downloadStatus)}</span>` : ''}</div>
			<div class="actions"><button data-act="get" class="primary" ${queued ? 'disabled' : ''}>${queued ? 'In queue' : 'Download'}</button></div>
		</div>`;
	}).join('');
	return form + rows;
}

/* ---- polling + rendering --------------------------------------------- */
async function refresh(force) {
	if (!state.client || (state.busy && !force)) return;
	state.busy = true;
	try {
		const s = await state.client.getStats();
		state.status = s; setConn(s);
		if (state.view === 'status') viewEl().innerHTML = renderStatus(s);
		else if (state.view === 'transfers') {
			const draft = $('#ed2k') ? $('#ed2k').value : '';
			viewEl().innerHTML = renderTransfers(await state.client.getDownloadQueue());
			if (draft) $('#ed2k').value = draft;
		}
		banner(null);
	} catch (e) {
		setConn(null, 'error'); banner('EC error: ' + e.message);
	} finally { state.busy = false; }
}

async function doSearch() {
	const q = $('#q').value.trim(); if (!q) return;
	$('#note').textContent = 'Searching…';
	const typeMap = { global: SearchType.GLOBAL, kad: SearchType.KAD, local: SearchType.LOCAL };
	try {
		const files = await state.client.searchSync(q, typeMap[$('#stype').value] || SearchType.GLOBAL, {});
		viewEl().innerHTML = renderSearch(files);
		$('#q').value = q;
		$('#note').textContent = files.length + ' result' + (files.length === 1 ? '' : 's');
	} catch (e) { $('#note').textContent = 'Search failed: ' + e.message; }
}

/* ---- events ----------------------------------------------------------- */
viewEl().addEventListener('click', async (ev) => {
	const btn = ev.target.closest('button'); if (!btn || !state.client) return;
	if (btn.id === 'ed2k-add') {
		const inp = $('#ed2k'); const link = inp.value.trim(); if (!link) return;
		btn.disabled = true;
		try { await state.client.addEd2kLink(link); inp.value = ''; await refresh(true); }
		catch (e) { banner(e.message); } finally { btn.disabled = false; }
		return;
	}
	if (btn.id === 'go') { doSearch(); return; }
	const item = btn.closest('.item'); if (!item) return;
	const hash = item.dataset.hash; const act = btn.dataset.act;
	if (act === 'get') {
		btn.disabled = true; btn.textContent = '…';
		try { await state.client.downloadSearchResult(hash); btn.textContent = 'Queued'; }
		catch (e) { banner(e.message); btn.disabled = false; btn.textContent = 'Download'; }
		return;
	}
	if (act === 'cancel' && !confirm('Cancel and delete this download?')) return;
	try { await state.client.sendDownloadCommand(hash, act); await refresh(true); }
	catch (e) { banner(e.message); }
});
viewEl().addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter' && ev.target.id === 'q') { ev.preventDefault(); doSearch(); }
	if (ev.key === 'Enter' && ev.target.id === 'ed2k') { ev.preventDefault(); $('#ed2k-add').click(); }
});

/* ---- routing + lifecycle --------------------------------------------- */
function setView(v) {
	state.view = VIEWS.includes(v) ? v : 'status';
	document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === state.view));
	if (state.view === 'search') viewEl().innerHTML = renderSearch(null);
	else { viewEl().innerHTML = '<p class="muted" style="padding:1rem">Loading…</p>'; refresh(true); }
}
window.addEventListener('hashchange', () => { if (state.client) setView(location.hash.replace('#', '')); });

function start() {
	$('#tabbar').hidden = false;
	setView(location.hash.replace('#', '') || 'status');
	clearInterval(timer);
	timer = setInterval(() => { if (!document.hidden && state.view !== 'search') refresh(false); }, REFRESH_MS);
}

renderConnect();
