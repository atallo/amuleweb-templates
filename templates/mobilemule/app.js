/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "mobilemule": elbowz/mobileMule (GPL-3.0) rebuilt as a
 * single-page app on the shared JSON layer (api.php). jQuery Mobile is
 * replaced by the Onsen UI CSS components (the page structure, hashes,
 * localStorage-persisted settings, turtle mode, finished-downloads tracker
 * and per-page refresh timers follow the original). Font Awesome and all
 * CDNs are gone: icons are inline SVG and everything is self-hosted.
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

const A = new URL('.', import.meta.url).pathname;

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
/* Settings (localStorage, mirrors the original mm.settings)            */
/* ==================================================================== */

const DEFAULTS = {
	mainHash: '#page-status',
	notifyDelay: 6000,
	theme: 'light',
	turtleDown: 10, turtleUp: 4,
	statusRefresh: 3000, tickChart: 10,
	downloadsRefresh: 3000,
	graphRefresh: 3000,
	dlFilterStatus: 'all', dlFilterCat: 'all', dlSortOn: 'name', dlSortRev: '0',
};
const store = {
	read() {
		try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('mm-settings') || '{}')); }
		catch (e) { return Object.assign({}, DEFAULTS); }
	},
	write(patch) {
		const s = Object.assign(this.read(), patch);
		try { localStorage.setItem('mm-settings', JSON.stringify(s)); } catch (e) { /* ignore */ }
		return s;
	},
};

// finished-downloads tracker (the original used IndexedDB; a localStorage
// map of hash -> {name, size} keeps the exact same behavior)
const known = {
	read() {
		try { return JSON.parse(localStorage.getItem('mm-known-downloads') || '{}'); } catch (e) { return {}; }
	},
	write(map) { try { localStorage.setItem('mm-known-downloads', JSON.stringify(map)); } catch (e) { /* ignore */ } },
	addCurrent(list) {
		const map = this.read();
		(list || []).forEach((f) => { map[f.hash] = { hash: f.hash, name: f.name, size: f.size }; });
		this.write(map);
	},
	remove(hash) { const m = this.read(); delete m[hash]; this.write(m); },
	clearToCurrent(list) {
		const m = {};
		(list || []).forEach((f) => { m[f.hash] = { hash: f.hash, name: f.name, size: f.size }; });
		this.write(m);
	},
};

/* ==================================================================== */
/* Helpers                                                              */
/* ==================================================================== */

// the original's bytesToSize (toPrecision(3), uppercase units)
function bytesToSize(bytes) {
	bytes = Number(bytes) || 0;
	if (bytes === 0) return '0 Byte';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
}
const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioString(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio);
	if (f.prio_auto == 1) s += '(auto)';
	return s;
}
function statusString(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}
const BAR_CLASS = { Paused: 'pause', Downloading: 'downloading', Waiting: 'waiting' };
function sourcesText(f) {
	let s = '';
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + ' / ';
	s += f.src_count + ' ( ' + f.src_count_xfer + ' )';
	if (f.src_count_a4af != 0) s += ' + ' + f.src_count_a4af;
	return s;
}
const UNITS = { Byte: 1, KByte: 1024, MByte: 1048576, GByte: 1073741824 };

// poll helper: per-page timer like the original pages, hidden-tab aware
function usePoll(fn, ms, deps) {
	useEffect(() => {
		let alive = true;
		const run = (force) => { if (alive && (force || !document.hidden)) fn(); };
		run(true);
		const t = ms ? setInterval(() => run(false), ms) : 0;
		const onVis = () => { if (!document.hidden) run(true); };
		document.addEventListener('visibilitychange', onVis);
		return () => { alive = false; if (t) clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
		// eslint-disable-next-line
	}, deps || []);
}

/* ==================================================================== */
/* Icons (inline SVG, Font Awesome 4 equivalents used by the original)  */
/* ==================================================================== */

const GI = {
	bars: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
	home: 'M12 3l9 8h-3v9h-4v-6H10v6H6v-9H3z',
	download: 'M11 4h2v8h3l-4 5-4-5h3zM5 19h14v2H5z',
	'cloud-download': 'M17 9a5 5 0 0 0-9.8-1.4A4 4 0 0 0 8 16h3v-5h2v5h3.5a3.5 3.5 0 0 0 .5-7zM12 21l-3.5-4h7z',
	upload: 'M12 4l4 5h-3v8h-2V9H8zM5 19h14v2H5z',
	'share-alt': 'M18 16a3 3 0 0 0-2.4 1.2l-7-3.5a3 3 0 0 0 0-1.4l7-3.5A3 3 1 1 0 15 7a3 3 0 0 0 .1.7l-7 3.5a3 3 0 1 0 0 3.6l7 3.5a3 3 0 1 0 2.9-2.3z',
	search: 'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
	cogs: 'M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5zM13 15a3 3 0 1 1 3-3 3 3 0 0 1-3 3z',
	cog: 'M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5zM13 15a3 3 0 1 1 3-3 3 3 0 0 1-3 3z',
	database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zm8 6v3c0 1.7-3.6 3-8 3s-8-1.3-8-3V9c1.8 1.3 5 2 8 2s6.2-.7 8-2zm0 6v3c0 1.7-3.6 3-8 3s-8-1.3-8-3v-3c1.8 1.3 5 2 8 2s6.2-.7 8-2z',
	tachometer: 'M12 5a9 9 0 0 0-9 9 9 9 0 0 0 1.2 4.5h15.6A9 9 0 0 0 21 14a9 9 0 0 0-9-9zm1 9a1.5 1.5 0 1 1-2-1.4l4.5-5-2.8 5.7A1.5 1.5 0 0 1 13 14z',
	'bar-chart-o': 'M4 19h3v-8H4zm6 0h3V5h-3zm6 0h3v-12h-3zM3 21h18v1H3z',
	plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
	'unlock-alt': 'M17 9V7a5 5 0 0 0-9.8-1.4l1.9.6A3 3 0 0 1 15 7v2H6v12h12V9zm-4 7.7V19h-2v-2.3a2 2 0 1 1 2 0z',
	users: 'M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm6 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-6 2c-2.7 0-6 1.3-6 3v3h12v-3c0-1.7-3.3-3-6-3zm6 0a7 7 0 0 0-1.6.2A4.2 4.2 0 0 1 15 16v3h6v-3c0-1.7-3.3-3-6-3z',
	rocket: 'M12 3c3.5 1.5 5 4.5 5 8l2.5 3-3 .8a14 14 0 0 1-1.6 2.2l-2.9-.7-2.9.7a14 14 0 0 1-1.6-2.2l-3-.8L7 11c0-3.5 1.5-6.5 5-8zm0 6.5A1.5 1.5 0 1 0 12 6.5a1.5 1.5 0 0 0 0 3zM9 18.5 7.5 21h9L15 18.5z',
	trash: 'M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z',
	play: 'M8 5v14l11-7z',
	pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
	'chevron-up': 'M12 8l8 8-1.5 1.5L12 11l-6.5 6.5L4 16z',
	'chevron-down': 'M12 16 4 8l1.5-1.5L12 13l6.5-6.5L20 8z',
	'chevron-left': 'M15 4l-8 8 8 8 1.5-1.5L10 12l6.5-6.5z',
	'arrow-u': 'M12 4l6 6h-4v10h-4V10H6z',
	copyright: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm3.3 11.7A4.5 4.5 0 1 1 15.4 9l-1.5 1.4a2.5 2.5 0 1 0 0 3z',
	'info-circle': 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm1 13h-2v-6h2zm0-8h-2V6h2z',
	warn: 'M12 3 1 21h22zM13 17h-2v2h2zm0-7h-2v5h2z',
	plug: 'M14 2h-2v6h2zM8 2H6v6h2zm9 8H3v2a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 17 12z',
	'thumbs-up': 'M3 10h3v11H3zm5 11h9.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 19 10h-5V5a2 2 0 0 0-2-2l-1 7v11z',
	'thumbs-down': 'M21 14h-3V3h3zm-5-11H6.5a2 2 0 0 0-2 1.6l-1.4 7A2 2 0 0 0 5 14h5v5a2 2 0 0 0 2 2l1-7V3z',
	'line-chart': 'M3 19h18v2H3zm2-2 5-6 3 3 6-8 1.6 1.2-7.4 9.8-3-3L6.6 18z',
	check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
};
const Gi = ({ n, lg, cls }) => html`<svg class=${'gi' + (lg ? ' gi-lg' : '') + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" aria-hidden="true"><path d=${GI[n]} /></svg>`;

/* ==================================================================== */
/* Menu / pages registry (same entries and hashes as the original)      */
/* ==================================================================== */

const MENU = [
	['page-status', 'Status', 'home'],
	['page-downloads', 'Downloads', 'download'],
	['page-finished', 'Finished', 'cloud-download'],
	['page-uploads', 'Uploads', 'upload'],
	['page-shared', 'Shared', 'share-alt'],
	['page-search', 'Search', 'search'],
	['page-config', 'Settings', 'cogs'],
	['page-mobilemule', 'MobileMule', 'cog'],
	['page-servers', 'Servers', 'database'],
	['page-listed-stats', 'Statistics', 'tachometer'],
	['page-graph', 'Graphs', 'bar-chart-o'],
	['page-log', 'Log', 'bars'],
	['page-footer', 'Add ed2k', 'plus'],
];
const TITLES = Object.assign({ 'page-collapsible-stats': ['Statistics', 'tachometer'], 'page-donate': ['About', 'info-circle'] },
	Object.fromEntries(MENU.map(([id, label, icon]) => [id, [label, icon]])));

/* ==================================================================== */
/* Notify (toast, replaces the jQM popup notify)                        */
/* ==================================================================== */

let pushToast = () => {};
function Toasts() {
	const [items, setItems] = useState([]);
	useEffect(() => {
		pushToast = (msg, isErr) => {
			const id = Math.random().toString(36).slice(2);
			setItems((t) => t.concat({ id, msg, isErr }));
			setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), store.read().notifyDelay);
		};
		return () => { pushToast = () => {}; };
	}, []);
	return html`${items.map((t) => html`<div key=${t.id} class=${'mm-toast' + (t.isErr ? ' error' : '')}>
		<${Gi} n=${t.isErr ? 'warn' : 'info-circle'} /> ${' '}${t.msg}</div>`)}`;
}
const notify = { message: (m) => pushToast(m, false), error: (m) => pushToast(m, true) };

/* ==================================================================== */
/* Status page                                                          */
/* ==================================================================== */

function SpeedChart({ hist }) {
	const W = 320, H = 150, P = 14;
	const max = Math.max(1, ...hist.map((p) => Math.max(p.d, p.u)));
	const path = (key) => {
		if (!hist.length) return '';
		const step = (W - 2 * P) / Math.max(hist.length - 1, 1);
		let d = 'M' + P + ' ' + (H - P);
		hist.forEach((p, i) => {
			const x = P + i * step;
			const y = H - P - (p[key] / max) * (H - 2 * P);
			d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
		});
		return d + ' L' + (W - P) + ' ' + (H - P) + ' Z';
	};
	return html`<svg class="mm-chart" viewBox=${'0 0 ' + W + ' ' + H} preserveAspectRatio="none">
		<path class="up" d=${path('u')} />
		<path class="dn" d=${path('d')} />
		<text x=${P} y="10">${bytesToSize(max)}/s</text>
	</svg>`;
}

function StatusPage({ guard }) {
	const [st, setSt] = useState(null);
	const [hist, setHist] = useState([]);
	const [turtle, setTurtle] = useState(false);
	const [turtleBusy, setTurtleBusy] = useState(false);
	const s = store.read();

	usePoll(() => {
		apiGet('status').then((d) => {
			setSt(d);
			setHist((h) => {
				const n = h.concat({ d: Number(d.speed_down) || 0, u: Number(d.speed_up) || 0 });
				while (n.length > s.tickChart) n.shift();
				return n;
			});
		}).catch(() => {});
	}, s.statusRefresh, []);

	useEffect(() => {
		apiGet('options').then((o) => {
			setTurtle(Number(o.max_down_limit) == s.turtleDown && Number(o.max_up_limit) == s.turtleUp);
		}).catch(() => {});
	}, []);

	// NOTE: api.php's set_options replaces every option, so the full current
	// option set is fetched, patched and sent back (the original hit a
	// partial set-config endpoint instead).
	const toggleTurtle = async (enable) => {
		if (!guard() || turtleBusy) return;
		setTurtleBusy(true);
		try {
			const o = await apiGet('options');
			delete o.categories;
			if (enable) {
				store.write({ tmDownBak: o.max_down_limit, tmUpBak: o.max_up_limit });
				o.max_down_limit = String(s.turtleDown);
				o.max_up_limit = String(s.turtleUp);
			} else {
				const cur = store.read();
				o.max_down_limit = String(cur.tmDownBak !== undefined ? cur.tmDownBak : 100);
				o.max_up_limit = String(cur.tmUpBak !== undefined ? cur.tmUpBak : 10);
			}
			await apiPost('set_options', o);
			setTurtle(enable);
			notify.message(enable ? 'Turtle mode enabled' : 'Turtle mode disabled');
		} catch (e) { notify.error('Could not change limits'); }
		setTurtleBusy(false);
	};

	const ed2k = (st && st.ed2k) || { state: 'disconnected' };
	const kad = (st && st.kad) || { connected: false };
	let srvTxt;
	if (ed2k.state === 'connecting') srvTxt = html`Server (Connecting ...)`;
	else if (ed2k.state !== 'connected') srvTxt = html`Server (Not connected <${Gi} n="plug" />)`;
	else srvTxt = html`Server (Connected with ${ed2k.lowid ? 'low' : 'high'} ID <${Gi} n=${ed2k.lowid ? 'thumbs-down' : 'thumbs-up'} />)`;
	const kadTxt = kad.connected
		? html`Kad (Connected ${kad.firewalled ? html`but Firewalled <${Gi} n="thumbs-down" />` : html`OK <${Gi} n="thumbs-up" />`})`
		: html`Kad (Not connected <${Gi} n="plug" />)`;

	const go = (h) => { location.hash = h; };
	return html`
	<div class="list">
		<div class="mm-divider"><${Gi} n="rocket" /> Speed</div>
		<div class="list-item mm-item" onClick=${() => go('#page-downloads')}>
			<div class="list-item__center">
				<div>
					<h3><${Gi} n="download" /> ${st ? bytesToSize(st.speed_down) + '/s' : 'n'} <small>/ ${st ? bytesToSize(st.speed_limit_down) + '/s' : 'n'}</small></h3>
					<p><strong>Download <small>/ Limit</small></strong></p>
				</div>
			</div>
		</div>
		<div class="list-item mm-item" onClick=${() => go('#page-uploads')}>
			<div class="list-item__center">
				<div>
					<h3><${Gi} n="upload" /> ${st ? bytesToSize(st.speed_up) + '/s' : 'n'} <small>/ ${st ? bytesToSize(st.speed_limit_up) + '/s' : 'n'}</small></h3>
					<p><strong>Upload <small>/ Limit</small></strong></p>
				</div>
			</div>
		</div>
		<div class="list-item mm-item">
			<div class="list-item__center" style="width:100%; display:flex; align-items:center; justify-content:space-between">
				<div>
					<h3><${Gi} n="tachometer" /> Turtle mode</h3>
					<p><strong>${s.turtleDown} / ${s.turtleUp} KB/s</strong> <small>Bandwidth (<a class="linklike" href="#page-mobilemule">change it</a>)</small></p>
				</div>
				<label class="switch">
					<input type="checkbox" class="switch__input" checked=${turtle} disabled=${turtleBusy}
						onChange=${(e) => toggleTurtle(e.target.checked)} />
					<div class="switch__toggle"><div class="switch__handle"></div></div>
				</label>
			</div>
		</div>
		<div class="mm-divider"><${Gi} n="database" /> ${srvTxt}</div>
		${ed2k.state === 'connected' ? html`
		<div class="list-item mm-item" onClick=${() => go('#page-servers')}>
			<div class="list-item__center" style="width:100%; display:flex; align-items:center; justify-content:space-between">
				<div>
					<h3>${ed2k.server}</h3>
					<p><strong>${ed2k.addr}</strong></p>
				</div>
				<span class="count-bubble"><${Gi} n="users" /> ${ed2k.users}</span>
			</div>
		</div>` : ''}
		<div class="mm-divider"><${Gi} n="share-alt" /> ${kadTxt}</div>
		<div class="mm-divider"><${Gi} n="line-chart" /> Real-time Speed Chart</div>
		<div class="list-item"><${SpeedChart} hist=${hist} /></div>
		<div class="list-item"><p>this info is refreshed each <strong>${s.statusRefresh / 1000}</strong> seconds (<a class="linklike" href="#page-mobilemule">change it</a>)</p></div>
	</div>`;
}

/* ==================================================================== */
/* Downloads page                                                       */
/* ==================================================================== */

function DownloadsPage({ guard }) {
	const s0 = store.read();
	const [data, setData] = useState(null);
	const [sel, setSel] = useState(() => new Set());
	const [ftext, setFtext] = useState('');
	const [fStatus, setFStatus] = useState(s0.dlFilterStatus);
	const [fCat, setFCat] = useState(s0.dlFilterCat);
	const [sortOn, setSortOn] = useState(s0.dlSortOn);
	const [sortRev, setSortRev] = useState(s0.dlSortRev === '1');
	const [cats, setCats] = useState([]);

	usePoll(() => {
		apiGet('transfers').then((d) => {
			setData(d);
			known.addCurrent(d.downloads || []);
		}).catch(() => {});
	}, s0.downloadsRefresh, []);
	useEffect(() => { apiGet('status').then((d) => setCats(d.categories || [])).catch(() => {}); }, []);

	const downloads = (data && data.downloads) || [];
	const ACC = {
		name: (f) => (f.name || '').toLowerCase(),
		size: (f) => Number(f.size),
		size_done: (f) => Number(f.size_done),
		speed: (f) => Number(f.speed),
		progress: (f) => Number(f.size_done) / Math.max(1, Number(f.size)),
		srccount: (f) => Number(f.src_count),
		status: (f) => statusString(f),
		prio: (f) => Number(f.prio),
	};
	let list = downloads.filter((f) => {
		if (fStatus !== 'all' && statusString(f) !== fStatus) return false;
		if (fCat !== 'all') { const i = cats.indexOf(fCat); if (i >= 0 && f.category !== i) return false; }
		if (ftext && !(f.name || '').toUpperCase().includes(ftext.toUpperCase())) return false;
		return true;
	});
	const acc = ACC[sortOn] || ACC.name;
	list = list.slice().sort((a, b) => { const x = acc(a), y = acc(b); return (x < y ? -1 : x > y ? 1 : 0) * (sortRev ? -1 : 1); });

	const toggle = (h) => setSel((p) => { const n = new Set(p); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const run = (cmd, hashes, msg) => {
		if (!guard()) return;
		if (!hashes.length) return;
		if (cmd === 'cancel') {
			if (!confirm('Delete selected files ?')) return;
			hashes.forEach((h) => known.remove(h));
		}
		apiPost('dload_cmd', { cmd, hashes: hashes.join(',') })
			.then(() => { if (msg) notify.message(msg); return apiGet('transfers'); })
			.then(setData).catch(() => {});
	};
	const CMDS = [
		['pause', 'pause', 'Pause', 'Paused'],
		['resume', 'play', 'Resume', 'Resumed'],
		['prioup', 'chevron-up', 'Prio. up', 'Priority Up'],
		['priodown', 'chevron-down', 'Prio. down', 'Priority Down'],
		['cancel', 'trash', 'Cancel', 'File deleted'],
	];
	const persist = (patch) => store.write(patch);

	return html`
	<div>
		<div class="cmdbar">
			${CMDS.map(([cmd, icon, label, msg]) => html`<button key=${cmd}
				onClick=${() => run(cmd, Array.from(sel), msg)}>
				<${Gi} n=${icon} /><span>${label}</span></button>`)}
		</div>
		<div class="page-pad">
			<input class="text-input searchbox" type="search" placeholder="Filter by name..."
				value=${ftext} onInput=${(e) => setFtext(e.target.value)} />
		</div>
		<div class="list">
			<div class="mm-divider">Downloads<span class="count-bubble">${list.length}</span></div>
			${list.map((f) => {
				const st = statusString(f);
				const pctv = Number(f.size) > 0 ? (Number(f.size_done) * 100 / Number(f.size)) : 0;
				return html`
				<div key=${f.hash} class=${'list-item mm-item' + (sel.has(f.hash) ? ' selected' : '')}
					onClick=${() => toggle(f.hash)}>
					<div style="width:100%; padding-right:34px">
						<h3 title=${f.name}>${f.name || '(unnamed) · ' + f.hash.slice(0, 10) + '…'}</h3>
						<p>${f.speed > 0 ? html`<strong>${bytesToSize(f.speed)}/s</strong> - ` : ''}${st} - ${prioString(f)}</p>
						<p>${sourcesText(f)} - ${f.last_seen_complete ? 'seen completed' : 'never seen completed'}</p>
						<div class="bar"><div class=${'completed-bar ' + BAR_CLASS[st]} style=${'width:' + pctv.toFixed(1) + '%'}>
							${bytesToSize(f.size_done)} / ${bytesToSize(f.size)}</div></div>
						<div class="file-command" onClick=${(e) => e.stopPropagation()}>
							<button title="Resume" onClick=${() => run('resume', [f.hash], 'Resumed')}><${Gi} n="play" /></button>
							<button title="Pause" onClick=${() => run('pause', [f.hash], 'Paused')}><${Gi} n="pause" /></button>
							<button title="Prio up" onClick=${() => run('prioup', [f.hash], 'Priority Up')}><${Gi} n="chevron-up" /></button>
							<button title="Prio down" onClick=${() => run('priodown', [f.hash], 'Priority Down')}><${Gi} n="chevron-down" /></button>
							<button title="Cancel" onClick=${() => run('cancel', [f.hash], 'File deleted')}><${Gi} n="trash" /></button>
						</div>
						<span class="count-bubble" style="position:absolute; right:8px; top:8px">${pctv.toFixed(0)}%</span>
					</div>
				</div>`;
			})}
			<div class="list-item"><p>this info is refreshed each <strong>${s0.downloadsRefresh / 1000}</strong> seconds (<a class="linklike" href="#page-mobilemule">change it</a>)</p></div>
		</div>
		<div class="page-pad">
			<div class="mm-field">
				<label>Filter (status / category):</label>
				<select class="select-input" value=${fStatus} onChange=${(e) => { setFStatus(e.target.value); persist({ dlFilterStatus: e.target.value }); }}>
					${['all', 'Waiting', 'Paused', 'Downloading'].map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
				</select>
				<select class="select-input" value=${fCat} onChange=${(e) => { setFCat(e.target.value); persist({ dlFilterCat: e.target.value }); }}>
					<option value="all">all</option>
					${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
				</select>
			</div>
			<div class="mm-field">
				<label>Sort:</label>
				<select class="select-input" value=${sortOn} onChange=${(e) => { setSortOn(e.target.value); persist({ dlSortOn: e.target.value }); }}>
					<option value="name">File name</option>
					<option value="size">Size</option>
					<option value="size_done">Completed</option>
					<option value="speed">Download speed</option>
					<option value="progress">Progress</option>
					<option value="srccount">Sources</option>
					<option value="status">Status</option>
					<option value="prio">Priority</option>
				</select>
				<button class="button--outline button" onClick=${() => { setSortRev(!sortRev); persist({ dlSortRev: !sortRev ? '1' : '0' }); }}>
					${sortRev ? 'Ascendent ↑' : 'Descendent ↓'}
				</button>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Finished page                                                        */
/* ==================================================================== */

function FinishedPage() {
	const [ftext, setFtext] = useState('');
	const [, force] = useState(0);
	const [current, setCurrent] = useState(null);
	useEffect(() => {
		apiGet('transfers').then((d) => {
			known.addCurrent(d.downloads || []);
			setCurrent((d.downloads || []).map((f) => f.hash));
		}).catch(() => setCurrent([]));
	}, []);
	if (current === null) return html`<div class="page-pad">Loading…</div>`;
	let list = Object.values(known.read()).filter((f) => current.indexOf(f.hash) < 0);
	if (ftext) list = list.filter((f) => (f.name || '').toUpperCase().includes(ftext.toUpperCase()));
	return html`
	<div>
		<div class="page-pad">
			<input class="text-input searchbox" type="search" placeholder="Filter by name..."
				value=${ftext} onInput=${(e) => setFtext(e.target.value)} />
		</div>
		<div class="list">
			<div class="mm-divider">Finished downloads<span class="count-bubble">${list.length}</span></div>
			${list.map((f) => html`<div key=${f.hash} class="list-item mm-item">
				<div><h3>${f.name}</h3><p>${bytesToSize(f.size)}</p></div>
			</div>`)}
			<div class="list-item"><p><strong>Important:</strong> the listed files was present last time you connected in downloads and no more there</p></div>
		</div>
		<div class="page-pad">
			<button class="button" onClick=${() => { known.clearToCurrent([]); apiGet('transfers').then((d) => { known.clearToCurrent(d.downloads || []); force((x) => x + 1); }); }}>
				<${Gi} n="trash" /> Clear all
			</button>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Uploads / Shared pages                                               */
/* ==================================================================== */

function UploadsPage() {
	const [data, setData] = useState(null);
	usePoll(() => { apiGet('transfers').then(setData).catch(() => {}); }, store.read().downloadsRefresh, []);
	const ups = (data && data.uploads) || [];
	return html`
	<div class="list">
		<div class="mm-divider">Uploads<span class="count-bubble">${ups.length}</span></div>
		${ups.map((f, i) => html`<div key=${i} class="list-item mm-item">
			<div style="width:100%">
				<h3 title=${f.name}>${f.name}</h3>
				<p>${f.user_name} - ${bytesToSize(f.xfer_up)} up - ${bytesToSize(f.xfer_down)} down ${f.xfer_speed > 0 ? '- ' + bytesToSize(f.xfer_speed) + '/s' : ''}</p>
			</div>
		</div>`)}
	</div>`;
}

function SharedPage({ guard }) {
	const [data, setData] = useState(null);
	const [ftext, setFtext] = useState('');
	useEffect(() => { apiGet('shared').then(setData).catch(() => {}); }, []);
	let list = (data && data.shared) || [];
	if (ftext) list = list.filter((f) => (f.name || '').toUpperCase().includes(ftext.toUpperCase()));
	return html`
	<div>
		<div class="page-pad">
			<input class="text-input searchbox" type="search" placeholder="Filter shared..."
				value=${ftext} onInput=${(e) => setFtext(e.target.value)} />
			<button class="button--outline button" onClick=${() => { if (guard()) apiPost('shared_cmd', { cmd: 'reload' }).then(() => apiGet('shared')).then(setData).catch(() => {}); }}>Reload shared</button>
		</div>
		<div class="list">
			<div class="mm-divider">Shared<span class="count-bubble">${list.length}</span></div>
			${list.map((f) => html`<div key=${f.hash} class="list-item mm-item">
				<div style="width:100%; padding-right:70px">
					<h3 title=${f.name}>${f.name}</h3>
					<p><strong>${bytesToSize(f.xfer)} (${bytesToSize(f.xfer_all)})</strong> - transferred (total)</p>
					<p>${f.req} (${f.req_all}) / ${f.accept} (${f.accept_all}) - request / accepted</p>
					<p>${prioString(f)}</p>
					<span class="count-bubble" style="position:absolute; right:8px; top:8px">${bytesToSize(f.size)}</span>
				</div>
			</div>`)}
		</div>
	</div>`;
}

/* ==================================================================== */
/* Search page (upstream "donation" feature, standard here)             */
/* ==================================================================== */

function SearchPage({ guard }) {
	const [q, setQ] = useState('');
	const [stype, setStype] = useState('Global');
	const [minV, setMinV] = useState(''); const [minU, setMinU] = useState('MByte');
	const [maxV, setMaxV] = useState(''); const [maxU, setMaxU] = useState('MByte');
	const [avail, setAvail] = useState('');
	const [results, setResults] = useState([]);
	const [sel, setSel] = useState(() => new Set());
	const [cats, setCats] = useState([]);
	const [tcat, setTcat] = useState(0);
	useEffect(() => { apiGet('status').then((d) => setCats(d.categories || [])).catch(() => {}); }, []);

	const load = () => apiGet('search').then((d) => setResults(d.results || [])).catch(() => {});
	useEffect(() => { load(); }, []);

	const doSearch = (e) => {
		e.preventDefault();
		if (!guard() || !q.trim()) return;
		const types = { Local: 0, Global: 1, Kad: 2 };
		apiPost('search_start', {
			keyword: q.trim(), type: types[stype] || 0, avail: avail || 0,
			minsize: minV ? Math.round(Number(minV) * UNITS[minU]) : 0,
			maxsize: maxV ? Math.round(Number(maxV) * UNITS[maxU]) : 0,
		}).then(() => { notify.message('Search started'); setTimeout(load, 2500); }).catch(() => {});
	};
	const toggle = (h) => setSel((p) => { const n = new Set(p); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const download = () => {
		if (!guard() || !sel.size) return;
		apiPost('search_download', { hashes: Array.from(sel).join(','), cat: tcat })
			.then(() => { notify.message('Queued ' + sel.size + ' file(s)'); setSel(new Set()); }).catch(() => {});
	};
	const unitSel = (v, set) => html`<select class="select-input" value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u} value=${u}>${u}</option>`)}</select>`;

	return html`
	<div>
		<form class="page-pad" onSubmit=${doSearch}>
			<input class="text-input searchbox" type="search" placeholder="Text query..." value=${q} onInput=${(e) => setQ(e.target.value)} />
			<div class="mm-field">
				<label>Type / Availability:</label>
				<select class="select-input" value=${stype} onChange=${(e) => setStype(e.target.value)}>
					${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
				</select>
				<input class="text-input" type="number" placeholder="avail" style="width:70px" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
			</div>
			<div class="mm-field">
				<label>Min / Max size:</label>
				<input class="text-input" type="number" style="width:60px" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
				${unitSel(minU, setMinU)}
				<input class="text-input" type="number" style="width:60px" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
				${unitSel(maxU, setMaxU)}
			</div>
			<button class="button" type="submit"><${Gi} n="search" /> Search</button>
			${' '}
			<button class="button--outline button" type="button" onClick=${load}>Refresh results</button>
		</form>
		<div class="list">
			<div class="mm-divider">Results<span class="count-bubble">${results.length}</span></div>
			${results.map((f) => html`<div key=${f.hash} class=${'list-item mm-item' + (sel.has(f.hash) ? ' selected' : '')} onClick=${() => toggle(f.hash)}>
				<div style="width:100%; padding-right:70px">
					<h3 title=${f.name}>${f.name}</h3>
					<p>${f.sources} sources${f.present ? ' - already on disk' : ''}</p>
					<span class="count-bubble" style="position:absolute; right:8px; top:8px">${bytesToSize(f.size)}</span>
				</div>
			</div>`)}
		</div>
		<div class="page-pad mm-field">
			<label>Download ${sel.size} selected in</label>
			<select class="select-input" value=${tcat} onChange=${(e) => setTcat(+e.target.value)}>
				${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
			</select>
			<button class="button" onClick=${download}><${Gi} n="download" /> Download</button>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Servers page                                                         */
/* ==================================================================== */

function ServersPage({ guard }) {
	const [data, setData] = useState(null);
	const [st, setSt] = useState(null);
	const [sortOn, setSortOn] = useState('users');
	const [rev, setRev] = useState(true);
	const load = () => {
		apiGet('status').then(setSt).catch(() => {});
		apiGet('servers').then(setData).catch(() => {});
	};
	useEffect(load, []);
	const servers = (data && data.servers) || [];
	const ACC = { name: (s) => (s.name || '').toLowerCase(), desc: (s) => (s.desc || '').toLowerCase(), users: (s) => Number(s.users), files: (s) => Number(s.files) };
	const acc = ACC[sortOn] || ACC.users;
	const list = servers.slice().sort((a, b) => { const x = acc(a), y = acc(b); return (x < y ? -1 : x > y ? 1 : 0) * (rev ? -1 : 1); });
	const connectedName = st && st.ed2k && st.ed2k.state === 'connected' ? st.ed2k.server : null;

	const connect = (srv) => {
		if (!guard()) return;
		notify.message('Connecting to server...');
		apiPost('server_cmd', { cmd: 'connect', ip: srv.ip, port: srv.port }).then(() => setTimeout(load, 1500)).catch(() => {});
	};
	const remove = (srv, e) => {
		e.stopPropagation();
		if (!guard()) return;
		apiPost('server_cmd', { cmd: 'remove', ip: srv.ip, port: srv.port }).then(load).catch(() => {});
	};
	return html`
	<div>
		<div class="list">
			<div class="mm-divider">Servers<span class="count-bubble">${servers.length}</span></div>
			${list.map((srv) => {
				const isConn = connectedName && srv.name === connectedName;
				return html`
				<div key=${srv.ip + ':' + srv.port} class="list-item mm-item"
					style=${isConn ? 'background: rgba(144,238,144,.35)' : ''} onClick=${() => connect(srv)}>
					<div style="width:100%; padding-right:70px">
						<h3>${srv.name}${isConn ? ' (Connected)' : ''}</h3>
						<p><strong>${srv.desc}</strong></p>
						<p>${srv.addr} - <i>files: ${srv.files}</i> ${' '}
							<a class="linklike" href="#" onClick=${(e) => { e.preventDefault(); remove(srv, e); }}>Remove Server</a></p>
						<span class="count-bubble" style="position:absolute; right:8px; top:8px"><${Gi} n="users" /> ${srv.users}</span>
					</div>
				</div>`;
			})}
		</div>
		<div class="page-pad mm-field">
			<label>Sort:</label>
			<select class="select-input" value=${sortOn} onChange=${(e) => setSortOn(e.target.value)}>
				<option value="name">Server Name</option>
				<option value="desc">Description</option>
				<option value="users">Users</option>
				<option value="files">Files</option>
			</select>
			<button class="button--outline button" onClick=${() => setRev(!rev)}>${rev ? 'Descendent ↓' : 'Ascendent ↑'}</button>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Statistics (listed with drill-down + collapsible)                    */
/* ==================================================================== */

const kvSplit = (s) => {
	const i = s.indexOf(': ');
	return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 2)];
};

function ListedStatsPage({ node, goNode }) {
	const [tree, setTree] = useState(null);
	useEffect(() => { apiGet('statstree').then((d) => setTree(d || {})).catch(() => {}); }, []);
	if (!tree) return html`<div class="page-pad">Loading…</div>`;

	// resolve the selected node by name anywhere in the tree (like upstream)
	const findNode = (t, name) => {
		for (const [k, v] of Object.entries(t)) {
			if (k === name) return v && typeof v === 'object' ? v : {};
			if (v && typeof v === 'object') { const r = findNode(v, name); if (r) return r; }
		}
		return null;
	};
	const scope = node ? (findNode(tree, node) || {}) : tree;
	const entries = Object.entries(scope);

	return html`
	<div>
		<div class="list">
			<div class="mm-divider">
				${node ? html`<a class="linklike" href="#" onClick=${(e) => { e.preventDefault(); goNode(''); }}><${Gi} n="chevron-left" /> ${node}</a>` : 'Statistics'}
				<span class="count-bubble">${entries.length}</span>
			</div>
			${entries.map(([k, v]) => {
				if (v && typeof v === 'object') {
					return html`<div key=${k} class="list-item mm-item" onClick=${() => goNode(k)}>
						<div class="list-item__center" style="width:100%"><h3>${k}</h3></div>
					</div>`;
				}
				const [label, val] = kvSplit(k);
				return html`<div key=${k} class="list-item mm-item">
					<div style="display:flex; width:100%; justify-content:space-between; gap:10px">
						<span>${label}</span><strong>${val}</strong>
					</div>
				</div>`;
			})}
		</div>
		<div class="page-pad text-center">
			<a class="button--outline button" href="#page-collapsible-stats">collapsible</a>
			${' '}
			<a class="button--outline button" href="#page-listed-stats">listed</a>
		</div>
	</div>`;
}

function CollapsibleTree({ name, nodeData }) {
	if (!nodeData || typeof nodeData !== 'object') {
		const [label, val] = kvSplit(name);
		return html`<table class="kv"><tr><td>${label}</td><th>${val}</th></tr></table>`;
	}
	return html`
	<details class="mm-col">
		<summary>${name}</summary>
		<div class="inner">
			${Object.entries(nodeData).map(([k, v]) => html`<${CollapsibleTree} key=${k} name=${k} nodeData=${v} />`)}
		</div>
	</details>`;
}
function CollapsibleStatsPage() {
	const [tree, setTree] = useState(null);
	useEffect(() => { apiGet('statstree').then((d) => setTree(d || {})).catch(() => {}); }, []);
	if (!tree) return html`<div class="page-pad">Loading…</div>`;
	return html`
	<div class="page-pad">
		<details class="mm-col" open>
			<summary>Statistics</summary>
			<div class="inner">
				${Object.entries(tree).map(([k, v]) => html`<${CollapsibleTree} key=${k} name=${k} nodeData=${v} />`)}
			</div>
		</details>
		<div class="text-center">
			<a class="button--outline button" href="#page-collapsible-stats">collapsible</a>
			${' '}
			<a class="button--outline button" href="#page-listed-stats">listed</a>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Graphs page                                                          */
/* ==================================================================== */

function GraphPage() {
	const s = store.read();
	const [tick, setTick] = useState(0);
	const [ready, setReady] = useState(false);
	usePoll(() => {
		apiGet('statsgraph').then(() => { setReady(true); setTick((t) => t + 1); }).catch(() => {});
	}, s.graphRefresh, []);
	const G = [
		['amule_stats_download.png', 'Download-Speed', true],
		['amule_stats_upload.png', 'Upload-Speed', false],
		['amule_stats_conncount.png', 'Connections', false],
	];
	return html`
	<div class="page-pad">
		${G.map(([src, label, open]) => html`
			<details key=${src} class="mm-col" open=${open}>
				<summary>${label}</summary>
				${ready && !MOCK ? html`<img src=${src + '?v=' + tick} alt=${label} />`
					: html`<div style="height:160px"></div>`}
			</details>`)}
		<div class="list"><div class="list-item"><p>this graph is refreshed each <strong>${s.graphRefresh / 1000}</strong> seconds (<a class="linklike" href="#page-mobilemule">change it</a>)</p></div></div>
	</div>`;
}

/* ==================================================================== */
/* aMule Settings page (upstream "donation" feature, standard here)     */
/* ==================================================================== */

const CONFIG_FIELDS = [
	['GENERAL', [['nick', 'Nickname', 'text']]],
	['WEBSERVER', [['autorefresh_time', 'Page refresh interval', 'text'], ['use_gzip', 'Use gzip compression', 'check']]],
	['LINE CAPACITY', [['max_line_down_cap', 'Max download rate (stats)', 'text'], ['max_line_up_cap', 'Max upload rate (stats)', 'text']]],
	['BANDWIDTH LIMITS', [['max_down_limit', 'Max download rate', 'text'], ['max_up_limit', 'Max upload rate', 'text'], ['slot_alloc', 'Slot allocation', 'text']]],
	['CONNECTION', [['max_conn_total', 'Max total connections', 'text'], ['max_file_src', 'Max sources per file', 'text'],
		['autoconn_en', 'Autoconnect at startup', 'check'], ['reconn_en', 'Reconnect when lost', 'check'],
		['network_ed2k', 'Enable ED2K network', 'check'], ['network_kad', 'Enable Kademlia network', 'check']]],
	['PORTS', [['tcp_port', 'TCP port', 'text'], ['udp_port', 'UDP port', 'text'], ['udp_dis', 'Disable UDP', 'check']]],
	['FILES', [['check_free_space', 'Check free space', 'check'], ['min_free_space', 'Min free space (Mb)', 'text'],
		['new_files_auto_dl_prio', 'New downloads auto priority', 'check'], ['new_files_auto_ul_prio', 'New shares auto priority', 'check'],
		['ich_en', 'I.C.H. active', 'check'], ['aich_trust', 'AICH trusts every hash', 'check'],
		['alloc_full_chunks', 'Alloc full chunks', 'check'], ['alloc_full', 'Alloc full disk space', 'check'],
		['new_files_paused', 'Add new downloads paused', 'check'], ['extract_metadata', 'Extract metadata', 'check']]],
];

function ConfigPage({ guard }) {
	const [form, setForm] = useState(null);
	const load = useCallback(() => apiGet('options').then((o) => { const f = Object.assign({}, o); delete f.categories; setForm(f); }).catch(() => {}), []);
	useEffect(() => { load(); }, [load]);
	if (!form) return html`<div class="page-pad">Loading…</div>`;
	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const apply = () => {
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(() => { notify.message('Settings applied'); load(); }).catch(() => notify.error('Apply failed'));
	};
	return html`
	<div class="page-pad">
		${CONFIG_FIELDS.map(([title, fields]) => html`
			<div key=${title}>
				<div class="mm-divider" style="margin:8px -8px 0">${title}</div>
				${fields.map(([k, label, kind]) => html`
					<div key=${k} class="mm-field">
						<label>${label}</label>
						${kind === 'text'
							? html`<input class="text-input" type="text" value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />`
							: html`<label class="switch">
								<input type="checkbox" class="switch__input" checked=${form[k] === '1' || form[k] === 1}
									onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />
								<div class="switch__toggle"><div class="switch__handle"></div></div>
							</label>`}
					</div>`)}
			</div>`)}
		<br />
		<button class="button" onClick=${apply}><${Gi} n="check" /> Apply</button>
	</div>`;
}

/* ==================================================================== */
/* mobileMule settings page (theme + refresh timers + turtle limits)    */
/* ==================================================================== */

function MMSettingsPage({ setTheme }) {
	const [s, setS] = useState(store.read());
	const upd = (patch) => setS(store.write(patch));
	const num = (k, label, scale) => html`
		<div class="mm-field">
			<label>${label}</label>
			<input class="text-input" type="number" value=${s[k] / (scale || 1)}
				onInput=${(e) => upd({ [k]: Number(e.target.value || 0) * (scale || 1) })} />
		</div>`;
	return html`
	<div class="page-pad">
		<div class="mm-divider" style="margin:8px -8px 0">THEME</div>
		<div class="mm-field">
			<label>Dark theme (Onsen UI)</label>
			<label class="switch">
				<input type="checkbox" class="switch__input" checked=${s.theme === 'dark'}
					onChange=${(e) => { const t = e.target.checked ? 'dark' : 'light'; upd({ theme: t }); setTheme(t); }} />
				<div class="switch__toggle"><div class="switch__handle"></div></div>
			</label>
		</div>
		<p><small>Custom themes: build one with the Onsen UI
			<a class="linklike" href="https://onsen.io/theme-roller/" target="_blank" rel="noopener">Theme Roller</a>
			and replace <code>onsen-css-components.min.css</code> in this template's folder.</small></p>

		<div class="mm-divider" style="margin:8px -8px 0">REFRESH (seconds)</div>
		${num('statusRefresh', 'Status page', 1000)}
		${num('downloadsRefresh', 'Downloads / Uploads pages', 1000)}
		${num('graphRefresh', 'Graphs page', 1000)}
		${num('tickChart', 'Speed chart ticks')}
		${num('notifyDelay', 'Notification delay (ms)')}

		<div class="mm-divider" style="margin:8px -8px 0">TURTLE MODE (KB/s)</div>
		${num('turtleDown', 'Max download limit')}
		${num('turtleUp', 'Max upload limit')}

		<div class="mm-divider" style="margin:8px -8px 0">START PAGE</div>
		<div class="mm-field">
			<label>Default page</label>
			<select class="select-input" value=${s.mainHash} onChange=${(e) => upd({ mainHash: e.target.value })}>
				${MENU.map(([id, label]) => html`<option key=${id} value=${'#' + id}>${label}</option>`)}
			</select>
		</div>
		<p><small>changes are stored in this browser (localStorage), like the original.</small></p>
	</div>`;
}

/* ==================================================================== */
/* Log + Add ed2k pages                                                 */
/* ==================================================================== */

function LogPage() {
	const [log, setLog] = useState('');
	const [srv, setSrv] = useState('');
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<div class="page-pad">
		<button class="button--outline button" onClick=${() => { loadLog(); loadSrv(); }}>Refresh</button>
		${' '}
		<button class="button--outline button" onClick=${() => confirm('Reset aMule log?') && loadLog(1)}>Clear aMule log</button>
		${' '}
		<button class="button--outline button" onClick=${() => confirm('Reset server info?') && loadSrv(1)}>Clear server log</button>
		<div class="mm-divider" style="margin:10px -8px 4px">AMULE LOG</div>
		<pre style="white-space:pre-wrap; word-break:break-word; font-size:12px; max-height:280px; overflow:auto">${log || ' '}</pre>
		<div class="mm-divider" style="margin:10px -8px 4px">SERVER LOG</div>
		<pre style="white-space:pre-wrap; word-break:break-word; font-size:12px; max-height:200px; overflow:auto">${srv || ' '}</pre>
	</div>`;
}

function AddEd2kPage({ guard }) {
	const [link, setLink] = useState('');
	const [cats, setCats] = useState([]);
	const [cat, setCat] = useState(0);
	useEffect(() => { apiGet('status').then((d) => setCats(d.categories || [])).catch(() => {}); }, []);
	const submit = (e) => {
		e.preventDefault();
		if (!guard() || !link.trim()) return;
		apiPost('ed2k', { link: link.trim(), cat })
			.then(() => { notify.message('Link queued'); setLink(''); }).catch(() => notify.error('Failed'));
	};
	return html`
	<form class="page-pad" onSubmit=${submit}>
		<div class="mm-field"><label>ed2k link</label></div>
		<input class="text-input searchbox" type="text" placeholder="ed2k://|file|...|/" value=${link} onInput=${(e) => setLink(e.target.value)} />
		<div class="mm-field">
			<label>Category</label>
			<select class="select-input" value=${cat} onChange=${(e) => setCat(+e.target.value)}>
				${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
			</select>
		</div>
		<button class="button" type="submit"><${Gi} n="plus" /> Download link</button>
	</form>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

function AboutModal({ close }) {
	return html`
	<div class="mm-modal-back" onClick=${close}>
		<div class="mm-modal" onClick=${(e) => e.stopPropagation()}>
			<h3 style="margin-top:0">About</h3>
			<p><strong>mobilemule</strong> — part of
				<a class="linklike" href="https://github.com/atallo/amuleweb-templates" target="_blank" rel="noopener">amuleweb-templates</a><br />
				Migrated from <a class="linklike" href="https://github.com/elbowz/mobileMule" target="_blank" rel="noopener">elbowz/mobileMule</a>
				(coded by muttley, GPL-3.0).</p>
			<button class="button" onClick=${close}>Close</button>
		</div>
	</div>`;
}

const initialPage = () => {
	const h = location.hash.replace('#', '');
	if (TITLES[h]) return h;
	return store.read().mainHash.replace('#', '');
};

function App() {
	const [page, setPage] = useState(initialPage);
	const [menu, setMenu] = useState(false);
	const [about, setAbout] = useState(false);
	const [statsNode, setStatsNode] = useState('');
	const [guest, setGuest] = useState(false);
	const themeRef = useRef(store.read().theme);

	const setTheme = (t) => {
		themeRef.current = t;
		document.documentElement.classList.toggle('dark', t === 'dark');
		const light = document.getElementById('onsen-light');
		const dark = document.getElementById('onsen-dark');
		if (light && dark) { light.disabled = (t === 'dark'); dark.disabled = (t !== 'dark'); }
	};
	useEffect(() => { setTheme(themeRef.current); }, []);

	useEffect(() => {
		apiGet('status').then((d) => setGuest(!!d.guest)).catch(() => {});
		const onHash = () => {
			const h = location.hash.replace('#', '');
			if (TITLES[h]) { setPage(h); setStatsNode(''); window.scrollTo(0, 0); }
		};
		window.addEventListener('hashchange', onHash);
		if (!location.hash) { try { history.replaceState(null, '', '#' + page); } catch (e) { /* ignore */ } }
		if (location.pathname.endsWith('login.php')) { try { history.replaceState(null, '', './#' + page); } catch (e) { /* ignore */ } }
		return () => window.removeEventListener('hashchange', onHash);
		// eslint-disable-next-line
	}, []);

	const guard = useCallback(() => {
		if (guest) { alert('You logged in as guest - commands are disabled'); return false; }
		return true;
	}, [guest]);

	const go = (id) => {
		setMenu(false);
		if (id !== page) { try { location.hash = '#' + id; } catch (e) { /* ignore */ } setPage(id); }
	};
	const [title, ticon] = TITLES[page] || ['Status', 'home'];

	let body;
	if (page === 'page-status') body = html`<${StatusPage} guard=${guard} />`;
	else if (page === 'page-downloads') body = html`<${DownloadsPage} guard=${guard} />`;
	else if (page === 'page-finished') body = html`<${FinishedPage} />`;
	else if (page === 'page-uploads') body = html`<${UploadsPage} />`;
	else if (page === 'page-shared') body = html`<${SharedPage} guard=${guard} />`;
	else if (page === 'page-search') body = html`<${SearchPage} guard=${guard} />`;
	else if (page === 'page-config') body = html`<${ConfigPage} guard=${guard} />`;
	else if (page === 'page-mobilemule') body = html`<${MMSettingsPage} setTheme=${setTheme} />`;
	else if (page === 'page-servers') body = html`<${ServersPage} guard=${guard} />`;
	else if (page === 'page-listed-stats') body = html`<${ListedStatsPage} node=${statsNode} goNode=${setStatsNode} />`;
	else if (page === 'page-collapsible-stats') body = html`<${CollapsibleStatsPage} />`;
	else if (page === 'page-graph') body = html`<${GraphPage} />`;
	else if (page === 'page-log') body = html`<${LogPage} />`;
	else if (page === 'page-footer') body = html`<${AddEd2kPage} guard=${guard} />`;

	return html`
	<div>
		<div class="mm-toolbar toolbar">
			<button class="toolbar-button menu-btn" onClick=${() => setMenu(true)}><${Gi} n="bars" lg /> Menu</button>
			<div class="center"><${Gi} n=${ticon} /> ${title}</div>
			<button class="toolbar-button" onClick=${() => history.back()}>Back</button>
		</div>

		<div class=${'mm-backdrop' + (menu ? ' show' : '')} onClick=${() => setMenu(false)}></div>
		<nav class=${'mm-menu' + (menu ? ' open' : '')}>
			<div class="list">
				${MENU.map(([id, label, icon]) => html`
					<div key=${id} class="list-item mm-item" onClick=${() => go(id)} style="cursor:pointer">
						<div class="list-item__center" style="width:100%">${label}<span class="pull-right"><${Gi} n=${icon} /></span></div>
					</div>`)}
				<div class="list-item mm-item" style="cursor:pointer"
					onClick=${() => { document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; location.href = 'login.php'; }}>
					<div class="list-item__center" style="width:100%">Logout<span class="pull-right"><${Gi} n="unlock-alt" /></span></div>
				</div>
			</div>
		</nav>

		<main>${body}</main>

		<div class="mm-footer">
			<span>${' '}<a class="linklike" href="#" onClick=${(e) => { e.preventDefault(); setAbout(true); }}>mobilemule</a> <${Gi} n="copyright" /> 2026</span>
			<a id="btScrollUp" class="linklike" href="#" onClick=${(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
				<${Gi} n="arrow-u" /> scroll up</a>
		</div>

		${about ? html`<${AboutModal} close=${() => setAbout(false)} />` : ''}
		<${Toasts} />
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
