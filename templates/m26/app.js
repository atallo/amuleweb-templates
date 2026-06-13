/*
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "m26": jjling2011's amule-m26, a modern Vue 3 web UI for a
 * patched aMule, ported to *stock* amuleweb on the shared JSON layer
 * (api.php). Layout, texts, the filter mini-language and the light/dark
 * themes are transcribed from the upstream sources; features that require
 * the upstream's patched backend (move-to-category, request UTF-8
 * handling, delta polling, server-list prefs) are documented in the
 * README instead of implemented.
 * Origin: https://github.com/jjling2011/amule-m26
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

const A = new URL('.', import.meta.url).pathname;

/* ==================================================================== */
/* Theme (same storage key as the upstream, shared with login.php)      */
/* ==================================================================== */

const THEME_KEY = 'm26-color-theme-name';
function initialTheme() {
	try {
		const q = new URLSearchParams(location.search).get('theme');
		if (q === 'dark' || q === 'light') { localStorage.setItem(THEME_KEY, q); return q; }
		const saved = localStorage.getItem(THEME_KEY);
		if (saved === 'dark' || saved === 'light') return saved;
	} catch (e) { /* ignore */ }
	return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function applyTheme(t) {
	try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
	if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
	else document.documentElement.removeAttribute('data-theme');
}

/* ==================================================================== */
/* API client (single-flight, serialized -- amuleweb is single-threaded) */
/* ==================================================================== */

const MOCK = (typeof window !== 'undefined' && window.AMULE_MOCK) || null;

let _chain = Promise.resolve();
function serialize(fn) {
	const p = _chain.then(fn, fn);
	_chain = p.then(() => {}, () => {});
	return p;
}
async function rawGet(route, params) {
	if (MOCK) return MOCK.get(route, params || {});
	const q = new URLSearchParams(Object.assign({ r: route }, params || {}));
	const res = await fetch('api.php?' + q.toString(), { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error('HTTP ' + res.status);
	return res.json();
}
async function rawPost(route, params) {
	if (MOCK) return MOCK.post(route, params || {});
	const body = new URLSearchParams(Object.assign({ r: route }, params || {}));
	const res = await fetch('api.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});
	if (!res.ok) throw new Error('HTTP ' + res.status);
	return res.json();
}
async function rawText(route, params) {
	if (MOCK) return MOCK.text(route, params || {});
	const q = new URLSearchParams(Object.assign({ r: route }, params || {}));
	const res = await fetch('api.php?' + q.toString());
	if (!res.ok) throw new Error('HTTP ' + res.status);
	return res.text();
}
const apiGet = (route, params) => serialize(() => rawGet(route, params));
const apiPost = (route, params) => serialize(() => rawPost(route, params));
const apiText = (route, params) => serialize(() => rawText(route, params));

/* ==================================================================== */
/* Formatting + the upstream's filter mini-language                     */
/* ==================================================================== */

// formatBytes, transcribed from the upstream utils.js (IEC, one decimal).
function fmtB(input) {
	if (!input) return '-';
	const bytes = Number(input);
	if (isNaN(bytes) || bytes < 0) return '-';
	if (bytes === 0) return '0 B';
	const units = ['B', 'K', 'M', 'G', 'T', 'P'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioString(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio);
	if (f.prio_auto == 1) s += ' (auto)';
	return s;
}
function statusString(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}

// buildFilters, transcribed from the upstream utils.js. Filter keywords
// (space separated): text, -text, ^starts, -^starts, #tag, -#tag, @
// (selected), >N / <N (MiB), >N% / <N% (completion). Each *f function
// returns true when the row must be EXCLUDED.
function buildFilters(keyword) {
	const emptyConds = ['-', '>', '<', '#', '-#'];
	const keywords = (keyword || '').split(/ /).filter((s) => s && emptyConds.indexOf(s) < 0);

	const condf = keywords.indexOf('@') < 0 ? () => false : (c) => !c;

	const minSize = Math.max(...keywords
		.filter((s) => s.startsWith('>') && !s.endsWith('%'))
		.map((s) => parseInt(s.substring(1), 10) || -1), -Infinity);
	const maxSize = Math.min(...keywords
		.filter((s) => s.startsWith('<') && !s.endsWith('%'))
		.map((s) => parseInt(s.substring(1), 10) || Number.MAX_SAFE_INTEGER), Infinity);
	const sizef = (size) => { const mb = size / 1024 / 1024; return mb > maxSize || mb < minSize; };

	const minRatio = Math.max(...keywords
		.filter((s) => s.startsWith('>') && s.endsWith('%'))
		.map((s) => parseFloat(s.substring(1)) || -1), -Infinity);
	const maxRatio = Math.min(...keywords
		.filter((s) => s.startsWith('<') && s.endsWith('%'))
		.map((s) => parseFloat(s.substring(1)) || Number.MAX_SAFE_INTEGER), Infinity);
	const ratiof = (p) => p > maxRatio || p < minRatio - 0.001;

	const hasCand = keywords
		.filter((s) => ['-', '>', '<', '@'].indexOf(s.substring(0, 1)) < 0)
		.map((s) => s.toLowerCase());
	const starts = hasCand.filter((s) => s[0] === '^').map((s) => s.substring(1)).filter((s) => s);
	const tags = hasCand.filter((s) => s[0] === '#').map((s) => s.substring(1)).filter((s) => s);
	const has = hasCand.filter((s) => s[0] !== '^' && s[0] !== '#');

	const notCand = keywords.filter((s) => s.startsWith('-')).map((s) => s.substring(1).toLowerCase());
	const notStarts = notCand.filter((s) => s[0] === '^').map((s) => s.substring(1)).filter((s) => s);
	const notTags = notCand.filter((s) => s[0] === '#').map((s) => s.substring(1)).filter((s) => s);
	const notHas = notCand.filter((s) => s && s[0] !== '^' && s[0] !== '#');

	const tagf = (tag) => {
		tag = (tag || '').toLowerCase();
		for (const kw of tags) if (!tag.startsWith(kw)) return true;
		for (const kw of notTags) if (tag.startsWith(kw)) return true;
		return false;
	};
	const textf = (s) => {
		s = (s || '').toLowerCase();
		for (const kw of starts) if (!s.startsWith(kw)) return true;
		for (const kw of notStarts) if (s.startsWith(kw)) return true;
		for (const kw of has) if (!s.includes(kw)) return true;
		for (const kw of notHas) if (s.includes(kw)) return true;
		return false;
	};
	return { condf, sizef, ratiof, tagf, textf };
}

function sortRows(rows, key, dirDesc, strKeys) {
	const isStr = strKeys.indexOf(key) >= 0;
	const d = dirDesc ? -1 : 1;
	return rows.slice().sort((a, b) => {
		const x = a[key]; const y = b[key];
		const r = isStr
			? String(x || '').localeCompare(String(y || ''))
			: (Number(x) || 0) - (Number(y) || 0);
		return r * d;
	});
}

function copyToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text).then(() => true, () => false);
	}
	return Promise.resolve(false);
}

const Fa = ({ name, title }) => html`<i class=${'fa fa-' + name} aria-hidden="true" title=${title || ''}></i>`;

// The upstream's DropdownButton widget (button + menu).
function DropdownButton({ label, items, onAction }) {
	const [open, setOpen] = useState(false);
	return html`
	<span class="ddb-wrap">
		<button type="button" onClick=${() => setOpen((o) => !o)}>${label} ${'▾'}</button>
		${open ? html`<span class="ddb-menu">
			${items.map(([txt, action]) => html`<a key=${action} href="#" class="ddb-item"
				onClick=${(e) => { e.preventDefault(); setOpen(false); onAction(action); }}>${txt}</a>`)}
		</span>` : ''}
	</span>`;
}

/* ==================================================================== */
/* Sidebar                                                              */
/* ==================================================================== */

const NAV = [
	['download', 'download', 'Download'],
	['search', 'search', 'Search'],
	['server', 'server', 'Server'],
	['ed2k', 'link', 'ED2K'],
	['logs', 'book', 'Logs'],
	['prefs', 'cog', 'Preference'],
	['about', 'info-circle', 'About'],
];

function Sidebar({ view, go, status }) {
	const s = status || {};
	const ed2k = s.ed2k || {};
	const speed = fmtB(s.speed_up) + ', ' + fmtB(s.speed_down);
	let uid;
	if (!ed2k.id) uid = 'Not connected';
	else if (ed2k.state === 'connecting') uid = 'Connecting...';
	else uid = (ed2k.lowid ? '(low) ' : '(high) ') + ed2k.id;
	const kad = s.kad && s.kad.connected ? (s.kad.firewalled ? 'firewalled' : 'Connected') : 'Offline!';
	const serv = ed2k.state === 'connected' && ed2k.server ? ed2k.server : 'Offline!';
	const row = (k, v) => html`<div class="serv-stats"><span>${k}:</span><span title=${v}>${v}</span></div>`;
	return html`
	<div class="side-bar">
		<div class="logo-bar" style="cursor:pointer" onClick=${() => go(view)}>
			<img src=${A + 'favicon.ico'} alt="logo.ico" />
			<span>Amule M26</span>
		</div>
		<nav class="nav-bar">
			${NAV.map(([id, icon, label]) => html`
			<a key=${id} class=${view === id ? 'active' : ''} href=${'#' + id}
				onClick=${(e) => { e.preventDefault(); go(id); }}>
				<${Fa} name=${icon} title=${label} />
				<span class="nav-text">${label}</span>
			</a>`)}
		</nav>
		${row('Speed', speed)}
		${row('UID', uid)}
		${row('KAD', kad)}
		<div style="margin-bottom:1rem">${row('Server', serv)}</div>
	</div>`;
}

/* ==================================================================== */
/* DOWNLOAD                                                             */
/* ==================================================================== */

const DL_SORT_KEYS = ['name_hr', 'cat_hr', 'size', 'complete', 'speed', 'prio', 'status'];
const DL_STR_KEYS = ['name_hr', 'cat_hr', 'prio', 'status'];

function DownloadView({ data, status, guard, refresh }) {
	const [sortTag, setSortTag] = useState('size');
	const [desc, setDesc] = useState(true);
	const [filter, setFilter] = useState('');
	const [selAll, setSelAll] = useState(false);
	const [sel, setSel] = useState(() => new Set());

	const cats = (status && status.categories) || [];
	const downloads = (data && data.downloads) || [];

	const filters = buildFilters(filter);
	let rows = [];
	for (const f of downloads) {
		const name = f.name || ('(unnamed) ' + f.hash);
		if (filters.textf(name)) continue;
		const r = Object.assign({}, f, {
			name_hr: name,
			cat_hr: cats[f.category] || '-',
			complete: (Number(f.size_done) / Math.max(1, Number(f.size))) * 100,
			checked: sel.has(f.hash),
			prio_hr: prioString(f),
			status_hr: statusString(f),
		});
		if (filters.condf(r.checked) || filters.sizef(Number(f.size))
			|| filters.tagf(r.cat_hr) || filters.ratiof(r.complete)) continue;
		rows.push(r);
	}
	rows = sortRows(rows, sortTag === 'prio' ? 'prio_hr' : sortTag === 'status' ? 'status_hr' : sortTag, desc, DL_STR_KEYS.concat(['prio_hr', 'status_hr']));

	const toggle = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const toggleAll = () => {
		const v = !selAll; setSelAll(v);
		setSel(v ? new Set(rows.map((r) => r.hash)) : new Set());
	};
	const selected = () => rows.filter((r) => sel.has(r.hash));

	const orderSign = (k) => (k === sortTag ? (desc ? ' ↓' : ' ↑') : '');
	const byCol = (k) => { if (sortTag === k) setDesc((d) => !d); else { setSortTag(k); setDesc(true); } };

	const doCmd = async (cmd) => {
		if (!guard()) return;
		const files = selected();
		if (!files.length) { alert('Please select tasks.'); return; }
		if (cmd === 'cancel' && !confirm('Remove ' + files.length + ' tasks?')) return;
		apiPost('dload_cmd', { cmd, hashes: files.map((f) => f.hash).join(',') }).then(refresh).catch(() => {});
		if (cmd === 'cancel') setSel(new Set());
	};
	const copyLinks = async () => {
		const files = selected();
		if (!files.length) { alert('Please select tasks.'); return; }
		const links = files.map((f) => f.link).filter((l) => l);
		if (!links.length) { alert('No ed2k links available.'); return; }
		const ok = await copyToClipboard(links.join('\n'));
		alert(ok ? 'Copied to clipboard.' : 'Fail to copy to clipboard.');
	};
	const onAction = (a) => {
		if (a === 'copy_link') copyLinks();
		else doCmd(a);
	};

	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<${Fa} name="sort-alpha-asc" />
				<select class="mw1080-hide" value=${sortTag} onChange=${(e) => setSortTag(e.target.value)}>
					<option value="name_hr">Name</option>
					<option value="cat_hr">Catgory</option>
					<option value="size">Size</option>
					<option value="complete">Complete</option>
					<option value="speed">Speed</option>
					<option value="prio">Priority</option>
					<option value="status">Status</option>
				</select>
				<select class="mw1080-hide" style="margin-right:1rem" value=${desc ? 'descending' : 'ascending'}
					onChange=${(e) => setDesc(e.target.value === 'descending')}>
					<option value="ascending">Asce</option>
					<option value="descending">Desc</option>
				</select>
				<${DropdownButton} label="Action" onAction=${onAction} items=${[
					['Pause', 'pause'], ['Resume', 'resume'], ['Remove', 'cancel'],
					['Prio. Down', 'priodown'], ['Prio. Up', 'prioup'], ['Copy Link', 'copy_link'],
				]} />
				<input style="width:12rem;margin-left:1rem" placeholder="Filter"
					value=${filter} onInput=${(e) => setFilter(e.target.value)} />
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="width:3rem"><input type="checkbox" checked=${selAll} onChange=${toggleAll} /></span>
			<span style="flex-grow:1;cursor:pointer" onClick=${() => byCol('name_hr')}>Name${orderSign('name_hr')} (${sel.size} / ${downloads.length})</span>
			<span style="width:6rem;cursor:pointer" onClick=${() => byCol('cat_hr')}>Catgory${orderSign('cat_hr')}</span>
			<span style="width:5rem;cursor:pointer" onClick=${() => byCol('size')}>Size${orderSign('size')}</span>
			<span style="width:5rem;cursor:pointer" onClick=${() => byCol('complete')}>Complete${orderSign('complete')}</span>
			<span class="task-subtle-col mw1080-hide" style="cursor:pointer" onClick=${() => byCol('speed')}>Speed${orderSign('speed')}</span>
			<span class="task-subtle-col mw1080-hide" style="cursor:pointer" onClick=${() => byCol('prio')}>Priority${orderSign('prio')}</span>
			<span class="task-subtle-col mw1080-hide" style="cursor:pointer" onClick=${() => byCol('status')}>Status${orderSign('status')}</span>
		</div>
		<div class="rows-container">
			${rows.map((f) => html`
			<div key=${f.hash} class="table-row" style=${f.checked ? 'font-weight:bold' : ''}>
				<label class="table-col1" style="cursor:pointer">
					<input type="checkbox" checked=${f.checked} onChange=${() => toggle(f.hash)} />
					<span style="width:1rem;flex-grow:1;justify-content:left;text-align:left">${f.name_hr}</span>
				</label>
				<span style="width:6rem;flex-shrink:0">${f.cat_hr}</span>
				<span style="width:5rem;flex-shrink:0;justify-content:end">${fmtB(f.size)}</span>
				<span style="width:5rem;flex-shrink:0;justify-content:end;padding-right:0.5rem">${f.complete.toFixed(1)}%</span>
				<span class="task-subtle-col mw1080-hide" style="justify-content:end">${fmtB(f.speed)}</span>
				<span class="task-subtle-col mw1080-hide">${f.prio_hr}</span>
				<span class="task-subtle-col mw1080-hide">${f.status_hr}</span>
			</div>`)}
			<div style="width:100%;height:3rem"></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SEARCH                                                               */
/* ==================================================================== */

function SearchView({ data, status, guard, refresh }) {
	const [sortTag, setSortTag] = useState('none');
	const [desc, setDesc] = useState(true);
	const [filter, setFilter] = useState('');
	const [selAll, setSelAll] = useState(false);
	const [sel, setSel] = useState(() => new Set());
	const [kw, setKw] = useState('');
	const [network, setNetwork] = useState('global');
	const [cat, setCat] = useState(0);

	const cats = (status && status.categories) || [];
	const results = (data && data.results) || [];
	const dlHashes = (data && data.task_hashes) || [];

	const filters = buildFilters(filter);
	let rows = [];
	for (const f of results) {
		const name = f.name || '';
		if (filters.textf(name)) continue;
		const downloading = dlHashes.indexOf(f.hash) >= 0;
		const r = Object.assign({}, f, {
			name_hr: name,
			downloading,
			checked: !downloading && sel.has(f.hash),
		});
		if (filters.sizef(Number(f.size)) || filters.condf(r.checked)) continue;
		rows.push(r);
	}
	if (sortTag !== 'none') rows = sortRows(rows, sortTag, desc, ['name_hr']);

	const toggle = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const toggleAll = () => {
		const v = !selAll; setSelAll(v);
		setSel(v ? new Set(rows.filter((r) => !r.downloading).map((r) => r.hash)) : new Set());
	};
	const orderSign = (k) => (k === sortTag ? (desc ? ' ↓' : ' ↑') : '');
	const byCol = (k) => { if (sortTag === k) setDesc((d) => !d); else { setSortTag(k); setDesc(true); } };

	const doSearch = () => {
		if (!guard() || !kw.trim()) return;
		const types = { local: 0, global: 1, kad: 2 };
		setFilter('');
		apiPost('search_start', { keyword: kw.trim(), type: types[network] || 0, avail: 0, minsize: 0, maxsize: 0 })
			.then(refresh).catch(() => {});
	};
	const download = () => {
		if (!guard()) return;
		const files = rows.filter((r) => r.checked);
		if (!files.length) { alert('Please select files to download.'); return; }
		apiPost('search_download', { hashes: files.map((f) => f.hash).join(','), cat })
			.then(refresh).catch(() => {});
		setSel(new Set());
	};

	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<${Fa} name="sort-alpha-asc" />
				<select class="mw1080-hide" value=${sortTag} onChange=${(e) => setSortTag(e.target.value)}>
					<option value="size">Size</option>
					<option value="sources">Sources</option>
					<option value="name_hr">Name</option>
					<option value="none">None</option>
				</select>
				<select class="mw1080-hide" style="margin-right:1rem" value=${desc ? 'descending' : 'ascending'}
					onChange=${(e) => setDesc(e.target.value === 'descending')}>
					<option value="ascending">Asce</option>
					<option value="descending">Desc</option>
				</select>
				<select value=${network} onChange=${(e) => setNetwork(e.target.value)}>
					<option value="local">Local</option>
					<option value="global">Global</option>
					<option value="kad">KAD</option>
				</select>
				<input style="width:7rem" placeholder=${'Search<Enter>'} value=${kw}
					onInput=${(e) => setKw(e.target.value)}
					onKeyDown=${(e) => { if (e.key === 'Enter') doSearch(); }} />
				<button style="margin-right:1rem" onClick=${doSearch}>Search</button>
				<button onClick=${download}>Download to</button>
				<select style="margin-right:1rem" value=${cat} onChange=${(e) => setCat(+e.target.value)}>
					${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
				</select>
				<input style="width:12rem" placeholder="Filter" value=${filter} onInput=${(e) => setFilter(e.target.value)} />
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="width:3rem"><input type="checkbox" checked=${selAll} onChange=${toggleAll} /></span>
			<span style="width:4rem;flex-shrink:0;cursor:pointer" onClick=${() => byCol('sources')}>Sources${orderSign('sources')}</span>
			<span style="width:5rem;flex-shrink:0;cursor:pointer" onClick=${() => byCol('size')}>Size${orderSign('size')}</span>
			<span style="flex-grow:1;cursor:pointer" onClick=${() => byCol('name_hr')}>Name${orderSign('name_hr')} (${sel.size} / ${results.length})</span>
		</div>
		<div class="rows-container">
			${rows.map((f) => html`
			<div key=${f.hash} class="table-row" style=${f.downloading ? 'opacity:0.55' : (f.checked ? 'font-weight:bold' : '')}>
				<label class="table-col1" style="cursor:pointer">
					<input type="checkbox" disabled=${f.downloading} checked=${f.checked} onChange=${() => toggle(f.hash)} />
				</label>
				<span style="width:4rem;flex-shrink:0;justify-content:end">${f.sources}</span>
				<span style="width:5rem;flex-shrink:0;justify-content:end">${fmtB(f.size)}</span>
				<span style="flex-grow:1;justify-content:left;text-align:left;padding-left:0.5rem">${f.name_hr}${f.downloading ? ' (downloading)' : ''}</span>
			</div>`)}
			<div style="width:100%;height:3rem"></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SERVER                                                               */
/* ==================================================================== */

function ServerView({ data, status, guard, refresh }) {
	const [sortTag, setSortTag] = useState('name');
	const [desc, setDesc] = useState(true);
	const [bootstrapParam, setBootstrapParam] = useState('');
	const [newServer, setNewServer] = useState('');

	const servers = (data && data.servers) || [];
	const curAddr = (status && status.ed2k && status.ed2k.state === 'connected' && status.ed2k.addr) || '';
	const rows = sortRows(servers, sortTag, desc, ['name']);
	const orderSign = (k) => (k === sortTag ? (desc ? ' ↓' : ' ↑') : '');
	const byCol = (k) => { if (sortTag === k) setDesc((d) => !d); else { setSortTag(k); setDesc(true); } };
	const isConnected = (s) => curAddr && s.addr === curAddr;

	const srvCmd = (cmd, s) => {
		if (!guard()) return;
		if (cmd === 'remove' && !confirm('Remove server?')) return;
		apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {});
	};
	const kadAct = (action, extra) => {
		if (!guard()) return;
		apiPost('kad', Object.assign({ action }, extra || {})).then(refresh).catch(() => {});
	};
	const onConnectAction = (a) => {
		if (a === 'server') { if (guard()) apiPost('server_disconnect', {}).then(refresh).catch(() => {}); }
		else if (a === 'dis_kad') kadAct('disconnect');
		else if (a === 'conn_kad') kadAct('connect_known');
	};
	const bootstrapKad = () => {
		const p = bootstrapParam.trim();
		const m = p.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/);
		if (m) {
			// the stock form posts octets low-to-high (ip0 is the last one)
			kadAct('connect_ip', { ip0: m[4], ip1: m[3], ip2: m[2], ip3: m[1], port: m[5] });
		} else if (p.indexOf('http') === 0) {
			kadAct('update_url', { url: p });
		} else {
			alert('Invalid bootstrap param: ' + p);
		}
	};
	const addServer = () => {
		// "IPv4:port serv_name"
		const p = newServer.trim();
		const m = p.match(/^(\S+):(\d{1,5})\s+(.+)$/);
		if (!m) { alert('Require 3 params.'); return; }
		if (!guard()) return;
		apiPost('server_add', { addr: m[1], port: m[2], name: m[3] }).then(refresh).catch(() => {});
		setNewServer('');
	};

	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<${Fa} name="sort-alpha-asc" />
				<select class="mw1080-hide" value=${sortTag} onChange=${(e) => setSortTag(e.target.value)}>
					<option value="name">Name</option>
					<option value="users">Users</option>
					<option value="files">Files</option>
				</select>
				<select class="mw1080-hide" style="margin-right:1rem" value=${desc ? 'descending' : 'ascending'}
					onChange=${(e) => setDesc(e.target.value === 'descending')}>
					<option value="ascending">Asce</option>
					<option value="descending">Desc</option>
				</select>
				<${DropdownButton} label="Connect" onAction=${onConnectAction} items=${[
					['Disconnect Server', 'server'], ['Disconnect KAD', 'dis_kad'], ['Connect KAD', 'conn_kad'],
				]} />
				<input class="kad-param" style="margin-left:1rem" placeholder="URL, IPv4:port"
					value=${bootstrapParam} onInput=${(e) => setBootstrapParam(e.target.value)} />
				<button style="margin-right:1rem" onClick=${bootstrapKad}>Bootstrap KAD</button>
				<input class="kad-param" placeholder="IPv4:port serv_name"
					value=${newServer} onInput=${(e) => setNewServer(e.target.value)} />
				<button style="margin-right:1rem" onClick=${addServer}>Add Server</button>
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="width:6rem">Action</span>
			<span class="server-name-col" style="cursor:pointer" onClick=${() => byCol('name')}>Name${orderSign('name')}</span>
			<span style="width:6rem;cursor:pointer" onClick=${() => byCol('files')}>Files${orderSign('files')}</span>
			<span style="width:6rem;cursor:pointer" onClick=${() => byCol('users')}>Users${orderSign('users')}</span>
			<span style="width:10rem">Address</span>
			<span class="server-desc-col mw1080-hide" style="justify-content:start;padding-left:1rem">Description</span>
		</div>
		<div class="rows-container">
			${rows.map((s) => html`
			<div key=${s.ip + ':' + s.port} class="table-row" style=${isConnected(s) ? 'font-weight:bold' : ''}>
				<span style="width:6rem;flex-shrink:0">
					${isConnected(s) ? 'Active' : html`<span>
						<button title="Connect" onClick=${() => srvCmd('connect', s)}><${Fa} name="plug" /></button>
						<button title="Remove" onClick=${() => srvCmd('remove', s)}><${Fa} name="trash" /></button>
					</span>`}
				</span>
				<span class="server-name-col">${s.name}</span>
				<span style="width:6rem;flex-shrink:0;justify-content:end">${s.files}</span>
				<span style="width:6rem;flex-shrink:0;justify-content:end">${s.users}</span>
				<span style="width:10rem;flex-shrink:0;justify-content:end;padding-right:0.5rem">${s.addr}</span>
				<span class="server-desc-col mw1080-hide" style="justify-content:start;padding-left:1rem">${s.desc}</span>
			</div>`)}
			<div style="width:100%;height:3rem"></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* ED2K links                                                           */
/* ==================================================================== */

function Ed2kView({ status, guard }) {
	const [text, setText] = useState('');
	const [cat, setCat] = useState(0);
	const cats = (status && status.categories) || [];
	const links = () => text.split(/[\r\n]/).map((s) => s.trim()).filter((s) => s.indexOf('ed2k://') === 0);
	const download = () => {
		if (!guard()) return;
		const ls = links();
		if (!ls.length) { alert('There is no link to download!'); return; }
		ls.forEach((l) => apiPost('ed2k', { link: l, cat }).catch(() => {}));
		alert('Server receive ' + ls.length + ' links.');
		setText('');
	};
	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<button onClick=${download}>Download to</button>
				<select style="margin-right:1rem" value=${cat} onChange=${(e) => setCat(+e.target.value)}>
					${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
				</select>
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="flex-grow:1">links (${links().length})</span>
		</div>
		<div class="text-container">
			<textarea placeholder="ed2k://..." spellcheck="false" value=${text}
				onInput=${(e) => setText(e.target.value)}></textarea>
		</div>
	</div>`;
}

/* ==================================================================== */
/* LOGS                                                                 */
/* ==================================================================== */

// "stats" is the statistics tree rendered as indented text, like the
// upstream's stats log category.
function statsTreeToText(node, depth) {
	let out = '';
	for (const [k, v] of Object.entries(node || {})) {
		out += '    '.repeat(depth) + k + '\n';
		if (v && typeof v === 'object') out += statsTreeToText(v, depth + 1);
	}
	return out;
}

function LogsView({ guard }) {
	const [cat, setCat] = useState('amule');
	const [logs, setLogs] = useState({ amule: '', server: '', stats: '' });
	const [autoScroll, setAutoScroll] = useState(true);
	const taRef = useRef(null);

	const load = useCallback(() => {
		apiText('log').then((t) => setLogs((l) => Object.assign({}, l, { amule: t }))).catch(() => {});
		apiText('serverinfo').then((t) => setLogs((l) => Object.assign({}, l, { server: t }))).catch(() => {});
		apiGet('statstree').then((d) => setLogs((l) => Object.assign({}, l, { stats: statsTreeToText(d, 0) }))).catch(() => {});
	}, []);
	useEffect(() => { load(); }, [load]);
	useEffect(() => {
		if (autoScroll && cat !== 'stats' && taRef.current) {
			taRef.current.scrollTop = taRef.current.scrollHeight;
		}
	}, [logs, cat, autoScroll]);

	const clearAll = () => {
		if (!guard()) return;
		if (!confirm('Clear logs?')) return;
		apiText('log', { reset: 1 }).then((t) => setLogs((l) => Object.assign({}, l, { amule: t }))).catch(() => {});
		apiText('serverinfo', { reset: 1 }).then((t) => setLogs((l) => Object.assign({}, l, { server: t }))).catch(() => {});
	};

	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<span>Cat.</span>
				<select style="margin-right:1rem" value=${cat} onChange=${(e) => setCat(e.target.value)}>
					<option value="amule">amule</option>
					<option value="server">server</option>
					<option value="stats">stats</option>
				</select>
				<button style="margin-right:1rem" onClick=${clearAll}>Clear logs</button>
				<label style="display:flex">
					<input type="checkbox" style="width:1rem" checked=${autoScroll}
						onChange=${(e) => setAutoScroll(e.target.checked)} />
					<span>Auto scroll</span>
				</label>
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="flex-grow:1">${cat}</span>
		</div>
		<div class="text-container">
			<textarea ref=${taRef} readOnly spellcheck="false" value=${logs[cat] || ''}
				onScroll=${() => setAutoScroll(false)}></textarea>
		</div>
	</div>`;
}

/* ==================================================================== */
/* PREFERENCE                                                           */
/* ==================================================================== */

// Grouping + control types + descriptions, from the upstream language
// table. api.php serves the options flat; they are grouped client-side.
const PREF_GROUPS = [
	['general', ['nick']],
	['connection', ['max_line_down_cap', 'max_line_up_cap', 'max_down_limit', 'max_up_limit',
		'slot_alloc', 'tcp_port', 'udp_port', 'udp_dis', 'max_file_src', 'max_conn_total',
		'autoconn_en', 'reconn_en', 'network_ed2k', 'network_kad']],
	['files', ['ich_en', 'aich_trust', 'new_files_paused', 'new_files_auto_dl_prio',
		'new_files_auto_ul_prio', 'extract_metadata', 'alloc_full', 'alloc_full_chunks',
		'check_free_space', 'min_free_space']],
	['webserver', ['use_gzip', 'autorefresh_time']],
];
const PREF_CHECKBOX = ['udp_dis', 'autoconn_en', 'reconn_en', 'network_ed2k', 'network_kad',
	'ich_en', 'aich_trust', 'new_files_paused', 'new_files_auto_dl_prio', 'new_files_auto_ul_prio',
	'extract_metadata', 'alloc_full', 'alloc_full_chunks', 'check_free_space', 'use_gzip'];
const PREF_DESC = {
	nick: 'Nickname',
	max_line_up_cap: 'Max upload rate (for statistics only)',
	max_line_down_cap: 'Max download rate (for statistics only)',
	max_up_limit: 'Max upload rate',
	max_down_limit: 'Max download rate',
	slot_alloc: 'Slot allocation',
	tcp_port: 'TCP port',
	udp_port: 'UDP port',
	udp_dis: 'Disable UDP connections',
	max_file_src: 'Max sources per file',
	max_conn_total: 'Max total connections (total)',
	autoconn_en: 'Autoconnect at startup',
	reconn_en: 'Reconnect when connection lost',
	network_ed2k: 'Enable ED2K network',
	network_kad: 'Enable Kademlia network',
	ich_en: 'I.C.H. active',
	aich_trust: 'AICH trusts every hash (not recommended)',
	new_files_paused: 'Add files to download queue in pause mode',
	new_files_auto_dl_prio: 'Added download files have auto priority',
	new_files_auto_ul_prio: 'New shared files have auto priority',
	extract_metadata: 'Extract metadata tags',
	alloc_full: 'Alloc full disk space for .part files',
	alloc_full_chunks: 'Alloc full chunks of .part files',
	check_free_space: 'Check free space',
	min_free_space: 'Minimum free space (Mb)',
	use_gzip: 'Use gzip compression',
	autorefresh_time: 'Page refresh interval',
};

function PrefsView({ status, guard, theme, setTheme }) {
	const [form, setForm] = useState(null);
	const guest = !!(status && status.guest);
	const load = useCallback(() => apiGet('options').then((o) => {
		const f = Object.assign({}, o); delete f.categories; setForm(f);
	}).catch(() => {}), []);
	useEffect(() => { load(); }, [load]);

	if (!form) return html`<div class="rows-container" style="padding:1rem">Loading…</div>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const save = () => {
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(() => { alert('Ok!'); load(); }).catch(() => {});
	};

	const known = {};
	PREF_GROUPS.forEach(([, keys]) => keys.forEach((k) => { known[k] = 1; }));
	const others = Object.keys(form).filter((k) => !known[k]);
	const groups = PREF_GROUPS.map(([cat, keys]) => [cat, keys.filter((k) => form[k] !== undefined)])
		.filter(([, keys]) => keys.length);
	if (others.length) groups.push(['other', others]);

	const row = (k) => html`
	<div key=${k} class="pref-row">
		<span class="pref-key">${k}</span>
		<div class="pref-value">
			${PREF_CHECKBOX.indexOf(k) >= 0
				? html`<input type="checkbox" class="prefs-checkbox" disabled=${guest}
					checked=${form[k] === '1' || form[k] === 1}
					onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />`
				: html`<input class="prefs-input" disabled=${guest}
					value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />`}
		</div>
		<span style="flex-grow:1;padding-left:0.5rem">${PREF_DESC[k] || ''}</span>
	</div>`;

	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<button style="margin-right:1rem" onClick=${save}><${Fa} name="floppy-o" /> Save</button>
				<button style="margin-right:1rem" onClick=${() => { window.location.href = 'login.php'; }}><${Fa} name="sign-out" /> Log out</button>
				<div class="switcher-group">
					<label for="theme-select">Theme</label>
					<select id="theme-select" value=${theme} onChange=${(e) => setTheme(e.target.value)}>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>
			</div>
		</div>
		<div class="table-header mw1080-left">
			<span style="width:16rem">Key</span>
			<span style="width:10rem">Value</span>
			<span style="flex-grow:1;justify-content:start">Description</span>
		</div>
		<div class="rows-container">
			${groups.map(([cat, keys]) => html`
			<div key=${cat} class="pref-group">
				<div class="pref-cat">${cat}</div>
				${keys.map(row)}
			</div>`)}
			<div style="width:100%;height:3rem"></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* ABOUT                                                                */
/* ==================================================================== */

const ABOUT_NOTE = `Filter:
hello    include string "hello"
-world   without string "world"
^hello   starts with "hello"
-^world  not starts with "world"
#music   category is "music"
-#music  category is not "music"
@        selected
>10      size bigger than 10 MiB
<200     size smaller than 200 MiB
>20%     download complete ratio more than 20%
<80%     download complete ratio less than 80%

Filter keywords are seperated by space.


Tips:
Click app logo to scroll to top.

Origin (this template is a port of amule-m26 to stock amuleweb):
https://github.com/jjling2011/amule-m26/

Credits:
https://github.com/ngosang/docker-amule/
https://github.com/MatteoRagni/AmuleWebUI-Reloaded/
https://github.com/amule-org/amule/
https://github.com/amule-project/amule/`;

function AboutView() {
	return html`
	<div>
		<div class="toolbar mw1080-left">
			<div class="toolstrip">
				<button onClick=${() => window.open('https://github.com/jjling2011/amule-m26/', '_blank')}>GitHub</button>
				<button onClick=${() => window.open('https://github.com/atallo/amuleweb-templates', '_blank')}>This port</button>
			</div>
		</div>
		<div class="table-header mw1080-left"></div>
		<div class="rows-container">
			<pre class="about-content">${ABOUT_NOTE}</pre>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

const VIEWS = ['download', 'search', 'server', 'ed2k', 'logs', 'prefs', 'about'];
const VIEW_ROUTE = { download: 'transfers', server: 'servers', search: 'search' };
const REFRESH_MS = 5000;

const initialView = () => {
	const h = location.hash.replace('#', '');
	return VIEWS.indexOf(h) >= 0 ? h : 'download';
};

function App() {
	const [view, setView] = useState(initialView);
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [theme, setThemeState] = useState(initialTheme);
	const busyRef = useRef(false);

	useEffect(() => { applyTheme(theme); }, [theme]);

	const cycle = useCallback(async (force) => {
		if (busyRef.current || (document.hidden && !force)) return;
		busyRef.current = true;
		try {
			const s = await apiGet('status');
			setStatus(s);
			const route = VIEW_ROUTE[view];
			if (route) {
				const d = await apiGet(route);
				if (view === 'search') {
					// mark results that are already in the download queue,
					// like the upstream's GetAllTaskHashes
					try {
						const t = await apiGet('transfers');
						d.task_hashes = (t.downloads || []).map((f) => f.hash);
					} catch (e) { d.task_hashes = []; }
				}
				setData(d);
			}
		} catch (e) { /* keep last data */ }
		busyRef.current = false;
	}, [view]);

	useEffect(() => {
		cycle(true);
		const t = setInterval(() => cycle(false), REFRESH_MS);
		return () => clearInterval(t);
	}, [cycle]);
	useEffect(() => {
		const onVis = () => { if (!document.hidden) cycle(true); };
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	}, [cycle]);
	useEffect(() => {
		if (location.pathname.endsWith('login.php')) {
			try { history.replaceState(null, '', './'); } catch (e) { /* ignore */ }
		}
	}, []);

	const guard = useCallback(() => {
		if (status && status.guest) { alert('You logged in as guest - commands are disabled'); return false; }
		return true;
	}, [status]);
	const refresh = useCallback(() => cycle(true), [cycle]);
	const go = (id) => {
		if (id !== view) {
			setData(null); setView(id);
			try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
		} else {
			const el = document.querySelector('.main-container');
			if (el) el.scrollTop = 0;
		}
	};
	const setTheme = (t) => setThemeState(t);

	const vp = { data, status, guard, refresh };
	let body;
	if (view === 'download') body = html`<${DownloadView} ...${vp} />`;
	else if (view === 'search') body = html`<${SearchView} ...${vp} />`;
	else if (view === 'server') body = html`<${ServerView} ...${vp} />`;
	else if (view === 'ed2k') body = html`<${Ed2kView} status=${status} guard=${guard} />`;
	else if (view === 'logs') body = html`<${LogsView} guard=${guard} />`;
	else if (view === 'prefs') body = html`<${PrefsView} status=${status} guard=${guard} theme=${theme} setTheme=${setTheme} />`;
	else if (view === 'about') body = html`<${AboutView} />`;

	return html`
	<div class="app-container">
		<${Sidebar} view=${view} go=${go} status=${status} />
		<div class="main-container mw1080-left">${body}</div>
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
