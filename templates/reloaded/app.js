/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "reloaded": MatteoRagni's AmuleWebUI-Reloaded (Material
 * theme, GPL-3.0) reproduced as a single-page app on the shared JSON layer
 * (api.php). Markup and texts follow the original Bootstrap 3 pages; jQuery,
 * Bootstrap JS and the CDNs are gone -- interactions are implemented here,
 * and the Glyphicons webfont is replaced by inline SVG equivalents because
 * amuleweb cannot serve font files.
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
/* Formatting (matches the original pages)                              */
/* ==================================================================== */

const r2 = (n) => {
	const s = (Math.round(n * 100) / 100).toFixed(2);
	return s.replace(/\.?0+$/, '') || '0';
};
function fmtB(size, style) {
	size = Number(size) || 0;
	const u = style === 'search' ? [' b', 'kb', 'mb', 'gb'] : [' b', ' kb', ' mb', ' gb'];
	if (size < 1024) return size + u[0];
	if (size < 1048576) return r2(size / 1024) + u[1];
	if (size < 1073741824) return r2(size / 1048576) + u[2];
	return r2(size / 1073741824) + u[3];
}
const pct2 = (done, size) => (size > 0 ? r2((Number(done) * 100) / Number(size)) : '0');

const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioString(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio);
	if (f.prio_auto == 1) s += ' (auto)';
	return s;
}
// The original's filter groups priorities (Very high->High, Very low->Low...)
const PRIO_GROUP = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'High', 4: 'Low', 5: 'Normal', 6: 'Release' };
function statusOf(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}
const STATUS_LABEL = { Paused: 'label-info', Downloading: 'label-success', Waiting: 'label-warning' };
const BAR_CLASS = { Paused: 'progress-bar-info', Downloading: 'progress-bar-info', Waiting: 'progress-bar-warning' };
function sourcesText(f) {
	let s = '';
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + ' / ';
	s += f.src_count + ' ( ' + f.src_count_xfer + ' ) ';
	if (f.src_count_a4af != 0) s += '+ ' + f.src_count_a4af;
	return s;
}
const UNITS = { Byte: 1, KByte: 1024, MByte: 1048576, GByte: 1073741824 };

/* ==================================================================== */
/* Inline SVG equivalents of the Glyphicons used by the original        */
/* ==================================================================== */

const GI = {
	transfer: 'M5 8l4-4v3h10v2H9v3zm14 8l-4 4v-3H5v-2h10v-3z',
	share: 'M18 16a3 3 0 0 0-2.4 1.2l-7-3.5a3 3 0 0 0 0-1.4l7-3.5A3 3 0 1 0 15 7a3 3 0 0 0 .1.7l-7 3.5a3 3 0 1 0 0 3.6l7 3.5a3 3 0 1 0 2.9-2.3z',
	search: 'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
	tasks: 'M4 5h16v3H4zm0 5h16v3H4zm0 5h16v3H4z',
	asterisk: 'M11 3h2v6.3l5.5-3.2 1 1.8L14 11l5.5 3.1-1 1.8L13 12.7V19h-2v-6.3l-5.5 3.2-1-1.8L10 11 4.5 7.9l1-1.8L11 9.3z',
	stats: 'M4 19h3v-8H4zm6 0h3V5h-3zm6 0h3v-12h-3z',
	cog: 'M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5zM13 15a3 3 0 1 1 3-3 3 3 0 0 1-3 3z',
	flag: 'M6 3h2v18H6zm4 1h9l-2 4 2 4h-9z',
	off: 'M11 3h2v8h-2zM7 6.3A7 7 0 1 0 17 6.3l-1.4 1.5a5 5 0 1 1-7.1 0z',
	pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
	play: 'M8 5v14l11-7z',
	download: 'M11 4h2v8h3l-4 5-4-5h3zM5 19h14v2H5z',
	upload: 'M12 4l4 5h-3v8h-2V9H8zM5 19h14v2H5z',
	'remove-circle': 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm4 11.6L14.6 16 12 13.4 9.4 16 8 14.6l2.6-2.6L8 9.4 9.4 8l2.6 2.6L14.6 8 16 9.4 13.4 12z',
	filter: 'M4 5h16l-6 7v5l-4 2v-7z',
	check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
	refresh: 'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
	'floppy-remove': 'M5 3h11l3 3v15H5zm3 2v4h8V5zm4 7a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 12z',
	'plus-sign': 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm5 10h-4v4h-2v-4H7v-2h4V7h2v4h4z',
	'minus-sign': 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm5 10H7v-2h10z',
	'chevron-left': 'M15 4l-8 8 8 8 1.5-1.5L10 12l6.5-6.5z',
	'chevron-right': 'M9 4l8 8-8 8-1.5-1.5L14 12 7.5 5.5z',
	'log-in': 'M10 3h9v18h-9v-2h7V5h-7zM10 8l5 4-5 4v-3H3v-2h7z',
};
const Gi = ({ n, lg, style }) => html`<svg class=${'gi' + (lg ? ' gi-lg' : '')} style=${style || ''} viewBox="0 0 24 24" aria-hidden="true"><path d=${GI[n]} /></svg>`;

/* ==================================================================== */
/* Hooks / shared bits                                                  */
/* ==================================================================== */

function useSort() {
	const [key, setKey] = useState('');
	const [dir, setDir] = useState(1);
	const by = (k) => { if (k === key) setDir((d) => -d); else { setKey(k); setDir(1); } };
	const sort = (rows, acc) => {
		const f = acc[key];
		if (!f) return rows;
		return rows.slice().sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
	};
	return { by, sort };
}
function useSel() {
	const [sel, setSel] = useState(() => new Set());
	return {
		sel,
		has: (h) => sel.has(h),
		toggle: (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; }),
		setAll: (hashes, on) => setSel((s) => { const n = new Set(s); hashes.forEach((h) => (on ? n.add(h) : n.delete(h))); return n; }),
		clear: () => setSel(new Set()),
		list: () => Array.from(sel),
	};
}
const SortA = ({ label, k, sort }) => html`<a href="#" onClick=${(e) => { e.preventDefault(); sort.by(k); }}>${label}</a>`;
const SelTh = ({ rows, sel }) => {
	const hashes = rows.map((r) => r.hash);
	const all = hashes.length > 0 && hashes.every((h) => sel.has(h));
	return html`<th><input type="checkbox" checked=${all} onChange=${(e) => sel.setAll(hashes, e.target.checked)} /></th>`;
};

// CSS-only replacement of the original name popover.
const NameCell = ({ name, hash, upload }) => html`
	<td style="font-size:12px;color:#f5f5f5" class=${'texte texte-full-name' + (upload ? ' texte-full-name-upload' : '')}>
		<div class="hpop"><b>${' '}${name || ((hash ? hash.slice(0, 10) + '… ' : '') + '(unnamed)')}</b>
			<div class="hpop-body">${' '}${name || hash || '(unnamed)'}</div>
		</div>
	</td>`;

// Bootstrap progress bar + the 4px server-rendered chunk strip below it,
// with the "Segments" image popover on hover (dyn_<hash>.png).
function ProgressCell({ f }) {
	const [imgOk, setImgOk] = useState(true);
	const st = statusOf(f);
	const done = pct2(f.size_done, f.size);
	const strip = 'dyn_' + f.hash + '.png?v=' + f.size_done;
	return html`
	<td style="font-size:12px;">
		<div class="hpop">
			<div class="progress">
				<div class=${'progress-bar ' + BAR_CLASS[st]} role="progressbar" style=${'width: ' + done + '%'}></div>
			</div>
			${imgOk && !MOCK ? html`<div class="progress-bar-complex">
				<img alt="" src=${strip} onError=${() => setImgOk(false)} />
			</div>` : ''}
			${imgOk && !MOCK ? html`<div class="hpop-body"><img alt="Segments" src=${strip} style="width:200px;height:20px" /></div>` : ''}
		</div>
	</td>`;
}

/* ==================================================================== */
/* Navbar / footer                                                      */
/* ==================================================================== */

const NAV = [
	['download', 'transfer', 'Downloads and Uploads', 'Transfer'],
	['shared', 'share', 'Sharing', 'Shared'],
	['search', 'search', 'Search', 'Search'],
	['servers', 'tasks', 'Servers', 'Server'],
	['kad', 'asterisk', 'Kademlia', 'Kad'],
	['stats', 'stats', 'Statistics', 'Stats'],
];
const NAV2 = [
	['prefs', 'cog', 'Configurations', 'Settings'],
	['log', 'flag', 'Log', 'Logs'],
];

function Nav({ go }) {
	return html`
	<nav class="navbar navbar-fixed-top" role="navigation">
		<div class="container">
			<a class="navbar-brand" href="#"><img src=${A + 'logo-nav-brax.png'} class="logo-nav" /> aMule WebUI</a>
			<form class="navbar-form navbar-right" role="form" onSubmit=${(e) => e.preventDefault()}>
				<div class="collapse navbar-collapse">
					<div class="btn-group">
						${NAV.map(([id, icon, title, label]) => html`
							<a key=${id} class="btn navbar-link" title=${title} href=${'#' + id}
								onClick=${(e) => { e.preventDefault(); go(id); }}>
								<${Gi} n=${icon} lg />
								<div class="mini">${label}</div>
							</a>`)}
					</div>
					<div class="btn-group">
						${NAV2.map(([id, icon, title, label]) => html`
							<a key=${id} class="btn navbar-link" title=${title} href=${'#' + id}
								onClick=${(e) => { e.preventDefault(); go(id); }}>
								<${Gi} n=${icon} lg />
								<div class="mini">${label}</div>
							</a>`)}
						<a class="btn navbar-link" title="Exit" href="login.php">
							<${Gi} n="off" lg />
							<div class="mini">Exit</div>
						</a>
					</div>
				</div>
			</form>
		</div>
	</nav>`;
}

function Footer({ status, guard }) {
	const [link, setLink] = useState('');
	const [cat, setCat] = useState(0);
	const cats = (status && status.categories) || [];
	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };

	let ed2kTxt; let ed2kCls;
	if (ed2k.state === 'connecting') { ed2kTxt = 'Connecting ...'; ed2kCls = 'info'; }
	else if (ed2k.state !== 'connected') { ed2kTxt = 'Not connected'; ed2kCls = 'danger'; }
	else {
		ed2kTxt = 'Connected ' + (ed2k.lowid ? '(low)' : '(high)') + ' ' + ed2k.server + ' ' + ed2k.addr;
		ed2kCls = ed2k.lowid ? 'warning' : 'success';
	}
	const kadTxt = kad.connected ? ('Connected ' + (kad.firewalled ? '(FW)' : '(OK)')) : 'Disconnected';
	const kadCls = kad.connected ? (kad.firewalled ? 'warning' : 'success') : 'danger';

	const submit = (e) => {
		e.preventDefault();
		if (!guard() || !link.trim()) return;
		apiPost('ed2k', { link: link.trim(), cat }).catch(() => {});
		setLink('');
	};
	return html`
	<div id="footer">
		<div class="col-md-1"></div>
		<div class="col-md-5">
			<form class="form-inline" id="formed2link" onSubmit=${submit}>
				<div class="btn-group">
					<input class="form-control btn-group" id="ed2klink" type="text" placeholder="ed2k:// - Insert link"
						style="border-top-right-radius: 0px; border-bottom-right-radius: 0px; height: 30px;"
						value=${link} onInput=${(e) => setLink(e.target.value)} />
					<select class="form-control btn-group" id="selectcat" style="height: 30px;"
						value=${cat} onChange=${(e) => setCat(+e.target.value)}>
						${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
					</select>
					<input class="btn btn-default btn-group" type="submit" value="Download link" style="height: 30px;" />
				</div>
			</form>
		</div>
		<div class="col-md-5">
			<div class="form-inline" style="margin-top:10px;">
				<span class="label label-default">ED2k:</span>${' '}
				<span class=${'label label-' + ed2kCls}>${ed2kTxt}</span>${' '}
				<span class="label label-default">KAD:</span>${' '}
				<span class=${'label label-' + kadCls}>${kadTxt}</span>
			</div>
		</div>
		<div class="col-md-1"></div>
	</div>`;
}

const GuestBadge = ({ status }) => ((status && status.guest)
	? html`<span><br /><br /><span class="label label-warning">You logged in as guest - commands are disabled</span></span>` : '');

// toolbar icon button with the tiny caption
const TBtn = ({ icon, label, title, onClick, cls }) => html`
	<a class=${'btn ' + (cls || '')} href="#" title=${title || label}
		onClick=${(e) => { e.preventDefault(); onClick(); }}>
		<${Gi} n=${icon} />
		<div class="mini">${label}</div>
	</a>`;

/* ==================================================================== */
/* DOWNLOAD / UPLOAD                                                    */
/* ==================================================================== */

function DownloadView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort();
	const [fStatus, setFStatus] = useState('all');
	const [fCat, setFCat] = useState('all');
	const [aStatus, setAStatus] = useState('all');
	const [aCat, setACat] = useState('all');

	const cats = (status && status.categories) || [];
	const downloads = (data && data.downloads) || [];
	const uploads = (data && data.uploads) || [];

	const filtered = downloads.filter((f) => {
		if (aStatus !== 'all' && statusOf(f) !== aStatus) return false;
		if (aCat !== 'all') { const i = cats.indexOf(aCat); if (i >= 0 && f.category !== i) return false; }
		return true;
	});
	const rows = sort.sort(filtered, {
		name: (f) => (f.name || '').toLowerCase(),
		size: (f) => Number(f.size),
		size_done: (f) => Number(f.size_done),
		speed: (f) => Number(f.speed),
		progress: (f) => Number(f.size_done) / Math.max(1, Number(f.size)),
		srccount: (f) => Number(f.src_count),
		status: (f) => statusOf(f),
		prio: (f) => Number(f.prio),
	});
	const tot = downloads.reduce((a, f) => ({ size: a.size + Number(f.size), done: a.done + Number(f.size_done), speed: a.speed + Number(f.speed) }), { size: 0, done: 0, speed: 0 });
	const utot = uploads.reduce((a, f) => ({ up: a.up + Number(f.xfer_up), dn: a.dn + Number(f.xfer_down), speed: a.speed + Number(f.xfer_speed) }), { up: 0, dn: 0, speed: 0 });

	const cmd = (c) => {
		if (!guard()) return;
		const list = sel.list();
		if (c === 'cancel') {
			if (list.length === 0) return;
			if (!confirm('Delete selected ' + list.length + ' files ?')) return;
		}
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') sel.clear();
	};

	return html`
	<div>
		<div class="panel panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<div class="btn-group">
						<${TBtn} icon="pause" label="Pause" onClick=${() => cmd('pause')} />
						<${TBtn} icon="play" label="Resume" onClick=${() => cmd('resume')} />
					</div>
					<div class="btn-group">
						<${TBtn} icon="download" label="Lower Priority" onClick=${() => cmd('priodown')} />
						<${TBtn} icon="remove-circle" label="Remove" onClick=${() => cmd('cancel')} />
						<${TBtn} icon="upload" label="High Priority" onClick=${() => cmd('prioup')} />
					</div>
					<div class="btn-group">
						<select id="filter" class="form-control btn-group" value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
							${['all', 'Waiting', 'Paused', 'Downloading'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}
						</select>
						<select id="category" class="form-control btn-group" value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
							<option value="all">all</option>
							${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
						</select>
						<${TBtn} icon="filter" label="Filter" cls="btn-filter" onClick=${() => { setAStatus(fStatus); setACat(fCat); }} />
						<${GuestBadge} status=${status} />
					</div>
				</div>
			</div>
		</div>

		<div class="container-fluid panel-tr">
			<div class="panel" style="margin-bottom: 10px;">
				<div class="panel-heading panel-center"><h4>DOWNLOAD</h4></div>
				<div class="tw">
				<table class="table">
					<thead><tr>
						<${SelTh} rows=${rows} sel=${sel} />
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
						${rows.map((f) => {
							const st = statusOf(f);
							return html`<tr key=${f.hash}>
								<td class="texte"><div class="checkbox download-checkbox" style="margin: 0px;">
									<input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></div></td>
								<${NameCell} name=${f.name} hash=${f.hash} />
								<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.size)}</td>
								<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.size_done)}${' '}(${pct2(f.size_done, f.size)}%)</td>
								<td style="font-size:12px;color:#f5f5f5" class="texte">${f.speed > 0 ? fmtB(f.speed) + '/s' : '-'}</td>
								<${ProgressCell} f=${f} />
								<td style="font-size:12px;color:#f5f5f5" class="texte">${sourcesText(f)}</td>
								<td style="font-size:12px;" class="texte"><span class=${'label ' + STATUS_LABEL[st]} style="font-size:12px;">${st}</span></td>
								<td style="font-size:12px;color:#f5f5f5" class="texte">${prioString(f)}</td>
							</tr>`;
						})}
						${downloads.length && tot.size > 0 ? html`<tr>
							<td></td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;text-align: right;padding-right: 20px;">Total</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${fmtB(tot.size)}</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${fmtB(tot.done)}${' '}(${pct2(tot.done, tot.size)}%)</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${tot.speed > 0 ? fmtB(tot.speed) + '/s' : ''}</td>
							<td></td><td></td><td></td><td></td>
						</tr>` : ''}
					</tbody>
				</table>
				</div>
			</div>

			<div class="panel" style="margin-bottom: 60px;">
				<div class="panel-heading panel-center"><h4>UPLOAD</h4></div>
				<div class="tw">
				<table class="table">
					<thead><tr>
						<th>File Name</th><th>Username</th><th>Up</th><th>Down</th><th>Speed</th>
					</tr></thead>
					<tbody>
						${uploads.map((f, i) => html`<tr key=${i}>
							<${NameCell} name=${f.name} upload />
							<td style="font-size:12px;color:#f5f5f5" class="texte">${f.user_name}</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.xfer_up)}</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.xfer_down)}</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${f.xfer_speed > 0 ? fmtB(f.xfer_speed) + '/s' : ''}</td>
						</tr>`)}
						${uploads.length ? html`<tr>
							<td></td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;text-align: right;padding-right: 20px;">Total</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${fmtB(utot.up)}</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${fmtB(utot.dn)}</td>
							<td style="font-size:12px;color:#c9c9c9;padding-bottom:0;">${fmtB(utot.speed)}/s</td>
						</tr>` : ''}
					</tbody>
				</table>
				</div>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SHARED                                                               */
/* ==================================================================== */

function SharedView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort();
	const [prioSel, setPrioSel] = useState('All');
	const shared = (data && data.shared) || [];

	const visible = shared.filter((f) => prioSel === 'All' || PRIO_GROUP[f.prio] === prioSel);
	const rows = sort.sort(visible, {
		name: (f) => (f.name || '').toLowerCase(),
		xfer: (f) => Number(f.xfer), xfer_all: (f) => Number(f.xfer_all),
		req: (f) => Number(f.req), req_all: (f) => Number(f.req_all),
		acc: (f) => Number(f.accept), acc_all: (f) => Number(f.accept_all),
		size: (f) => Number(f.size), prio: (f) => Number(f.prio),
	});
	const run = (c, p) => {
		if (!guard()) return;
		if (c === 'reload') { apiPost('shared_cmd', { cmd: 'reload' }).then(refresh).catch(() => {}); return; }
		const list = sel.list();
		if (!list.length) return;
		apiPost('shared_cmd', { cmd: c, hashes: list.join(','), prio: p !== undefined ? p : 0 }).then(refresh).catch(() => {});
	};
	const applyPrio = () => {
		const map = { Low: 0, Normal: 1, High: 2, Release: 6 };
		if (map[prioSel] === undefined) return; // "All" selected: nothing to apply
		run('setprio', map[prioSel]);
	};
	return html`
	<div>
		<div class="panel panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<div class="btn-group">
						<${TBtn} icon="refresh" label="Reload" title="Reload shared files" onClick=${() => run('reload')} />
						<${TBtn} icon="download" label="Lower Priority" onClick=${() => run('priodown')} />
						<${TBtn} icon="upload" label="High Priority" onClick=${() => run('prioup')} />
					</div>
					<div class="btn-group">
						<select id="filter" class="form-control btn-group" value=${prioSel} onChange=${(e) => setPrioSel(e.target.value)}>
							${['All', 'Low', 'Normal', 'High', 'Release'].map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
						</select>
						<${TBtn} icon="check" label="Set" title="Set selected to this priority" cls="btn-filter" onClick=${applyPrio} />
						<${GuestBadge} status=${status} />
					</div>
				</div>
			</div>
		</div>

		<div class="container-fluid panel-tr">
			<div class="panel" style="margin-bottom: 60px;">
				<div class="panel-heading panel-center"><h4>SHARED FILES</h4></div>
				<div class="tw">
				<table class="table">
					<thead><tr>
						<${SelTh} rows=${rows} sel=${sel} />
						<th><${SortA} label="File name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Transferred" k="xfer" sort=${sort} /> <${SortA} label="(Total)" k="xfer_all" sort=${sort} /></th>
						<th><${SortA} label="Requested" k="req" sort=${sort} /> <${SortA} label="(Total)" k="req_all" sort=${sort} /></th>
						<th><${SortA} label="Accepted Rqst" k="acc" sort=${sort} /> <${SortA} label="(Total)" k="acc_all" sort=${sort} /></th>
						<th><${SortA} label="Size" k="size" sort=${sort} /></th>
						<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((f) => html`<tr key=${f.hash}>
							<td class="texte"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
							<${NameCell} name=${f.name} hash=${f.hash} />
							<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.xfer)} (${fmtB(f.xfer_all)})</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${f.req} (${f.req_all})</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${f.accept} (${f.accept_all})</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.size)}</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${prioString(f)}</td>
						</tr>`)}
					</tbody>
				</table>
				</div>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SEARCH                                                               */
/* ==================================================================== */

function SearchView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort();
	const [q, setQ] = useState('');
	const [stype, setStype] = useState('Global');
	const [avail, setAvail] = useState('');
	const [minV, setMinV] = useState(''); const [minU, setMinU] = useState('MByte');
	const [maxV, setMaxV] = useState(''); const [maxU, setMaxU] = useState('MByte');
	const [tcat, setTcat] = useState(0);
	const [showTop, setShowTop] = useState(false);

	useEffect(() => {
		const onScroll = () => setShowTop(window.scrollY > 100);
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const cats = (status && status.categories) || [];
	const results = (data && data.results) || [];
	const rows = sort.sort(results, {
		name: (f) => (f.name || '').toLowerCase(),
		size: (f) => Number(f.size),
		sources: (f) => Number(f.sources),
	});
	const doSearch = (e) => {
		e && e.preventDefault();
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
	const unitSel = (v, set, style) => html`<select class="form-control btn-group" style=${style} value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u} value=${u}>${u}</option>`)}</select>`;

	return html`
	<div>
		<div class="panel panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<p><div class="btn-group">
						<a class="btn btn-info btn-group" href="#" title="Refresh to see the results" style="height:34px;"
							onClick=${(e) => { e.preventDefault(); refresh(); }}>
							<${Gi} n="refresh" style="color:white" />
						</a>
						<input type="text" placeholder="Text query..." class="form-control btn-group"
							style="border-radius:0px; z-index:1; width:280px" value=${q}
							onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && doSearch(e)} />
						<select class="form-control btn-group" style="border-radius:0px; background-color:#eee;"
							value=${stype} onChange=${(e) => setStype(e.target.value)}>
							${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
						</select>
						<input class="btn btn-info btn-group" type="submit" value="Search" style="width:140px;" onClick=${doSearch} />
					</div></p>
					<p>
					<div class="btn-group">
						<label class="form-control btn-group" style="border-top-right-radius:0px; border-bottom-right-radius:0px; background-color:#eee;">Availability</label>
						<input type="text" class="form-control btn-group" style="border-top-left-radius:0px; border-bottom-left-radius:0px; z-index:1; width:80px" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
					</div>
					<div class="btn-group">
						<label class="form-control btn-group" style="border-top-right-radius:0px; border-bottom-right-radius:0px; background-color:#eee;">Min size</label>
						<input type="text" class="form-control btn-group" style="border-radius: 0px; z-index:1; width:64px" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
						${unitSel(minU, setMinU, 'border-radius:0px; background-color:#eee;')}
						<label class="form-control btn-group" style="border-radius:0px; background-color:#eee;">Max size</label>
						<input type="text" class="form-control btn-group" style="border-radius: 0px; z-index:1; width:64px" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
						${unitSel(maxU, setMaxU, 'border-top-left-radius: 0px; border-bottom-left-radius:0px; background-color:#eee;')}
					</div>
					</p>
					<${GuestBadge} status=${status} />
				</div>
			</div>
		</div>

		<div class="panel panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<div class="btn-group">
						<label class="form-control btn-group" style="border-top-right-radius:0px; border-bottom-right-radius:0px; background-color:#eee;">For each element selected</label>
						<a class="btn btn-success btn-group" title="Download" href="#" style="border-radius:0px;"
							onClick=${(e) => { e.preventDefault(); download(); }}>Download</a>
						<label class="form-control btn-group" style="border-radius:0px; background-color:#eee;"> in category </label>
						<select class="form-control btn-group" style="border-top-left-radius:0px; border-bottom-left-radius:0px; background-color:#eee;"
							value=${tcat} onChange=${(e) => setTcat(+e.target.value)}>
							${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
						</select>
					</div>
				</div>
			</div>
		</div>

		<div class="container-fluid panel-tr">
			<div class="panel" style="margin-bottom:60px;">
				<div class="panel-heading panel-center"><h4>SEARCH RESULTS</h4></div>
				<div class="tw">
				<table class="table">
					<thead><tr>
						<${SelTh} rows=${rows} sel=${sel} />
						<th><${SortA} label="File name" k="name" sort=${sort} /></th>
						<th><${SortA} label="Size" k="size" sort=${sort} /></th>
						<th><${SortA} label="Sources" k="sources" sort=${sort} /></th>
					</tr></thead>
					<tbody>
						${rows.map((f) => html`<tr key=${f.hash}>
							<td class="texte"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
							<${NameCell} name=${f.name} hash=${f.hash} />
							<td style="font-size:12px;color:#f5f5f5" class="texte">${fmtB(f.size, 'search')}</td>
							<td style="font-size:12px;color:#f5f5f5" class="texte">${f.sources}</td>
						</tr>`)}
					</tbody>
				</table>
				</div>
			</div>
		</div>
		<button id="scroll" class=${showTop ? 'show' : ''} title="Back to top"
			onClick=${() => window.scrollTo({ top: 0, behavior: 'smooth' })}>${'↑'}</button>
	</div>`;
}

/* ==================================================================== */
/* SERVERS                                                              */
/* ==================================================================== */

function ServersView({ data, status, guard, refresh }) {
	const sort = useSort();
	const servers = (data && data.servers) || [];
	const guest = !!(status && status.guest);
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(),
		desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users),
		files: (s) => Number(s.files),
	});
	const srvCmd = (cmd, s) => {
		if (!guard()) return;
		apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {});
	};
	return html`
	<div class="container-fluid panel-tr">
		<div class="panel" style="margin-bottom: 60px;">
			<div class="panel-heading panel-center"><h4>SERVERS</h4></div>
			<div class="tw">
			<table class="table">
				<thead><tr>
					<th style="width:55px;"></th>
					<th><${SortA} label="Server name" k="name" sort=${sort} /></th>
					<th><${SortA} label="Description" k="desc" sort=${sort} /></th>
					<th style="color:#4db6ac">Address</th>
					<th><${SortA} label="Users" k="users" sort=${sort} /></th>
					<th><${SortA} label="Files" k="files" sort=${sort} /></th>
				</tr></thead>
				<tbody>
					${rows.map((s) => html`<tr key=${s.ip + ':' + s.port}>
						<td style="width:55px;">
							${guest ? '' : html`
								<a href="#" title="Connect" onClick=${(e) => { e.preventDefault(); srvCmd('connect', s); }}><${Gi} n="plus-sign" style="color:#4db6ac" /></a>
								${' '}
								<a href="#" title="Remove" onClick=${(e) => { e.preventDefault(); srvCmd('remove', s); }}><${Gi} n="minus-sign" style="color:#ef5350" /></a>`}
						</td>
						<td style="font-size:12px;"><b style="color:#cfd8dc;">${s.name}</b></td>
						<td style="font-size:12px;">${s.desc}</td>
						<td style="font-size:12px;color:#cfd8dc;">${s.addr}</td>
						<td style="font-size:12px;color:#cfd8dc;">${s.users}</td>
						<td style="font-size:12px;color:#cfd8dc;">${s.files}</td>
					</tr>`)}
				</tbody>
			</table>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* KAD                                                                  */
/* ==================================================================== */

function KadView({ status, guard, refresh, tick }) {
	const [ip, setIp] = useState(['', '', '', '']);
	const [port, setPort] = useState('');
	const [gready, setGready] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);

	const kad = (status && status.kad) || { connected: false };
	const conn = kad.connected
		? (kad.firewalled ? html`<span class="label label-warning">OK</span>` : html`<span class="label label-success">OK</span>`)
		: html`<span class="label label-danger">ERROR</span>`;
	const fw = kad.firewalled ? html`<span class="label label-danger">ERROR</span>` : html`<span class="label label-success">OK</span>`;

	const connect = (e) => {
		e.preventDefault();
		if (!guard()) return;
		// upstream field order is ip3.ip2.ip1.ip0 left to right
		apiPost('kad', { action: 'connect_ip', ip3: ip[0], ip2: ip[1], ip1: ip[2], ip0: ip[3], port }).then(refresh).catch(() => {});
	};
	const ipIn = (i) => html`<input class="form-control btn-group" style="background-color:#ffffff; width:58px" type="text"
		maxlength="3" placeholder="255" value=${ip[i]}
		onInput=${(e) => setIp((p) => { const n = p.slice(); n[i] = e.target.value; return n; })} />`;
	const dot = (t) => html`<label class="control-label form-control btn-group" style="background-color:#ffffff; width:auto">${t}</label>`;

	return html`
	<div>
		<form onSubmit=${connect}>
			<div class="panel panel-default panel-tasks">
				<div class="panel-body container panel-center">
					<div class="form-inline form-tasks">
						<div class="btn-group">
							<label class="control-label form-control btn-group" style="background-color:#39425f; width:auto"><b style="color:#4db6ac">Bootstrap from Node</b></label>
							${ipIn(0)} ${dot('.')} ${ipIn(1)} ${dot('.')} ${ipIn(2)} ${dot('.')} ${ipIn(3)} ${dot(':')}
							<input class="form-control btn-group" style="background-color:#ffffff; width:70px" type="text" maxlength="5" placeholder="Port"
								value=${port} onInput=${(e) => setPort(e.target.value)} />
							<input class="btn btn-warning btn-group" type="submit" value="Connect" />
						</div>
						<${GuestBadge} status=${status} />
					</div>
				</div>
			</div>
		</form>

		<div class="container-fluid panel-tr" style="margin-bottom: 60px;">
			<div class="panel">
				<div class="panel-heading panel-center"><h4>KAD STATUS</h4></div>
				<table class="table status-table" style="width:auto; margin: 0 auto; margin-bottom: 15px; margin-top:15px;">
					<thead><tr><th>Parameter</th><th>Status</th></tr></thead>
					<tbody>
						<tr><td style="color:#cfd8dc">Connection</td><td>${conn}</td></tr>
						<tr><td style="color:#cfd8dc">Firewall</td><td>${fw}</td></tr>
						<tr><td colspan="2" style="text-align:center;">
							${gready && !MOCK
								? html`<img src=${'amule_stats_kad.png?v=' + tick} width="500" height="200" alt="" style="max-width:100%" />`
								: html`<div style="width:500px;height:200px;background:#2f303d;max-width:100%"></div>`}
						</td></tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* STATISTICS                                                           */
/* ==================================================================== */

function TreeNode({ name, node }) {
	const [open, setOpen] = useState(true);
	if (node === null || node === undefined) {
		return html`<div><img src=${A + 'tree-leaf.gif'} alt="" />${name}</div>`;
	}
	return html`
	<div>
		<span class="trigger" onClick=${() => setOpen((o) => !o)}>
			<img src=${A + (open ? 'tree-open.gif' : 'tree-closed.gif')} alt="" />
			${name}
		</span>
		${open ? html`<span class="branch">
			${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}
		</span>` : ''}
	</div>`;
}

const SLIDES = [
	['amule_stats_download.png', 'Downloads'],
	['amule_stats_upload.png', 'Uploads'],
	['amule_stats_conncount.png', 'Connections Count'],
	['amule_stats_kad.png', 'KAD Nodes'],
];

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
	useEffect(() => {
		const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
		return () => clearInterval(t);
	}, []);
	const go = (d) => setSlide((s) => (s + d + SLIDES.length) % SLIDES.length);

	return html`
	<div class="container-fluid panel-tr" style="margin-bottom: 60px;">
		<div class="panel">
			<div class="panel-heading panel-center" style="text-align:center;"><h4>STATISTICS</h4></div>
			<div class="container-fluid">
				<div class="col-md-4" style="margin-top: 10px; margin-bottom: 10px;">
					<div class="tree-reloaded">
						${tree
							? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)
							: 'Loading…'}
					</div>
				</div>
				<div class="col-md-8" style="margin-top: 10px;">
					<div class="car" style="min-height:220px;">
						${SLIDES.map(([src, cap], i) => html`
							<div key=${src} class=${'car-item' + (i === slide ? ' on' : '')}>
								${gready && !MOCK
									? html`<img class="car-img" src=${src + '?v=' + tick} alt=${cap} />`
									: html`<div class="car-img" style="height:300px;background:#2f303d"></div>`}
								<div class="car-cap"><h3>${cap}</h3></div>
							</div>`)}
						<a class="car-ctl left" href="#" onClick=${(e) => { e.preventDefault(); go(-1); }}><${Gi} n="chevron-left" lg style="color:#fff" /></a>
						<a class="car-ctl right" href="#" onClick=${(e) => { e.preventDefault(); go(1); }}><${Gi} n="chevron-right" lg style="color:#fff" /></a>
						<ol class="car-dots">
							${SLIDES.map((s, i) => html`<li key=${i} class=${i === slide ? 'on' : ''} onClick=${() => setSlide(i)}></li>`)}
						</ol>
					</div>
				</div>
			</div>
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
	if (!form) return html`<div class="container-fluid panel-tr"><div class="panel"><div class="panel-heading panel-center"><h4>PREFERENCES</h4></div><p style="text-align:center;color:#cfd8dc">Loading…</p></div></div>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const apply = () => {
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(load).catch(() => {});
	};
	const isOn = (k) => form[k] === '1' || form[k] === 1;
	const txtRow = (k, label) => html`
		<div class="pref-row">
			<label><input type="checkbox" disabled />${' '}${label}</label>
			<input type="text" disabled=${guest} value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />
		</div>`;
	const chkRow = (k, label) => html`
		<div class="pref-row">
			<label><input type="checkbox" disabled=${guest} checked=${isOn(k)} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />${' '}${label}</label>
			<span class="filler"></span>
		</div>`;

	return html`
	<div>
		<div class="panel panel-default panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<input class="btn btn-warning" type="submit" value="Apply" disabled=${guest} onClick=${apply} />
					<${GuestBadge} status=${status} />
				</div>
			</div>
		</div>

		<div class="container-fluid panel-tr" style="margin-bottom:60px;">
			<div class="panel">
				<div class="panel-heading panel-center"><h4>PREFERENCES</h4></div>
				<div class="pref-col">
					<span class="pref-head">GENERAL</span>
					${txtRow('nick', 'Nickname')}
					<span class="pref-head">WEBSERVER</span>
					${txtRow('autorefresh_time', 'Page refresh interval')}
					${chkRow('use_gzip', 'Use gzip compression')}
					<span class="pref-head">LINE CAPACITY</span>
					${txtRow('max_line_down_cap', 'Max download rate (statistics)')}
					${txtRow('max_line_up_cap', 'Max upload rate (statistics)')}
					<span class="pref-head">BANDWIDTH LIMITS</span>
					${txtRow('max_down_limit', 'Max download rate')}
					${txtRow('max_up_limit', 'Max Upload Rate')}
					${txtRow('slot_alloc', 'Slot Allocation')}
					<span class="pref-head">CONNECTION SETTINGS</span>
					${txtRow('max_conn_total', 'Max total connections')}
					${txtRow('max_file_src', 'Max sources per file')}
					${chkRow('autoconn_en', 'Autoconnect at startup')}
					${chkRow('reconn_en', 'Reconnect when connection lost')}
					${chkRow('network_ed2k', 'Enable ED2K network')}
					${chkRow('network_kad', 'Enable Kademlia network')}
					<span class="pref-head">PORTS</span>
					${txtRow('tcp_port', 'TCP Port')}
					${txtRow('udp_port', 'UDP Port')}
					${chkRow('udp_dis', 'Disable UDP connections')}
					<span class="pref-head">FILE SETTINGS</span>
					${chkRow('check_free_space', 'Check free space')}
					${html`<div class="pref-row">
						<label><input type="checkbox" disabled />${' '}Minimum free space (Mb)</label>
						<input type="text" disabled=${guest || !isOn('check_free_space')}
							value=${form.min_free_space === undefined ? '' : form.min_free_space}
							onInput=${(e) => set('min_free_space', e.target.value)} />
					</div>`}
					${chkRow('new_files_auto_dl_prio', 'Added download files have auto priority')}
					${chkRow('new_files_auto_ul_prio', 'New shared files have auto priority')}
					${chkRow('ich_en', 'I.C.H. active')}
					${chkRow('aich_trust', 'AICH trusts every hash')}
					${chkRow('alloc_full_chunks', 'Alloc full chunks of .part files')}
					${chkRow('alloc_full', 'Alloc full disk space for .part files')}
					${chkRow('new_files_paused', 'Add files to download queue in pause mode')}
					${chkRow('extract_metadata', 'Extract metadata tags')}
				</div>
			</div>
		</div>
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
		<div class="panel panel-default panel-tasks">
			<div class="panel-body container panel-center">
				<div class="form-inline form-tasks">
					<div class="btn-group">
						<a class="btn btn-default btn-group" href="#" onClick=${(e) => { e.preventDefault(); loadLog(); loadSrv(); }}>
							<${Gi} n="refresh" />${' '}Refresh Log
						</a>
					</div>
					<div class="btn-group">
						<a class="btn btn-group" style="background-color:#ef5350" href="#"
							onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to RESET aMule log?')) loadLog(1); }}>
							<${Gi} n="floppy-remove" style="color:#ffffff" />${' '}<span style="color:#fff">Clear aMule Log</span>
						</a>
						<a class="btn btn-group" style="background-color:#ef5350" href="#"
							onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to RESET Server log?')) loadSrv(1); }}>
							<${Gi} n="floppy-remove" style="color:#ffffff" />${' '}<span style="color:#fff">Clear Server Log</span>
						</a>
					</div>
				</div>
			</div>
		</div>

		<div class="container-fluid panel-tr">
			<div class="panel">
				<div class="panel-heading panel-center"><h4>AMULE LOG</h4></div>
				<pre class="relpre"><code>${log || ' '}</code></pre>
			</div>
		</div>
		<div class="container-fluid panel-tr" style="margin-bottom:60px;">
			<div class="panel">
				<div class="panel-heading panel-center"><h4>SERVER LOG</h4></div>
				<pre class="relpre"><code>${srv || ' '}</code></pre>
			</div>
		</div>
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
	const busyRef = useRef(false);

	const cycle = useCallback(async (force) => {
		if (busyRef.current || (document.hidden && !force)) return;
		busyRef.current = true;
		try {
			const s = await apiGet('status');
			setStatus(s);
			const route = VIEW_ROUTE[view];
			if (route) { const d = await apiGet(route); setData(d); }
			setTick((t) => t + 1);
		} catch (e) { /* footer will catch up next cycle */ }
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

	const vp = { data, status, guard, refresh, tick };
	let body;
	if (view === 'download') body = html`<${DownloadView} ...${vp} />`;
	else if (view === 'shared') body = html`<${SharedView} ...${vp} />`;
	else if (view === 'search') body = html`<${SearchView} ...${vp} />`;
	else if (view === 'servers') body = html`<${ServersView} ...${vp} />`;
	else if (view === 'kad') body = html`<${KadView} ...${vp} />`;
	else if (view === 'stats') body = html`<${StatsView} tick=${tick} />`;
	else if (view === 'prefs') body = html`<${PrefsView} status=${status} guard=${guard} />`;
	else if (view === 'log') body = html`<${LogView} />`;

	return html`
	<div>
		<${Nav} go=${go} />
		${body}
		<${Footer} status=${status} guard=${guard} />
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
