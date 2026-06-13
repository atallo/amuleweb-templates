/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "amulefresh": David Capapé's aMuleFresh, a Bootstrap 5.3 dark
 * re-skin of the aMule web interface, reproduced as a single-page app on
 * top of the shared JSON layer (api.php). Markup, texts and the dark color
 * scheme are transcribed from the upstream pages; a light theme variant is
 * added on top (toggle in the navbar, dark by default as in the original).
 * jQuery and bootstrap.bundle.js are not needed -- the navbar collapse,
 * carousel, tooltips and popovers are app-driven; only Bootstrap's CSS,
 * Bootstrap Icons and Animate.css are shipped (self-hosted, no CDN).
 * Origin: https://github.com/dcapape/amulefresh
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

const A = new URL('.', import.meta.url).pathname;

/* ==================================================================== */
/* Theme (dark = original; light variant added on top)                  */
/* ==================================================================== */

const THEME_KEY = 'amulefresh-theme';
function initialTheme() {
	try {
		const q = new URLSearchParams(location.search).get('theme');
		if (q === 'dark' || q === 'light') { localStorage.setItem(THEME_KEY, q); return q; }
		const saved = localStorage.getItem(THEME_KEY);
		if (saved === 'dark' || saved === 'light') return saved;
	} catch (e) { /* ignore */ }
	return 'dark'; // the upstream is dark-only
}
function applyTheme(t) {
	try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
	document.documentElement.setAttribute('data-theme', t);
	document.documentElement.setAttribute('data-bs-theme', t);
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
/* Formatting helpers                                                   */
/* ==================================================================== */

const r2 = (n) => {
	const s = (Math.round(n * 100) / 100).toFixed(2);
	return s.replace(/\.?0+$/, '') || '0';
};
// transcribed from the upstream CastToXBytes (lowercase units)
function fmtB(size) {
	size = Number(size) || 0;
	if (size < 1024) return size + ' b';
	if (size < 1048576) return r2(size / 1024) + ' kb';
	if (size < 1073741824) return r2(size / 1048576) + ' mb';
	return r2(size / 1073741824) + ' gb';
}
const pct2 = (done, size) => (size > 0 ? r2((Number(done) * 100) / Number(size)) : '0');

const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioString(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio);
	if (f.prio_auto == 1) s += ' (auto)';
	return s;
}
const prioSort = (f) => (Number(f.prio) === 4 ? 0 : Number(f.prio) + 1);
function statusString(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}
function sourcesText(f) {
	let s = '';
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + ' / ';
	s += f.src_count + ' ( ' + f.src_count_xfer + ' )';
	if (f.src_count_a4af != 0) s += ' + ' + f.src_count_a4af;
	return s;
}
const UNITS = { Byte: 1, KByte: 1024, MByte: 1048576, GByte: 1073741824 };

/* ==================================================================== */
/* Small shared pieces                                                  */
/* ==================================================================== */

function useSort(initKey, initDir) {
	const [key, setKey] = useState(initKey);
	const [dir, setDir] = useState(initDir || 1);
	const by = (k) => { if (k === key) setDir((d) => -d); else { setKey(k); setDir(1); } };
	const sort = (rows, acc) => {
		const f = acc[key];
		if (!f) return rows;
		return rows.slice().sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
	};
	return { key, by, sort };
}
function useSel() {
	const [sel, setSel] = useState(() => new Set());
	return {
		sel,
		has: (h) => sel.has(h),
		toggle: (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; }),
		clear: () => setSel(new Set()),
		list: () => Array.from(sel),
	};
}
const Bi = ({ name }) => html`<i class=${'bi bi-' + name} aria-hidden="true"></i>`;
const SortA = ({ label, k, sort }) => html`<a href="#" onClick=${(e) => { e.preventDefault(); sort.by(k); }}>${label}</a>`;

const Card = ({ title, children }) => html`
	<div class="card">
		<div class="card-header text-center"><h4>${title}</h4></div>
		<div class="card-body">${children}</div>
	</div>`;

// click-to-select row (the upstream's hidden-checkbox + green-border style)
const rowCls = (on) => 'amf-row' + (on ? ' selected' : '');

/* ==================================================================== */
/* Navbar + ed2k footer                                                 */
/* ==================================================================== */

const NAV = [
	['download', 'arrow-left-right', 'Transfer'],
	['shared', 'share', 'Shared'],
	['search', 'search', 'Search'],
	['servers', 'server', 'Server'],
	['kad', 'asterisk', 'Kad'],
	['stats', 'bar-chart', 'Stats'],
];
const NAV2 = [
	['prefs', 'gear', 'Settings'],
	['log', 'flag', 'Logs'],
];

function Navbar({ view, go, theme, toggleTheme }) {
	const [open, setOpen] = useState(false);
	const nav = (id) => (e) => { e.preventDefault(); setOpen(false); go(id); };
	const btn = ([id, icon, label]) => html`
		<a key=${id} class=${'btn btn-outline-light navbar-link' + (view === id ? ' active' : '')}
			title=${label} href=${'#' + id} onClick=${nav(id)}>
			<${Bi} name=${icon} />
			<div style="font-size:9px"><br />${label}</div>
		</a>`;
	return html`
	<nav class="navbar navbar-expand-lg navbar-dark fixed-top">
		<div class="container-fluid">
			<a class="navbar-brand" href="#download" onClick=${nav('download')}>
				<img src=${A + 'logo.png'} class="logo-nav" alt="aMule Logo" /> aMule
			</a>
			<button class="navbar-toggler" type="button" aria-expanded=${open}
				onClick=${() => setOpen((o) => !o)}>
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class=${'collapse navbar-collapse' + (open ? ' show' : '')}>
				<div class="navbar-nav ms-auto align-items-center">
					<div class="btn-group me-2" role="group">${NAV.map(btn)}</div>
					<div class="btn-group me-2" role="group">${NAV2.map(btn)}</div>
					<div class="btn-group me-2" role="group">
						<a class="btn btn-outline-light navbar-link" title="Toggle theme" href="#"
							onClick=${(e) => { e.preventDefault(); toggleTheme(); }}>
							<${Bi} name=${theme === 'dark' ? 'sun' : 'moon-stars'} />
							<div style="font-size:9px"><br />${theme === 'dark' ? 'Light' : 'Dark'}</div>
						</a>
						<a class="btn btn-outline-light navbar-link" title="Exit" href="login.php">
							<${Bi} name="power" />
							<div style="font-size:9px"><br />Exit</div>
						</a>
					</div>
				</div>
			</div>
		</div>
	</nav>`;
}

function Ed2kFooter({ status, guard }) {
	const [link, setLink] = useState('');
	const [cat, setCat] = useState(0);
	const cats = (status && status.categories) || [];
	const guest = !!(status && status.guest);
	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };
	const submit = (e) => {
		e.preventDefault();
		if (!guard() || !link.trim()) return;
		apiPost('ed2k', { link: link.trim(), cat }).catch(() => {});
		setLink('');
	};
	let ed2kTxt;
	if (ed2k.state === 'connecting') ed2kTxt = 'Connecting ...';
	else if (ed2k.state !== 'connected') ed2kTxt = 'Not connected';
	else ed2kTxt = 'Connected ' + (ed2k.lowid ? '(low)' : '(high)') + ' ' + ed2k.server + ' ' + ed2k.addr;
	const kadTxt = kad.connected ? 'Connected' : 'Disconnected';
	return html`
	<div id="footer">
		<div class="container-fluid">
			<div class="row align-items-center g-2">
				<div class="col-md-6">
					<form class="d-flex gap-2 align-items-center" onSubmit=${submit}>
						<input class="form-control" type="text" placeholder="ed2k:// - Insert link"
							disabled=${guest} value=${link} onInput=${(e) => setLink(e.target.value)} />
						<select class="form-select" style="max-width:150px" disabled=${guest}
							value=${cat} onChange=${(e) => setCat(+e.target.value)}>
							${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
						</select>
						<button class="btn btn-primary" type="submit" disabled=${guest}><${Bi} name="download" /></button>
					</form>
				</div>
				<div class="col-md-6 text-md-end small">
					<span class="me-3"><b>Ed2k:</b> ${ed2kTxt}</span>
					<span><b>Kad:</b> ${kadTxt}</span>
				</div>
			</div>
		</div>
	</div>`;
}

const GuestBadge = ({ status }) => ((status && status.guest)
	? html`<span class="badge bg-warning text-dark ms-2">You logged in as guest - commands are disabled</span>` : '');

/* ==================================================================== */
/* TRANSFER (downloads + uploads)                                       */
/* ==================================================================== */

function TransferView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [fStatus, setFStatus] = useState('all');
	const [fCat, setFCat] = useState('all');
	const [aStatus, setAStatus] = useState('all');
	const [aCat, setACat] = useState('all');

	const cats = (status && status.categories) || [];
	const downloads = (data && data.downloads) || [];
	const uploads = (data && data.uploads) || [];

	const filtered = downloads.filter((f) => {
		if (aStatus !== 'all' && statusString(f) !== aStatus) return false;
		if (aCat !== 'all') { const i = cats.indexOf(aCat); if (i >= 0 && f.category !== i) return false; }
		return true;
	});
	const rows = sort.sort(filtered, {
		name: (f) => (f.name || '').toLowerCase(), size: (f) => Number(f.size),
		size_done: (f) => Number(f.size_done), speed: (f) => Number(f.speed),
		progress: (f) => Number(f.size_done) / Math.max(1, Number(f.size)),
		srccount: (f) => Number(f.src_count), status: (f) => statusString(f), prio: (f) => prioSort(f),
	});
	const tot = downloads.reduce((a, f) => ({
		size: a.size + Number(f.size), done: a.done + Number(f.size_done), speed: a.speed + Number(f.speed),
	}), { size: 0, done: 0, speed: 0 });
	const utot = uploads.reduce((a, f) => ({
		up: a.up + Number(f.xfer_up), dn: a.dn + Number(f.xfer_down), speed: a.speed + Number(f.xfer_speed),
	}), { up: 0, dn: 0, speed: 0 });

	const cmd = (c) => {
		if (!guard()) return;
		if (c === 'cancel' && !confirm('Remove the selected files?')) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') sel.clear();
	};
	const tbtn = (title, icon, c) => html`
		<a class="btn btn-outline-light" href="#" title=${title} onClick=${(e) => { e.preventDefault(); cmd(c); }}>
			<${Bi} name=${icon} /><div style="font-size:9px"><br />${title}</div>
		</a>`;

	return html`
	<div>
		<div class="panel-tasks">
			<div class="d-flex flex-wrap justify-content-center align-items-center gap-2">
				<div class="btn-group" role="group">
					${tbtn('Pause', 'pause-fill', 'pause')}
					${tbtn('Resume', 'play-fill', 'resume')}
				</div>
				<div class="btn-group" role="group">
					${tbtn('Lower Priority', 'arrow-down', 'priodown')}
					${tbtn('Remove', 'x-circle', 'cancel')}
					${tbtn('High Priority', 'arrow-up', 'prioup')}
				</div>
				<div class="btn-group" role="group">
					<select class="form-select" value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
						${['all', 'Waiting', 'Paused', 'Downloading'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}
					</select>
					<select class="form-select" value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
						<option value="all">all</option>
						${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
					</select>
					<a class="btn btn-primary" href="#" title="Filter"
						onClick=${(e) => { e.preventDefault(); setAStatus(fStatus); setACat(fCat); }}>
						<${Bi} name="funnel" /><div style="font-size:9px"><br />Filter</div>
					</a>
					<${GuestBadge} status=${status} />
				</div>
			</div>
		</div>

		<${Card} title="DOWNLOAD">
			<div class="table-responsive">
				<table class="table align-middle">
					<thead><tr>
						<th><${SortA} label="File name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Size" k="size" sort=${sort} /></th>
						<th><${SortA} label="Completed" k="size_done" sort=${sort} /></th>
						<th><${SortA} label="Speed" k="speed" sort=${sort} /></th>
						<th><${SortA} label="Progress" k="progress" sort=${sort} /></th>
						<th><${SortA} label="Sources" k="srccount" sort=${sort} /></th>
						<th><${SortA} label="Status" k="status" sort=${sort} /></th>
						<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((f) => html`
						<tr key=${f.hash} class=${rowCls(sel.has(f.hash))} style="cursor:pointer"
							onClick=${() => sel.toggle(f.hash)}>
							<td>${f.name || html`<span class="text-secondary">(unnamed) ${f.hash.slice(0, 10)}…</span>`}</td>
							<td>${fmtB(f.size)}</td>
							<td>${fmtB(f.size_done)} (${pct2(f.size_done, f.size)}%)</td>
							<td>${f.speed > 0 ? fmtB(f.speed) + '/s' : '-'}</td>
							<td style="min-width:120px">
								<div class="progress" role="progressbar" style="height:14px">
									<div class=${'progress-bar' + (statusString(f) === 'Paused' ? ' bg-secondary' : '')}
										style=${'width:' + pct2(f.size_done, f.size) + '%'}>${pct2(f.size_done, f.size)}%</div>
								</div>
							</td>
							<td>${sourcesText(f)}</td>
							<td>${statusString(f)}</td>
							<td>${prioString(f)}</td>
						</tr>`)}
						${downloads.length ? html`<tr class="amf-total">
							<td class="text-end pe-3">Total</td>
							<td>${fmtB(tot.size)}</td>
							<td>${fmtB(tot.done)} (${pct2(tot.done, tot.size)}%)</td>
							<td>${tot.speed > 0 ? fmtB(tot.speed) + '/s' : ''}</td>
							<td></td><td></td><td></td><td></td>
						</tr>` : ''}
					</tbody>
				</table>
			</div>
		<//>

		<${Card} title="UPLOAD">
			<div class="table-responsive">
				<table class="table align-middle">
					<thead><tr>
						<th>File Name</th><th>Username</th><th>Up</th><th>Down</th><th>Speed</th>
					</tr></thead>
					<tbody>
						${uploads.map((f, i) => html`
						<tr key=${i} class="amf-row">
							<td>${f.name}</td>
							<td>${f.user_name}</td>
							<td>${fmtB(f.xfer_up)}</td>
							<td>${fmtB(f.xfer_down)}</td>
							<td>${f.xfer_speed > 0 ? fmtB(f.xfer_speed) + '/s' : ''}</td>
						</tr>`)}
						${uploads.length ? html`<tr class="amf-total">
							<td class="text-end pe-3">Total</td><td></td>
							<td>${fmtB(utot.up)}</td><td>${fmtB(utot.dn)}</td><td>${fmtB(utot.speed)}/s</td>
						</tr>` : ''}
					</tbody>
				</table>
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* SHARED                                                               */
/* ==================================================================== */

function SharedView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [prio, setPrio] = useState('Select prio');
	const shared = (data && data.shared) || [];
	const rows = sort.sort(shared, {
		name: (f) => (f.name || '').toLowerCase(),
		xfer: (f) => Number(f.xfer), req: (f) => Number(f.req), acc: (f) => Number(f.accept),
		size: (f) => Number(f.size), prio: (f) => prioSort(f),
	});
	const run = (c, p) => {
		if (!guard()) return;
		if (c === 'reload') { apiPost('shared_cmd', { cmd: 'reload' }).then(refresh).catch(() => {}); return; }
		const list = sel.list();
		if (!list.length) return;
		apiPost('shared_cmd', { cmd: c, hashes: list.join(','), prio: p !== undefined ? p : 0 }).then(refresh).catch(() => {});
	};
	const setp = () => {
		const map = { Low: 0, Normal: 1, High: 2 };
		if (map[prio] === undefined) return;
		run('setprio', map[prio]);
	};
	return html`
	<div>
		<div class="panel-tasks">
			<div class="d-flex flex-wrap justify-content-center align-items-center gap-2">
				<div class="btn-group" role="group">
					<a class="btn btn-outline-light" href="#" title="Reload" onClick=${(e) => { e.preventDefault(); run('reload'); }}>
						<${Bi} name="arrow-clockwise" /><div style="font-size:9px"><br />Reload</div></a>
					<a class="btn btn-outline-light" href="#" title="High Priority" onClick=${(e) => { e.preventDefault(); run('prioup'); }}>
						<${Bi} name="arrow-up" /><div style="font-size:9px"><br />Higher</div></a>
					<a class="btn btn-outline-light" href="#" title="Lower Priority" onClick=${(e) => { e.preventDefault(); run('priodown'); }}>
						<${Bi} name="arrow-down" /><div style="font-size:9px"><br />Lower</div></a>
				</div>
				<div class="btn-group" role="group">
					<select class="form-select" value=${prio} onChange=${(e) => setPrio(e.target.value)}>
						${['Select prio', 'Low', 'Normal', 'High'].map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
					</select>
					<a class="btn btn-primary" href="#" title="Set priority" onClick=${(e) => { e.preventDefault(); setp(); }}>
						<${Bi} name="check2" /><div style="font-size:9px"><br />Set</div></a>
					<${GuestBadge} status=${status} />
				</div>
			</div>
		</div>
		<${Card} title="SHARED FILES">
			<div class="table-responsive">
				<table class="table align-middle">
					<thead><tr>
						<th><${SortA} label="File Name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Transferred" k="xfer" sort=${sort} /></th>
						<th><${SortA} label="Requests" k="req" sort=${sort} /></th>
						<th><${SortA} label="Accepted" k="acc" sort=${sort} /></th>
						<th><${SortA} label="Size" k="size" sort=${sort} /></th>
						<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((f) => html`
						<tr key=${f.hash} class=${rowCls(sel.has(f.hash))} style="cursor:pointer" onClick=${() => sel.toggle(f.hash)}>
							<td>${f.name}</td>
							<td>${fmtB(f.xfer)} (${fmtB(f.xfer_all)})</td>
							<td>${f.req} (${f.req_all})</td>
							<td>${f.accept} (${f.accept_all})</td>
							<td>${fmtB(f.size)}</td>
							<td>${prioString(f)}</td>
						</tr>`)}
					</tbody>
				</table>
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* SEARCH                                                               */
/* ==================================================================== */

function SearchView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [q, setQ] = useState('');
	const [avail, setAvail] = useState('');
	const [minV, setMinV] = useState(''); const [minU, setMinU] = useState('MByte');
	const [maxV, setMaxV] = useState(''); const [maxU, setMaxU] = useState('MByte');
	const [stype, setStype] = useState('Local');
	const [tcat, setTcat] = useState(0);

	const cats = (status && status.categories) || [];
	const results = (data && data.results) || [];
	const rows = sort.sort(results, {
		name: (f) => (f.name || '').toLowerCase(), size: (f) => Number(f.size), sources: (f) => Number(f.sources),
	});
	const doSearch = (e) => {
		e.preventDefault();
		if (!guard() || !q.trim()) return;
		const types = { Local: 0, Global: 1, Kad: 2 };
		apiPost('search_start', {
			keyword: q.trim(), type: types[stype] || 0, avail: avail || 0,
			minsize: minV ? Math.round(Number(minV) * UNITS[minU]) : 0,
			maxsize: maxV ? Math.round(Number(maxV) * UNITS[maxU]) : 0,
		}).then(refresh).catch(() => {});
	};
	const download = () => {
		if (!guard()) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('search_download', { hashes: list.join(','), cat: tcat }).then(refresh).catch(() => {});
		sel.clear();
	};
	const unitSel = (v, set) => html`<select class="form-select" style="max-width:110px" value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u} value=${u}>${u}</option>`)}
	</select>`;

	return html`
	<div>
		<div class="panel-tasks">
			<form onSubmit=${doSearch}>
				<div class="d-flex flex-wrap justify-content-center align-items-center gap-2 mb-2">
					<button class="btn btn-primary" type="button" title="Refresh results" onClick=${() => refresh()}><${Bi} name="arrow-clockwise" /></button>
					<input type="text" class="form-control" placeholder="Text query..." style="max-width:400px"
						value=${q} onInput=${(e) => setQ(e.target.value)} />
					<select class="form-select" style="max-width:150px" value=${stype} onChange=${(e) => setStype(e.target.value)}>
						${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
					</select>
					<button class="btn btn-primary" type="submit"><${Bi} name="search" /> Search</button>
				</div>
				<div class="d-flex flex-wrap justify-content-center align-items-center gap-2">
					<span>Avail.</span>
					<input type="text" class="form-control" style="max-width:90px" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
					<span>Min</span>
					<input type="text" class="form-control" style="max-width:80px" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
					${unitSel(minU, setMinU)}
					<span>Max</span>
					<input type="text" class="form-control" style="max-width:80px" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
					${unitSel(maxU, setMaxU)}
				</div>
			</form>
		</div>
		<${Card} title="SEARCH RESULTS">
			<div class="table-responsive">
				<table class="table align-middle">
					<thead><tr>
						<th><${SortA} label="File name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Size" k="size" sort=${sort} /></th>
						<th><${SortA} label="Sources" k="sources" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((f) => html`
						<tr key=${f.hash} class=${rowCls(sel.has(f.hash))} style="cursor:pointer" onClick=${() => sel.toggle(f.hash)}>
							<td>${f.name}</td>
							<td>${fmtB(f.size)}</td>
							<td>${f.sources}</td>
						</tr>`)}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-end align-items-center gap-2 mt-2">
				<a class="btn btn-success" href="#" onClick=${(e) => { e.preventDefault(); download(); }}>Download</a>
				<select class="form-select" style="max-width:150px" value=${tcat} onChange=${(e) => setTcat(+e.target.value)}>
					${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
				</select>
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* SERVERS                                                              */
/* ==================================================================== */

function ServersView({ data, status, guard, refresh }) {
	const sort = useSort('', 1);
	const [addr, setAddr] = useState(''); const [port, setPort] = useState(''); const [name, setName] = useState('');
	const guest = !!(status && status.guest);
	const servers = (data && data.servers) || [];
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(), desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users), files: (s) => Number(s.files),
	});
	const srvCmd = (cmd, s) => { if (guard()) apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {}); };
	const disconnect = () => { if (guard()) apiPost('server_disconnect', {}).then(refresh).catch(() => {}); };
	const add = (e) => {
		e.preventDefault();
		if (!guard() || !addr.trim() || !port.trim()) return;
		apiPost('server_add', { addr: addr.trim(), port: port.trim(), name: name.trim() })
			.then(() => { setAddr(''); setPort(''); setName(''); refresh(); }).catch(() => {});
	};
	return html`
	<div>
		<${Card} title="ADD SERVER">
			<form class="d-flex flex-wrap align-items-center gap-2" onSubmit=${add}>
				<input class="form-control" style="max-width:200px" placeholder="IP / host" disabled=${guest} value=${addr} onInput=${(e) => setAddr(e.target.value)} />
				<input class="form-control" style="max-width:100px" placeholder="Port" disabled=${guest} value=${port} onInput=${(e) => setPort(e.target.value)} />
				<input class="form-control" style="max-width:200px" placeholder="Name" disabled=${guest} value=${name} onInput=${(e) => setName(e.target.value)} />
				<button class="btn btn-primary" type="submit" disabled=${guest}><${Bi} name="plus-lg" /> Add</button>
				<button class="btn btn-outline-light ms-auto" type="button" disabled=${guest} onClick=${disconnect}><${Bi} name="plug" /> Disconnect</button>
			</form>
		<//>
		<${Card} title="SERVERS">
			<div class="table-responsive">
				<table class="table align-middle">
					<thead><tr>
						<th></th>
						<th><${SortA} label="Server Name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Description" k="desc" sort=${sort} /></th>
						<th>Address</th>
						<th><${SortA} label="Users" k="users" sort=${sort} /></th>
						<th><${SortA} label="Files" k="files" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((s) => html`
						<tr key=${s.ip + ':' + s.port} class="amf-row">
							<td style="white-space:nowrap">
								${guest ? '' : html`
									<a class="btn btn-sm btn-outline-light" href="#" title="Connect" onClick=${(e) => { e.preventDefault(); srvCmd('connect', s); }}><${Bi} name="plug" /></a>
									<a class="btn btn-sm btn-outline-light" href="#" title="Remove" onClick=${(e) => { e.preventDefault(); srvCmd('remove', s); }}><${Bi} name="trash" /></a>`}
							</td>
							<td>${s.name}</td>
							<td>${s.desc}</td>
							<td>${s.addr}</td>
							<td>${s.users}</td>
							<td>${s.files}</td>
						</tr>`)}
					</tbody>
				</table>
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* KAD                                                                  */
/* ==================================================================== */

function KadView({ status, guard, refresh, tick }) {
	const [ip, setIp] = useState(['', '', '', '']);
	const [port, setPort] = useState('');
	const [url, setUrl] = useState('');
	const [gready, setGready] = useState(false);
	const kad = (status && status.kad) || { connected: false };
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const act = (action, extra) => { if (guard()) apiPost('kad', Object.assign({ action }, extra || {})).then(refresh).catch(() => {}); };
	const connectIp = (e) => {
		e.preventDefault();
		// the stock form posts octets low-to-high (ip0 is the last one)
		act('connect_ip', { ip0: ip[3], ip1: ip[2], ip2: ip[1], ip3: ip[0], port });
	};
	const ipIn = (i) => html`<input class="form-control" type="text" maxlength="3" placeholder="255" style="max-width:60px"
		value=${ip[i]} onInput=${(e) => setIp((p) => { const n = p.slice(); n[i] = e.target.value; return n; })} />`;
	return html`
	<div>
		<${Card} title="KAD STATUS">
			<div class="d-flex flex-wrap align-items-center gap-3">
				<span class=${'badge ' + (kad.connected ? 'bg-success' : 'bg-secondary')}>
					Kad: ${kad.connected ? (kad.firewalled ? 'Connected (firewalled)' : 'Connected') : 'Disconnected'}
				</span>
				<button class="btn btn-outline-light" onClick=${() => act('connect_known')}><${Bi} name="diagram-3" /> Connect (known nodes)</button>
				<button class="btn btn-outline-light" onClick=${() => act('disconnect')}><${Bi} name="x-circle" /> Disconnect</button>
			</div>
		<//>
		<${Card} title="BOOTSTRAP FROM NODE">
			<form class="d-flex flex-wrap align-items-center gap-2" onSubmit=${connectIp}>
				${ipIn(0)} ${ipIn(1)} ${ipIn(2)} ${ipIn(3)}
				<input class="form-control" type="text" maxlength="5" placeholder="Port" style="max-width:90px"
					value=${port} onInput=${(e) => setPort(e.target.value)} />
				<button class="btn btn-primary" type="submit"><${Bi} name="plug" /> Connect</button>
			</form>
			<form class="d-flex flex-wrap align-items-center gap-2 mt-3" onSubmit=${(e) => { e.preventDefault(); if (url.trim()) act('update_url', { url: url.trim() }); }}>
				<input class="form-control" type="text" placeholder="nodes.dat URL" style="max-width:320px"
					value=${url} onInput=${(e) => setUrl(e.target.value)} />
				<button class="btn btn-outline-light" type="submit"><${Bi} name="arrow-repeat" /> Update from URL</button>
			</form>
		<//>
		<${Card} title="NODES">
			${gready && !MOCK
				? html`<img src=${'amule_stats_kad.png?v=' + tick} class="img-fluid rounded" alt="Kad nodes" />`
				: html`<div class="graphbox"></div>`}
		<//>
	</div>`;
}

/* ==================================================================== */
/* STATS (carousel of graphs + tree)                                    */
/* ==================================================================== */

function TreeNode({ name, node }) {
	const [open, setOpen] = useState(true);
	if (node === null || node === undefined) {
		return html`<div class="amf-leaf"><${Bi} name="dot" /> ${name}</div>`;
	}
	return html`
	<div>
		<div class="amf-branch" style="cursor:pointer" onClick=${() => setOpen((o) => !o)}>
			<${Bi} name=${open ? 'dash-square' : 'plus-square'} /> ${name}
		</div>
		${open ? html`<div class="ms-3">
			${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}
		</div>` : ''}
	</div>`;
}

function StatsView({ tick }) {
	const [tree, setTree] = useState(null);
	const [gready, setGready] = useState(false);
	const [slide, setSlide] = useState(0);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		apiGet('statstree').then((d) => { if (alive) setTree(d || null); }).catch(() => {});
		return () => { alive = false; };
	}, [tick]);
	const graphs = [
		['amule_stats_download.png', 'Download speed'],
		['amule_stats_upload.png', 'Upload speed'],
		['amule_stats_conncount.png', 'Connections'],
		['amule_stats_kad.png', 'Kad nodes'],
	];
	const go = (d) => setSlide((s) => (s + d + graphs.length) % graphs.length);
	return html`
	<div class="row g-3">
		<div class="col-lg-6">
			<${Card} title="STATISTICS TREE">
				<div class="amf-tree">
					${tree
						? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)
						: html`<span class="text-secondary">Loading…</span>`}
				</div>
			<//>
		</div>
		<div class="col-lg-6">
			<${Card} title="GRAPHS">
				<div class="amf-carousel">
					${gready && !MOCK
						? html`<img src=${graphs[slide][0] + '?v=' + tick} class="d-block w-100 rounded" alt=${graphs[slide][1]} />`
						: html`<div class="graphbox"></div>`}
					<div class="d-flex justify-content-between align-items-center mt-2">
						<button class="btn btn-outline-light btn-sm" onClick=${() => go(-1)}><${Bi} name="chevron-left" /></button>
						<span>${graphs[slide][1]}</span>
						<button class="btn btn-outline-light btn-sm" onClick=${() => go(1)}><${Bi} name="chevron-right" /></button>
					</div>
				</div>
			<//>
		</div>
	</div>`;
}

/* ==================================================================== */
/* PREFERENCES                                                          */
/* ==================================================================== */

function PrefsView({ status, guard }) {
	const [form, setForm] = useState(null);
	const guest = !!(status && status.guest);
	const load = useCallback(() => apiGet('options').then((o) => {
		const f = Object.assign({}, o); delete f.categories; setForm(f);
	}).catch(() => {}), []);
	useEffect(() => { load(); }, [load]);
	if (!form) return html`<${Card} title="PREFERENCES"><span class="text-secondary">Loading…</span><//>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const txt = (k, label) => html`
		<div class="col-md-6 mb-3">
			<label class="form-label">${label}</label>
			<input class="form-control" disabled=${guest} value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />
		</div>`;
	const chk = (k, label) => html`
		<div class="col-md-6 mb-2 form-check">
			<input class="form-check-input" type="checkbox" id=${'pf-' + k} disabled=${guest}
				checked=${form[k] === '1' || form[k] === 1} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />
			<label class="form-check-label" for=${'pf-' + k}>${label}</label>
		</div>`;
	const apply = () => {
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(load).catch(() => {});
	};
	return html`
	<div>
		<${Card} title="CONNECTION">
			<div class="row">
				${txt('max_down_limit', 'Max download rate')}
				${txt('max_up_limit', 'Max upload rate')}
				${txt('max_line_down_cap', 'Download capacity')}
				${txt('max_line_up_cap', 'Upload capacity')}
				${txt('max_conn_total', 'Max total connections')}
				${txt('max_file_src', 'Max sources per file')}
				${txt('tcp_port', 'TCP port')}
				${txt('udp_port', 'UDP port')}
			</div>
			<div class="row">
				${chk('autoconn_en', 'Autoconnect at startup')}
				${chk('reconn_en', 'Reconnect when connection lost')}
				${chk('network_ed2k', 'Enable ED2K network')}
				${chk('network_kad', 'Enable Kademlia network')}
				${chk('udp_dis', 'Disable UDP connections')}
			</div>
		<//>
		<${Card} title="FILES">
			<div class="row">
				${chk('ich_en', 'I.C.H. active')}
				${chk('aich_trust', 'AICH trusts every hash (not recommended)')}
				${chk('new_files_paused', 'Add files to download queue in pause mode')}
				${chk('new_files_auto_dl_prio', 'Added download files have auto priority')}
				${chk('new_files_auto_ul_prio', 'New shared files have auto priority')}
				${chk('extract_metadata', 'Extract metadata tags')}
				${chk('alloc_full', 'Alloc full disk space for .part files')}
				${chk('check_free_space', 'Check free space')}
				${txt('min_free_space', 'Minimum free space (Mb)')}
			</div>
		<//>
		<${Card} title="WEBSERVER">
			<div class="row">
				${txt('autorefresh_time', 'Page refresh interval')}
				${chk('use_gzip', 'Use gzip compression')}
			</div>
			<div class="text-end">
				${guest
					? html`<b>You can not change options - logged in as guest</b>`
					: html`<button class="btn btn-primary" onClick=${apply}><${Bi} name="check2" /> Apply</button>`}
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* LOG                                                                  */
/* ==================================================================== */

function LogView() {
	const [log, setLog] = useState('');
	const [srv, setSrv] = useState('');
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<div>
		<${Card} title=${html`aMule log <a href="#" class="reset-link" onClick=${(e) => { e.preventDefault(); if (confirm('Reset aMule log?')) loadLog(1); }}>(reset)</a>`}>
			<pre class="logpre">${log || ' '}</pre>
		<//>
		<${Card} title=${html`Serverinfo <a href="#" class="reset-link" onClick=${(e) => { e.preventDefault(); if (confirm('Reset Serverinfo?')) loadSrv(1); }}>(reset)</a>`}>
			<pre class="logpre small">${srv || ' '}</pre>
		<//>
	</div>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

const VIEWS = ['download', 'shared', 'search', 'servers', 'kad', 'stats', 'prefs', 'log'];
const VIEW_ROUTE = { download: 'transfers', shared: 'shared', servers: 'servers', search: 'search' };
const REFRESH_MS = 5000;

const initialView = () => {
	const h = location.hash.replace('#', '');
	return VIEWS.indexOf(h) >= 0 ? h : 'download';
};

function App() {
	const [view, setView] = useState(initialView);
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [tick, setTick] = useState(0);
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
			if (route) { const d = await apiGet(route); setData(d); }
			setTick((t) => t + 1);
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
		}
	};
	const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

	const vp = { data, status, guard, refresh, tick };
	let body;
	if (view === 'download') body = html`<${TransferView} ...${vp} />`;
	else if (view === 'shared') body = html`<${SharedView} ...${vp} />`;
	else if (view === 'search') body = html`<${SearchView} ...${vp} />`;
	else if (view === 'servers') body = html`<${ServersView} ...${vp} />`;
	else if (view === 'kad') body = html`<${KadView} ...${vp} />`;
	else if (view === 'stats') body = html`<${StatsView} tick=${tick} />`;
	else if (view === 'prefs') body = html`<${PrefsView} status=${status} guard=${guard} />`;
	else if (view === 'log') body = html`<${LogView} />`;

	return html`
	<div>
		<${Navbar} view=${view} go=${go} theme=${theme} toggleTheme=${toggleTheme} />
		<main class="container-fluid amf-main">${body}</main>
		<${Ed2kFooter} status=${status} guard=${guard} />
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
