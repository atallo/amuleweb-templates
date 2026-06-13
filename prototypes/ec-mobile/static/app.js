/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * ec-mobile prototype front end -- vanilla JS, no framework, no build step.
 * Talks to the local Python proxy (server.py), which bridges to aMule over
 * the EC protocol via the vendored jamule client.
 */

'use strict';

/* ---- tiny helpers ------------------------------------------------------ */

const $ = (sel, root) => (root || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmtBytes(n) {
	n = Number(n) || 0;
	if (n < 1024) return n + ' B';
	const u = ['KB', 'MB', 'GB', 'TB'];
	let i = -1;
	do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
	return (Math.round(n * 100) / 100) + ' ' + u[i];
}
const fmtSpeed = (n) => (Number(n) > 0 ? fmtBytes(n) + '/s' : '–');

/* ---- API client: single-flight, serialized (aMule EC is single-conn) --- */

let _chain = Promise.resolve();
const serialize = (fn) => { const p = _chain.then(fn, fn); _chain = p.then(() => {}, () => {}); return p; };

async function rawGet(path) {
	const res = await fetch('/api/' + path);
	const data = await res.json();
	if (data && data.ok === false) throw new Error(data.error || 'request failed');
	return data;
}
async function rawPost(path, body) {
	const res = await fetch('/api/' + path, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body || {}),
	});
	const data = await res.json();
	if (data && data.ok === false) throw new Error(data.error || 'request failed');
	return data;
}
const apiGet = (path) => serialize(() => rawGet(path));
const apiPost = (path, body) => serialize(() => rawPost(path, body));

/* ---- shared state ------------------------------------------------------ */

const VIEWS = ['status', 'transfers', 'shared', 'search'];
const REFRESH_MS = 4000;
const state = { view: 'status', status: null, cats: [], sel: new Set(), busy: false };
let timer = null;

const viewEl = () => $('#view');

function setError(msg) {
	const el = viewEl();
	const existing = $('.banner', el);
	if (existing) existing.remove();
	if (msg) el.insertAdjacentHTML('afterbegin',
		`<div class="banner">⚠ ${esc(msg)}</div>`);
}

/* ---- connection indicator (top bar) ----------------------------------- */

function renderConn(s) {
	const el = $('#conn');
	if (!s) { el.className = 'conn'; el.innerHTML = '<span class="dot"></span> …'; return; }
	const ed = s.ed2k || {}; const kad = s.kad || {};
	const on = ed.connected || kad.connected;
	el.className = 'conn ' + (on ? 'ok' : 'bad');
	const dl = (s.speed && s.speed.down) || 0;
	const up = (s.speed && s.speed.up) || 0;
	el.innerHTML = `<span class="dot"></span> ↓${esc(fmtBytes(dl))}/s ↑${esc(fmtBytes(up))}/s`;
}

/* ---- views ------------------------------------------------------------- */

function renderStatus(s) {
	if (!s) return '<p class="empty">No data.</p>';
	const ed = s.ed2k || {}; const kad = s.kad || {}; const sp = s.speed || {};
	const srv = ed.server;
	const pill = (on, label) => `<span class="pill ${on ? 'on' : 'off'}">${esc(label)}</span>`;
	const idText = !ed.id ? 'Not connected'
		: (ed.lowid ? 'LowID ' : 'HighID ') + ed.id;
	return `
	<h2 class="section">Connection</h2>
	<div class="card">
		<div class="row"><span class="grow">eD2k</span>${pill(ed.connected, ed.connecting ? 'Connecting' : ed.connected ? 'Connected' : 'Offline')}</div>
		<div class="kv"><span>ID</span><span class="mono">${esc(idText)}</span></div>
		${srv ? `
		<div class="kv"><span>Server</span><span class="ellipsis">${esc(srv.name || srv.addr)}</span></div>
		<div class="kv"><span>Address</span><span class="mono">${esc(srv.addr)}</span></div>
		<div class="kv"><span>Users / Files</span><span class="mono">${esc((srv.users || 0).toLocaleString())} / ${esc((srv.files || 0).toLocaleString())}</span></div>` : ''}
	</div>
	<div class="card">
		<div class="row"><span class="grow">Kademlia</span>${pill(kad.connected, kad.connected ? (kad.firewalled ? 'Firewalled' : 'Connected') : 'Offline')}</div>
		<div class="kv"><span>Nodes</span><span class="mono">${esc((kad.nodes || 0).toLocaleString())}</span></div>
	</div>

	<h2 class="section">Speed</h2>
	<div class="card">
		<div class="row">
			<div class="grow"><div class="muted">Download</div><div class="big mono">${esc(fmtSpeed(sp.down))}</div></div>
			<div class="grow"><div class="muted">Upload</div><div class="big mono">${esc(fmtSpeed(sp.up))}</div></div>
		</div>
		<div class="kv"><span>Limits</span><span class="mono">↓ ${esc(sp.down_limit ? fmtSpeed(sp.down_limit) : '∞')} · ↑ ${esc(sp.up_limit ? fmtSpeed(sp.up_limit) : '∞')}</span></div>
	</div>

	<h2 class="section">Network</h2>
	<div class="card">
		<div class="kv"><span>eD2k users</span><span class="mono">${esc((s.ed2k_users || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Kad users</span><span class="mono">${esc((s.kad_users || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Shared files</span><span class="mono">${esc((s.shared_count || 0).toLocaleString())}</span></div>
		<div class="kv"><span>Session ▲▼</span><span class="mono">${esc(fmtBytes(s.total_up))} / ${esc(fmtBytes(s.total_down))}</span></div>
	</div>`;
}

function catName(id) {
	const c = state.cats.find((c) => c.id === id);
	return c ? c.name : (id ? '#' + id : '');
}

function renderTransfers(data) {
	const list = (data && data.downloads) || [];
	const addBox = `
	<div class="card">
		<div class="field inline">
			<input id="ed2k-input" type="text" placeholder="Paste an ed2k:// link" />
			<button class="shrink primary" id="ed2k-add">Add</button>
		</div>
	</div>`;
	if (!list.length) return addBox + '<p class="empty">No downloads.</p>';
	const rows = list.map((f) => {
		const done = f.status === 9 || f.progress >= 100;
		const bar = f.stopped ? 'paused' : done ? 'done' : '';
		const sel = state.sel.has(f.hash) ? ' sel' : '';
		return `
		<div class="item${sel}" data-hash="${esc(f.hash)}">
			<div class="name">${esc(f.name || '(unnamed) ' + (f.hash || '').slice(0, 12))}</div>
			<div class="progress"><i class="${bar}" style="width:${Math.min(100, f.progress)}%"></i></div>
			<div class="meta">
				<span><b>${esc(f.progress)}%</b> of ${esc(fmtBytes(f.size))}</span>
				<span>${esc(fmtSpeed(f.speed))}</span>
				<span><b>${esc(f.status_name)}</b></span>
				<span>src ${esc(f.src_count)} (${esc(f.src_xfer)})</span>
				${f.category ? `<span>${esc(catName(f.category))}</span>` : ''}
			</div>
			<div class="actions">
				<button data-act="resume" class="icon" title="Resume">▶</button>
				<button data-act="pause" class="icon" title="Pause">⏸</button>
				<button data-act="cancel" class="icon danger" title="Cancel / delete">✕</button>
			</div>
		</div>`;
	}).join('');
	return addBox + rows;
}

function renderShared(data) {
	const list = (data && data.shared) || [];
	if (!list.length) return '<p class="empty">No shared files.</p>';
	return list.map((f) => `
	<div class="item">
		<div class="name">${esc(f.name || '(unnamed)')}</div>
		<div class="meta">
			<span><b>${esc(fmtBytes(f.size))}</b></span>
			<span>req ${esc(f.requests)} (${esc(f.requests_all)})</span>
			<span>acc ${esc(f.accepts)} (${esc(f.accepts_all)})</span>
			<span>▲ ${esc(fmtBytes(f.xferred_all))}</span>
			<span>compl. src ${esc(f.complete_sources)}</span>
		</div>
	</div>`).join('');
}

function renderSearch(data) {
	const results = (data && data.results) || [];
	const form = `
	<div class="card">
		<div class="field"><input id="q" type="text" placeholder="Search the eD2k / Kad network…" /></div>
		<div class="field inline">
			<select id="stype" class="shrink" style="width:auto">
				<option value="global">Global</option>
				<option value="kad">Kad</option>
				<option value="local">Local</option>
			</select>
			<button class="primary" id="search-go">Search</button>
		</div>
		<div id="search-note" class="muted" style="font-size:0.8rem"></div>
	</div>`;
	const rows = results.map((f) => {
		const queued = f.status && f.status !== 'NEW';
		return `
		<div class="item" data-hash="${esc(f.hash)}">
			<div class="name">${esc(f.name)}</div>
			<div class="meta">
				<span><b>${esc(fmtBytes(f.size))}</b></span>
				<span>sources ${esc(f.sources)}</span>
				${queued ? `<span>${esc(f.status)}</span>` : ''}
			</div>
			<div class="actions">
				<button data-act="get" class="primary" ${queued ? 'disabled' : ''}>${queued ? 'In queue' : 'Download'}</button>
			</div>
		</div>`;
	}).join('');
	return form + (results.length ? rows : '<p class="empty">No results yet.</p>');
}

/* ---- data loading per view -------------------------------------------- */

async function refresh(force) {
	if (state.busy && !force) return;
	state.busy = true;
	try {
		const s = await apiGet('status');
		state.status = s;
		renderConn(s);
		// the search view is on-demand: refresh only updates the connection
		// indicator and leaves the results/form in place.
		if (state.view === 'search') { setError(null); return; }
		if (state.view === 'status') {
			viewEl().innerHTML = renderStatus(s);
		} else if (state.view === 'transfers') {
			if (!state.cats.length) {
				try { state.cats = (await apiGet('categories')).categories || []; } catch (e) { /* ignore */ }
			}
			const keepInput = $('#ed2k-input');
			const draft = keepInput ? keepInput.value : '';
			viewEl().innerHTML = renderTransfers(await apiGet('transfers'));
			if (draft) $('#ed2k-input').value = draft;
		} else if (state.view === 'shared') {
			viewEl().innerHTML = renderShared(await apiGet('shared'));
		}
		setError(null);
	} catch (e) {
		renderConn(null);
		setError('Cannot reach aMule: ' + e.message);
	} finally {
		state.busy = false;
	}
}

/* ---- search is on-demand (not polled) --------------------------------- */

async function doSearch() {
	const q = $('#q').value.trim();
	if (!q) return;
	const note = $('#search-note');
	note.textContent = 'Searching…';
	try {
		const data = await apiGet('search?q=' + encodeURIComponent(q) + '&type=' + $('#stype').value);
		const n = (data.results || []).length;
		viewEl().innerHTML = renderSearch(data);
		$('#q').value = q;
		$('#search-note').textContent = n + ' result' + (n === 1 ? '' : 's');
	} catch (e) {
		$('#search-note').textContent = 'Search failed: ' + e.message;
	}
}

/* ---- actions (event delegation) --------------------------------------- */

viewEl().addEventListener('click', async (ev) => {
	const btn = ev.target.closest('button');
	if (!btn) return;

	if (btn.id === 'ed2k-add') {
		const input = $('#ed2k-input');
		const link = input.value.trim();
		if (!link) return;
		btn.disabled = true;
		try { await apiPost('ed2k', { link }); input.value = ''; await refresh(true); }
		catch (e) { setError(e.message); } finally { btn.disabled = false; }
		return;
	}
	if (btn.id === 'search-go') { doSearch(); return; }

	const item = btn.closest('.item');
	if (!item) return;
	const hash = item.dataset.hash;
	const act = btn.dataset.act;
	if (!act) return;

	if (act === 'get') {
		btn.disabled = true; btn.textContent = '…';
		try { await apiPost('search_download', { hash }); btn.textContent = 'Queued'; }
		catch (e) { setError(e.message); btn.disabled = false; btn.textContent = 'Download'; }
		return;
	}
	if (act === 'cancel' && !confirm('Cancel and delete this download?')) return;
	try { await apiPost('dload', { hash, command: act }); await refresh(true); }
	catch (e) { setError(e.message); }
});

viewEl().addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter' && ev.target.id === 'q') { ev.preventDefault(); doSearch(); }
	if (ev.key === 'Enter' && ev.target.id === 'ed2k-input') { ev.preventDefault(); $('#ed2k-add').click(); }
});

/* ---- routing ----------------------------------------------------------- */

function setView(v) {
	state.view = VIEWS.includes(v) ? v : 'status';
	state.sel.clear();
	document.querySelectorAll('.tabbar a').forEach((a) =>
		a.classList.toggle('active', a.dataset.tab === state.view));
	viewEl().innerHTML = '<p class="muted" style="padding:1rem">Loading…</p>';
	if (state.view === 'search') {
		viewEl().innerHTML = renderSearch(null);
		refresh(true); // updates the connection indicator only
	} else {
		refresh(true);
	}
}

window.addEventListener('hashchange', () => setView(location.hash.replace('#', '')));

/* ---- poll loop --------------------------------------------------------- */

function tick() {
	// refresh() updates the body for status/transfers/shared and only the
	// connection indicator for the on-demand search view.
	if (!document.hidden) refresh(false);
}
timer = setInterval(tick, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ---- boot -------------------------------------------------------------- */

setView(location.hash.replace('#', '') || 'status');
