/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "dotorg": an original 2026 control panel whose visual identity
 * follows the aMule project website (amule-org.github.io). Single-page app
 * on the shared JSON layer (api.php); desktop gets a brand navbar with
 * inline navigation and live status chips, phones get a bottom tab bar
 * with a "More" sheet. Full functional parity with the amule-default
 * template (transfers, search, shared, servers incl. disconnect, Kad
 * incl. bootstrap/nodes.dat, statistics graphs + tree, full preferences,
 * logs) plus light/dark theming.
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
/* Formatting                                                           */
/* ==================================================================== */

function fmtBytes(n) {
	n = Number(n) || 0;
	if (n < 1024) return n + ' B';
	const u = ['KB', 'MB', 'GB', 'TB'];
	let i = -1;
	do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
	return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + ' ' + u[i];
}
const fmtSpeed = (n) => (Number(n) > 0 ? fmtBytes(n) + '/s' : '—');
const pct = (done, size) => (size > 0 ? (Number(done) * 100) / Number(size) : 0);

const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioName(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : f.prio;
	if (f.prio_auto == 1) s += ' (auto)';
	return s;
}
function dlStatus(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}
const UNITS = { Byte: 1, KByte: 1024, MByte: 1048576, GByte: 1073741824 };

/* ==================================================================== */
/* Icons (inline SVG)                                                   */
/* ==================================================================== */

const ICONS = {
	transfer: 'M5 8l4-4v3h10v2H9v3zm14 8l-4 4v-3H5v-2h10v-3z',
	search: 'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
	share: 'M18 16a3 3 0 0 0-2.4 1.2l-7-3.5a3 3 0 0 0 0-1.4l7-3.5A3 3 0 1 0 15 7a3 3 0 0 0 .1.7l-7 3.5a3 3 0 1 0 0 3.6l7 3.5a3 3 0 1 0 2.9-2.3z',
	server: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zm8 6v3c0 1.7-3.6 3-8 3s-8-1.3-8-3V9c1.8 1.3 5 2 8 2s6.2-.7 8-2zm0 6v3c0 1.7-3.6 3-8 3s-8-1.3-8-3v-3c1.8 1.3 5 2 8 2s6.2-.7 8-2z',
	kad: 'M11 3h2v6.3l5.5-3.2 1 1.8L14 11l5.5 3.1-1 1.8L13 12.7V19h-2v-6.3l-5.5 3.2-1-1.8L10 11 4.5 7.9l1-1.8L11 9.3z',
	stats: 'M4 19h3v-8H4zm6 0h3V5h-3zm6 0h3v-12h-3z',
	settings: 'M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5zM13 15a3 3 0 1 1 3-3 3 3 0 0 1-3 3z',
	log: 'M4 5h16v3H4zm0 5h16v3H4zm0 5h10v3H4z',
	more: 'M6 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm6 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm6 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2z',
	play: 'M8 5v14l11-7z',
	pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
	up: 'M12 7l7 9H5z',
	down: 'M12 17l-7-9h14z',
	x: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
	reload: 'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
	plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
	dl: 'M11 4h2v7h3l-4 5-4-5h3zM5 18h14v2H5z',
	arrowdn: 'M12 16l-6-7h12z',
	arrowup: 'M12 8l6 7H6z',
	plug: 'M14 2h-2v6h2zM8 2H6v6h2zm9 8H3v2a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 17 12z',
	moon: 'M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6 8.5 8.5 0 1 0 20.4 14.2z',
	sun: 'M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0-5h0l1 3h-2zM12 22l-1-3h2zM2 12l3-1v2zM22 12l-3 1v-2zM4.2 4.2l2.9 1.4-1.4 1.4zM19.8 19.8l-2.9-1.4 1.4-1.4zM19.8 4.2l-1.4 2.9-1.4-1.4zM4.2 19.8l1.4-2.9 1.4 1.4z',
	exit: 'M10 3h9v18h-9v-2h7V5h-7zM10 8l5 4-5 4v-3H3v-2h7z',
};
const Icon = ({ name }) => html`<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

/* ==================================================================== */
/* Hooks / shared pieces                                                */
/* ==================================================================== */

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
function useSort(initKey, initDir) {
	const [key, setKey] = useState(initKey);
	const [dir, setDir] = useState(initDir || 1);
	const by = (k) => { if (k === key) setDir((d) => -d); else { setKey(k); setDir(1); } };
	const sort = (rows, acc) => {
		const f = acc[key];
		if (!f) return rows;
		return rows.slice().sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
	};
	return { key, dir, by, sort };
}
const Th = ({ label, k, sort, cls }) => html`
	<th class=${cls} onClick=${() => sort.by(k)}>
		${label}${sort.key === k ? html`<span class="arrow">${sort.dir > 0 ? '▾' : '▴'}</span>` : ''}
	</th>`;
const SelTh = ({ rows, sel }) => {
	const hashes = rows.map((r) => r.hash);
	const all = hashes.length > 0 && hashes.every((h) => sel.has(h));
	return html`<th class="check"><input type="checkbox" checked=${all}
		onChange=${(e) => sel.setAll(hashes, e.target.checked)} /></th>`;
};
const Tw = ({ children }) => html`<div class="tw">${children}</div>`;

const NameCell = ({ name, hash }) => (name
	? html`<td class="name" title=${name}>${name}</td>`
	: html`<td class="name faint" title=${hash || ''}>(unnamed)${hash ? ' · ' + hash.slice(0, 10) + '…' : ''}</td>`);

function ChunkBar({ hash, done, size }) {
	const [imgOk, setImgOk] = useState(true);
	const p = pct(done, size);
	return html`<span class="prog">
		${imgOk && !MOCK
			? html`<img class="chunk" alt="" src=${'dyn_' + hash + '.png?v=' + done}
				onError=${() => setImgOk(false)} />`
			: html`<span class=${'bar' + (p >= 100 ? ' done' : '')}><i style=${'width:' + p.toFixed(1) + '%'}></i></span>`}
		<span class="pct">${p.toFixed(0)}%</span>
	</span>`;
}

/* ==================================================================== */
/* Transfers                                                            */
/* ==================================================================== */

function Transfers({ data, guest, act, status }) {
	const sel = useSel();
	const sort = useSort('name', 1);
	const [fStatus, setFStatus] = useState('All');
	const [fCat, setFCat] = useState('All');
	const [link, setLink] = useState('');
	const [linkCat, setLinkCat] = useState(0);

	const cats = (status && status.categories) || [];
	const downloads = (data && data.downloads) || [];
	const uploads = (data && data.uploads) || [];

	const filtered = downloads.filter((f) => {
		if (fStatus !== 'All' && dlStatus(f) !== fStatus) return false;
		if (fCat !== 'All') { const i = cats.indexOf(fCat); if (i >= 0 && f.category !== i) return false; }
		return true;
	});
	const rows = sort.sort(filtered, {
		name: (f) => (f.name || '').toLowerCase(), size: (f) => Number(f.size),
		done: (f) => pct(f.size_done, f.size), speed: (f) => Number(f.speed),
		src: (f) => Number(f.src_count), status: (f) => dlStatus(f), prio: (f) => Number(f.prio),
	});
	const tot = downloads.reduce((a, f) => ({ size: a.size + Number(f.size), done: a.done + Number(f.size_done), speed: a.speed + Number(f.speed) }), { size: 0, done: 0, speed: 0 });
	const utot = uploads.reduce((a, f) => ({ up: a.up + Number(f.xfer_up), dn: a.dn + Number(f.xfer_down), speed: a.speed + Number(f.xfer_speed) }), { up: 0, dn: 0, speed: 0 });

	const cmd = (c) => {
		const list = sel.list();
		if (!list.length) return;
		if (c === 'cancel' && !confirm('Delete (cancel) the selected download(s)?')) return;
		act('dload_cmd', { cmd: c, hashes: list.join(',') });
		if (c === 'cancel') sel.clear();
	};
	const addLink = () => { if (link.trim()) { act('ed2k', { link: link.trim(), cat: linkCat }, 'Link added'); setLink(''); } };
	const dis = guest || sel.sel.size === 0;

	return html`
	<div>
		<div class="card">
			<header>Downloads <span class="count">${filtered.length}/${downloads.length}</span></header>
			<div class="body">
				<div class="toolbar">
					<button class="btn icon" title="Resume" disabled=${dis} onClick=${() => cmd('resume')}><${Icon} name="play"/></button>
					<button class="btn icon" title="Pause" disabled=${dis} onClick=${() => cmd('pause')}><${Icon} name="pause"/></button>
					<button class="btn icon" title="Priority up" disabled=${dis} onClick=${() => cmd('prioup')}><${Icon} name="up"/></button>
					<button class="btn icon" title="Priority down" disabled=${dis} onClick=${() => cmd('priodown')}><${Icon} name="down"/></button>
					<button class="btn icon danger" title="Cancel" disabled=${dis} onClick=${() => cmd('cancel')}><${Icon} name="x"/></button>
					<div class="sep"></div>
					<select value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
						${['All', 'Downloading', 'Waiting', 'Paused'].map((s) => html`<option key=${s}>${s}</option>`)}
					</select>
					<select value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
						<option>All</option>
						${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c}>${c}</option>`)}
					</select>
					<div class="grow"></div>
					<input class="mobilefull" type="text" placeholder="ed2k://… link" style="width:230px" value=${link}
						onInput=${(e) => setLink(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addLink()} />
					${cats.length > 0 ? html`<select value=${linkCat} onChange=${(e) => setLinkCat(+e.target.value)}>
						${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}</select>` : ''}
					<button class="btn primary" disabled=${guest || !link.trim()} onClick=${addLink}><${Icon} name="plus"/> Add</button>
				</div>
			</div>
			<${Tw}><table class="tbl">
				<thead><tr>
					<${SelTh} rows=${rows} sel=${sel} />
					<${Th} label="Name" k="name" sort=${sort} cls="name" />
					<${Th} label="Size" k="size" sort=${sort} cls="num" />
					<${Th} label="Done" k="done" sort=${sort} />
					<${Th} label="Speed" k="speed" sort=${sort} cls="num" />
					<${Th} label="Sources" k="src" sort=${sort} cls="num" />
					<${Th} label="Status" k="status" sort=${sort} />
					<${Th} label="Priority" k="prio" sort=${sort} />
				</tr></thead>
				<tbody>
					${rows.map((f) => {
						const st = dlStatus(f);
						return html`<tr key=${f.hash} class=${sel.has(f.hash) ? 'sel' : ''} onClick=${(e) => { if (e.target.type !== 'checkbox') sel.toggle(f.hash); }}>
							<td class="check"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
							<${NameCell} name=${f.name} hash=${f.hash} />
							<td class="num">${fmtBytes(f.size)}</td>
							<td><${ChunkBar} hash=${f.hash} done=${f.size_done} size=${f.size} /></td>
							<td class="num">${fmtSpeed(f.speed)}</td>
							<td class="num">${f.src_count_xfer} / ${f.src_count}${f.src_count_a4af ? ' +' + f.src_count_a4af : ''}</td>
							<td><span class=${'badge ' + (st === 'Downloading' ? 'dl' : st === 'Paused' ? 'pause' : 'wait')}>${st}</span></td>
							<td class="muted">${prioName(f)}</td>
						</tr>`;
					})}
					${rows.length === 0 ? html`<tr><td colspan="8" class="empty">No downloads</td></tr>` : ''}
				</tbody>
				${downloads.length ? html`<tfoot><tr>
					<td></td><td class="right">Total</td><td class="num">${fmtBytes(tot.size)}</td>
					<td class="muted">${pct(tot.done, tot.size).toFixed(0)}%</td><td class="num">${fmtSpeed(tot.speed)}</td>
					<td></td><td></td><td></td>
				</tr></tfoot>` : ''}
			</table><//>
		</div>

		<div class="card">
			<header>Uploads <span class="count">${uploads.length}</span></header>
			<${Tw}><table class="tbl">
				<thead><tr><th class="name nosort">Name</th><th class="nosort">User</th><th class="num nosort">Up</th><th class="num nosort">Down</th><th class="num nosort">Speed</th></tr></thead>
				<tbody>
					${uploads.map((f, i) => html`<tr key=${i}>
						<td class="name" title=${f.name}>${f.name}</td>
						<td class="muted">${f.user_name}</td>
						<td class="num">${fmtBytes(f.xfer_up)}</td>
						<td class="num">${fmtBytes(f.xfer_down)}</td>
						<td class="num">${fmtSpeed(f.xfer_speed)}</td>
					</tr>`)}
					${uploads.length === 0 ? html`<tr><td colspan="5" class="empty">No active uploads</td></tr>` : ''}
				</tbody>
				${uploads.length ? html`<tfoot><tr><td class="right" colspan="2">Total</td>
					<td class="num">${fmtBytes(utot.up)}</td><td class="num">${fmtBytes(utot.dn)}</td><td class="num">${fmtSpeed(utot.speed)}</td></tr></tfoot>` : ''}
			</table><//>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Search                                                               */
/* ==================================================================== */

function Search({ data, guest, act, status }) {
	const sel = useSel();
	const sort = useSort('sources', -1);
	const [q, setQ] = useState('');
	const [type, setType] = useState('0');
	const [avail, setAvail] = useState('');
	const [minV, setMinV] = useState(''); const [minU, setMinU] = useState('MByte');
	const [maxV, setMaxV] = useState(''); const [maxU, setMaxU] = useState('MByte');
	const [dlCat, setDlCat] = useState(0);

	const cats = (status && status.categories) || [];
	const results = (data && data.results) || [];
	const rows = sort.sort(results, {
		name: (f) => (f.name || '').toLowerCase(), size: (f) => Number(f.size), sources: (f) => Number(f.sources),
	});
	const doSearch = (e) => {
		e && e.preventDefault();
		if (!q.trim()) return;
		const minB = minV ? Math.round(Number(minV) * UNITS[minU]) : 0;
		const maxB = maxV ? Math.round(Number(maxV) * UNITS[maxU]) : 0;
		act('search_start', { keyword: q.trim(), type, avail: avail || 0, minsize: minB, maxsize: maxB }, 'Search started');
	};
	const download = () => {
		const list = sel.list();
		if (!list.length) return;
		act('search_download', { hashes: list.join(','), cat: dlCat }, 'Queued ' + list.length + ' file(s)');
		sel.clear();
	};
	const unitSel = (v, set) => html`<select value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u}>${u}</option>`)}</select>`;

	return html`
	<div class="card">
		<header>Search</header>
		<div class="body">
			<form class="toolbar" onSubmit=${doSearch}>
				<input class="grow mobilefull" type="search" placeholder="Search term" style="min-width:180px" value=${q} onInput=${(e) => setQ(e.target.value)} />
				<select value=${type} onChange=${(e) => setType(e.target.value)} title="Search type">
					<option value="0">Local</option><option value="1">Global</option><option value="2">Kad</option>
				</select>
				<button class="btn primary" type="submit" disabled=${guest || !q.trim()}><${Icon} name="search"/> Search</button>
			</form>
			<div class="toolbar" style="margin-top:8px">
				<span class="muted">Availability ≥</span>
				<input type="number" min="0" style="width:74px" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
				<div class="sep"></div>
				<span class="muted">Size</span>
				<input type="number" min="0" placeholder="min" style="width:74px" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
				${unitSel(minU, setMinU)}
				<span class="muted">–</span>
				<input type="number" min="0" placeholder="max" style="width:74px" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
				${unitSel(maxU, setMaxU)}
			</div>
		</div>
		<${Tw}><table class="tbl">
			<thead><tr>
				<${SelTh} rows=${rows} sel=${sel} />
				<${Th} label="File name" k="name" sort=${sort} cls="name" />
				<${Th} label="Size" k="size" sort=${sort} cls="num" />
				<${Th} label="Sources" k="sources" sort=${sort} cls="num" />
				<th class="nosort">Have</th>
			</tr></thead>
			<tbody>
				${rows.map((f) => html`<tr key=${f.hash} class=${sel.has(f.hash) ? 'sel' : ''} onClick=${(e) => { if (e.target.type !== 'checkbox') sel.toggle(f.hash); }}>
					<td class="check"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
					<${NameCell} name=${f.name} hash=${f.hash} />
					<td class="num">${fmtBytes(f.size)}</td>
					<td class="num">${f.sources}</td>
					<td>${f.present ? html`<span class="badge ok">✓</span>` : ''}</td>
				</tr>`)}
				${rows.length === 0 ? html`<tr><td colspan="5" class="empty">No results — start a search above</td></tr>` : ''}
			</tbody>
		</table><//>
		${rows.length ? html`<div class="body toolbar" style="border-top:1px solid var(--border)">
			<div class="grow"></div>
			<span class="muted">${sel.sel.size} selected →</span>
			${cats.length ? html`<select value=${dlCat} onChange=${(e) => setDlCat(+e.target.value)}>${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}</select>` : ''}
			<button class="btn primary" disabled=${guest || sel.sel.size === 0} onClick=${download}><${Icon} name="dl"/> Download</button>
		</div>` : ''}
	</div>`;
}

/* ==================================================================== */
/* Shared                                                               */
/* ==================================================================== */

function Shared({ data, guest, act }) {
	const sel = useSel();
	const sort = useSort('name', 1);
	const [setPrio, setSetPrio] = useState('1');
	const shared = (data && data.shared) || [];
	const rows = sort.sort(shared, {
		name: (f) => (f.name || '').toLowerCase(), xfer: (f) => Number(f.xfer), req: (f) => Number(f.req),
		acc: (f) => Number(f.accept), size: (f) => Number(f.size), prio: (f) => Number(f.prio),
	});
	const run = (cmd, prio) => {
		const list = sel.list();
		if (!list.length) return;
		act('shared_cmd', { cmd, hashes: list.join(','), prio: prio !== undefined ? prio : 0 });
	};
	const dis = guest || sel.sel.size === 0;
	return html`
	<div class="card">
		<header>Shared files <span class="count">${shared.length}</span></header>
		<div class="body toolbar">
			<button class="btn" disabled=${guest} onClick=${() => act('shared_cmd', { cmd: 'reload' }, 'Reloading shared files')}><${Icon} name="reload"/> Reload</button>
			<div class="sep"></div>
			<button class="btn icon" title="Priority up" disabled=${dis} onClick=${() => run('prioup')}><${Icon} name="up"/></button>
			<button class="btn icon" title="Priority down" disabled=${dis} onClick=${() => run('priodown')}><${Icon} name="down"/></button>
			<div class="sep"></div>
			<select value=${setPrio} onChange=${(e) => setSetPrio(e.target.value)}>
				<option value="0">Low</option><option value="1">Normal</option><option value="2">High</option>
			</select>
			<button class="btn" disabled=${dis} onClick=${() => run('setprio', setPrio)}>Set priority</button>
		</div>
		<${Tw}><table class="tbl">
			<thead><tr>
				<${SelTh} rows=${rows} sel=${sel} />
				<${Th} label="Name" k="name" sort=${sort} cls="name" />
				<${Th} label="Transferred" k="xfer" sort=${sort} cls="num" />
				<${Th} label="Requested" k="req" sort=${sort} cls="num" />
				<${Th} label="Accepted" k="acc" sort=${sort} cls="num" />
				<${Th} label="Size" k="size" sort=${sort} cls="num" />
				<${Th} label="Priority" k="prio" sort=${sort} />
			</tr></thead>
			<tbody>
				${rows.map((f) => html`<tr key=${f.hash} class=${sel.has(f.hash) ? 'sel' : ''} onClick=${(e) => { if (e.target.type !== 'checkbox') sel.toggle(f.hash); }}>
					<td class="check"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
					<${NameCell} name=${f.name} hash=${f.hash} />
					<td class="num">${fmtBytes(f.xfer)} <span class="faint">(${fmtBytes(f.xfer_all)})</span></td>
					<td class="num">${f.req} <span class="faint">(${f.req_all})</span></td>
					<td class="num">${f.accept} <span class="faint">(${f.accept_all})</span></td>
					<td class="num">${fmtBytes(f.size)}</td>
					<td class="muted">${prioName(f)}</td>
				</tr>`)}
				${rows.length === 0 ? html`<tr><td colspan="7" class="empty">No shared files</td></tr>` : ''}
			</tbody>
		</table><//>
	</div>`;
}

/* ==================================================================== */
/* Servers                                                              */
/* ==================================================================== */

function Servers({ data, guest, act, status }) {
	const sort = useSort('users', -1);
	const [name, setName] = useState('');
	const [addr, setAddr] = useState('');
	const [port, setPort] = useState('');
	const servers = (data && data.servers) || [];
	const connected = status && status.ed2k && status.ed2k.state === 'connected' ? status.ed2k.server : null;
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(), desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users), files: (s) => Number(s.files),
	});
	const addServer = () => {
		if (!addr.trim() || !port) return;
		act('server_add', { name: name.trim(), addr: addr.trim(), port }, 'Server added');
		setName(''); setAddr(''); setPort('');
	};
	return html`
	<div class="card">
		<header>ed2k servers <span class="count">${servers.length}</span>
			<span class="right">
				<button class="btn sm danger" disabled=${guest} onClick=${() => act('server_disconnect', {}, 'Disconnecting')}><${Icon} name="plug"/> Disconnect</button>
			</span>
		</header>
		<div class="body toolbar">
			<input type="text" placeholder="Name" style="width:130px" value=${name} onInput=${(e) => setName(e.target.value)} />
			<input type="text" placeholder="Address" style="width:170px" value=${addr} onInput=${(e) => setAddr(e.target.value)} />
			<input type="number" placeholder="Port" style="width:84px" value=${port} onInput=${(e) => setPort(e.target.value)} />
			<button class="btn" disabled=${guest || !addr.trim() || !port} onClick=${addServer}><${Icon} name="plus"/> Add server</button>
		</div>
		<${Tw}><table class="tbl">
			<thead><tr>
				<th class="nosort" style="width:104px">Action</th>
				<${Th} label="Name" k="name" sort=${sort} />
				<${Th} label="Description" k="desc" sort=${sort} cls="name" />
				<th class="nosort">Address</th>
				<${Th} label="Users" k="users" sort=${sort} cls="num" />
				<${Th} label="Files" k="files" sort=${sort} cls="num" />
			</tr></thead>
			<tbody>
				${rows.map((s) => html`<tr key=${s.ip + ':' + s.port}>
					<td class="nowrap">
						<button class="btn sm" disabled=${guest} onClick=${() => act('server_cmd', { cmd: 'connect', ip: s.ip, port: s.port }, 'Connecting to ' + (s.name || s.addr))}>Connect</button>
						${' '}
						<button class="btn sm danger" disabled=${guest} title="Remove" onClick=${() => act('server_cmd', { cmd: 'remove', ip: s.ip, port: s.port })}>✕</button>
					</td>
					<td>${s.name || html`<span class="faint">(unnamed)</span>`}
						${connected && s.name === connected ? html` <span class="badge ok">connected</span>` : ''}</td>
					<td class="name muted" title=${s.desc}>${s.desc}</td>
					<td class="mono muted nowrap">${s.addr}</td>
					<td class="num">${s.users}${s.maxusers ? html` <span class="faint">/ ${s.maxusers}</span>` : ''}</td>
					<td class="num">${s.files}</td>
				</tr>`)}
				${rows.length === 0 ? html`<tr><td colspan="6" class="empty">No servers</td></tr>` : ''}
			</tbody>
		</table><//>
	</div>`;
}

/* ==================================================================== */
/* Kad                                                                  */
/* ==================================================================== */

function Kad({ guest, act, status, tick }) {
	const [ip, setIp] = useState('');
	const [port, setPort] = useState('');
	const [url, setUrl] = useState('');
	const [gready, setGready] = useState(false);
	const kad = (status && status.kad) || { connected: false };
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const bootstrapIp = () => {
		const m = ip.trim().split('.');
		if (m.length !== 4 || !port) return;
		act('kad', { action: 'connect_ip', ip0: m[3], ip1: m[2], ip2: m[1], ip3: m[0], port }, 'Bootstrapping');
	};
	return html`
	<div>
		<div class="card">
			<header>Kademlia
				<span class="right">
					${kad.connected
						? html`<span class="badge ok">Connected${kad.firewalled ? ' · firewalled' : ''}</span>`
						: html`<span class="badge pause">Disconnected</span>`}
				</span>
			</header>
			<div class="body">
				<div class="grid">
					<div class="fieldset">
						<strong>Network</strong>
						<div class="toolbar">
							<button class="btn primary" disabled=${guest} onClick=${() => act('kad', { action: 'connect_known' }, 'Connecting to Kad')}>Connect from known peers</button>
							<button class="btn danger" disabled=${guest} onClick=${() => act('kad', { action: 'disconnect' }, 'Disconnecting Kad')}>Disconnect</button>
						</div>
					</div>
					<div class="fieldset">
						<strong>Bootstrap from a node</strong>
						<div class="toolbar">
							<input type="text" placeholder="IP (a.b.c.d)" style="width:140px" value=${ip} onInput=${(e) => setIp(e.target.value)} />
							<input type="number" placeholder="Port" style="width:90px" value=${port} onInput=${(e) => setPort(e.target.value)} />
							<button class="btn" disabled=${guest || !ip.trim() || !port} onClick=${bootstrapIp}>Connect</button>
						</div>
					</div>
					<div class="fieldset">
						<strong>Update node list from URL</strong>
						<div class="toolbar">
							<input class="grow mobilefull" type="text" placeholder="http://…/nodes.dat" style="min-width:200px" value=${url} onInput=${(e) => setUrl(e.target.value)} />
							<button class="btn" disabled=${guest || !url.trim()} onClick=${() => act('kad', { action: 'update_url', url: url.trim() }, 'Updating nodes')}>Update</button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="card">
			<header>Kad nodes</header>
			<div class="body">
				${!MOCK && gready
					? html`<figure class="gfig" style="max-width:560px;margin:0 auto"><img class="gimg" src=${'amule_stats_kad.png?v=' + tick} alt="Kad nodes" /></figure>`
					: html`<div class="empty">Graph is rendered by a live aMule</div>`}
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Statistics                                                           */
/* ==================================================================== */

function TreeNode({ name, node }) {
	const [open, setOpen] = useState(true);
	if (node === null || node === undefined) return html`<li class="leaf">${name}</li>`;
	return html`<li>
		<div class=${'folder' + (open ? ' open' : '')} onClick=${() => setOpen((o) => !o)}>${name}</div>
		${open ? html`<ul>${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}</ul>` : ''}
	</li>`;
}
const GRAPHS = [
	['amule_stats_download.png', 'Download speed'],
	['amule_stats_upload.png', 'Upload speed'],
	['amule_stats_conncount.png', 'Connections'],
];
function Stats({ tick }) {
	const [tree, setTree] = useState(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setReady(true); }).catch(() => {});
		apiGet('statstree').then((d) => { if (alive) setTree(d || null); }).catch(() => {});
		return () => { alive = false; };
	}, [tick]);
	return html`
	<div>
		<div class="card">
			<header>Graphs</header>
			<div class="body gwrap">
				${MOCK ? html`<div class="empty">Graphs are rendered by a live aMule</div>`
				: !ready ? html`<div class="empty">Loading…</div>`
				: GRAPHS.map(([src, label]) => html`<figure class="gfig" key=${src}>
					<img class="gimg" src=${src + '?v=' + tick} alt=${label} />
					<figcaption class="gcap">${label}</figcaption>
				</figure>`)}
			</div>
		</div>
		<div class="card">
			<header>Statistics tree</header>
			<div class="body">
				${tree ? html`<div class="tree"><ul>${Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}</ul></div>`
					: html`<div class="empty">Loading…</div>`}
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Settings                                                             */
/* ==================================================================== */

function Settings({ guest, act }) {
	const [form, setForm] = useState(null);
	const [busy, setBusy] = useState(false);
	const load = useCallback(() => apiGet('options').then((o) => { const f = Object.assign({}, o); delete f.categories; setForm(f); }).catch(() => {}), []);
	useEffect(() => { load(); }, [load]);
	if (!form) return html`<div class="card"><div class="empty">Loading…</div></div>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const txt = (k, label, suffix) => html`<div class="field"><label>${label}</label><div>
		<input type="text" value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} disabled=${guest} />
		${suffix ? html`<span class="hint"> ${suffix}</span>` : ''}</div></div>`;
	const chk = (k, label) => html`<label class="check"><input type="checkbox" disabled=${guest}
		checked=${form[k] === '1' || form[k] === 1} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} /> ${label}</label>`;
	const apply = async () => {
		setBusy(true);
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		const res = await act('set_options', payload, 'Settings applied');
		if (!(res && res.ok === false)) await load();
		setBusy(false);
	};
	const sect = (title, children) => html`<div class="card"><header>${title}</header><div class="body fieldset">${children}</div></div>`;
	return html`
	<div>
		<div class="grid">
			${sect('General', [txt('nick', 'Nickname')])}
			${sect('Web server', [txt('autorefresh_time', 'Auto-refresh', 'seconds'), chk('use_gzip', 'Use gzip compression')])}
			${sect('Line capacity (statistics)', [txt('max_line_down_cap', 'Max download rate', 'kB/s'), txt('max_line_up_cap', 'Max upload rate', 'kB/s')])}
			${sect('Bandwidth limits', [txt('max_down_limit', 'Max download rate', 'kB/s'), txt('max_up_limit', 'Max upload rate', 'kB/s'), txt('slot_alloc', 'Slot allocation')])}
			${sect('Connection', [txt('max_conn_total', 'Max connections'), txt('max_file_src', 'Max sources / file'),
				chk('autoconn_en', 'Auto-connect at startup'), chk('reconn_en', 'Reconnect when lost'),
				chk('network_ed2k', 'Enable ed2k network'), chk('network_kad', 'Enable Kad network')])}
			${sect('Network ports', [txt('tcp_port', 'TCP port'), txt('udp_port', 'UDP port'), chk('udp_dis', 'Disable UDP')])}
			${sect('Files', [chk('check_free_space', 'Check free space'), txt('min_free_space', 'Min free space', 'MB'),
				chk('new_files_auto_dl_prio', 'New downloads: auto priority'), chk('new_files_auto_ul_prio', 'New shares: auto priority'),
				chk('ich_en', 'I.C.H. active'), chk('aich_trust', 'AICH trusts every hash'),
				chk('alloc_full_chunks', 'Alloc full chunks of .part'), chk('alloc_full', 'Alloc full disk space for .part'),
				chk('new_files_paused', 'Add new downloads paused'), chk('extract_metadata', 'Extract metadata tags')])}
		</div>
		<div class="toolbar" style="margin-top:4px">
			<button class="btn primary" disabled=${guest || busy} onClick=${apply}>${busy ? html`<span class="spin"></span> ` : ''}Apply settings</button>
			<button class="btn" onClick=${load} disabled=${busy}>Reload</button>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Log                                                                  */
/* ==================================================================== */

function Log() {
	const [log, setLog] = useState('');
	const [srv, setSrv] = useState('');
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<div>
		<div class="card">
			<header>aMule log
				<span class="right">
					<button class="btn sm" onClick=${() => loadLog(0)}>Refresh</button>
					<button class="btn sm danger" onClick=${() => confirm('Reset the aMule log?') && loadLog(1)}>Reset</button>
				</span>
			</header>
			<div class="body"><pre class="logbox">${log || 'empty'}</pre></div>
		</div>
		<div class="card">
			<header>Server info
				<span class="right">
					<button class="btn sm" onClick=${() => loadSrv(0)}>Refresh</button>
					<button class="btn sm danger" onClick=${() => confirm('Reset server info?') && loadSrv(1)}>Reset</button>
				</span>
			</header>
			<div class="body"><pre class="logbox">${srv || 'empty'}</pre></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

const TABS = [
	['transfers', 'Transfers', 'transfer'],
	['search', 'Search', 'search'],
	['shared', 'Shared', 'share'],
	['servers', 'Servers', 'server'],
	['kad', 'Kad', 'kad'],
	['stats', 'Statistics', 'stats'],
	['settings', 'Settings', 'settings'],
	['log', 'Log', 'log'],
];
const MAIN_TABS = ['transfers', 'search', 'shared', 'servers'];
const MORE_TABS = TABS.filter(([id]) => MAIN_TABS.indexOf(id) < 0);
const VIEW_ROUTE = { transfers: 'transfers', shared: 'shared', servers: 'servers', search: 'search' };
const REFRESH_MS = 3000;

const initialTab = () => {
	const h = location.hash.replace('#', '');
	return TABS.some((t) => t[0] === h) ? h : 'transfers';
};
const initialTheme = () => {
	const q = new URLSearchParams(location.search).get('theme');
	if (q === 'dark' || q === 'light') return q;
	try {
		const t = localStorage.getItem('dotorg-theme');
		if (t === 'dark' || t === 'light') return t;
	} catch (e) { /* ignore */ }
	return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
	const [tab, setTab] = useState(initialTab);
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [tick, setTick] = useState(0);
	const [connErr, setConnErr] = useState(false);
	const [toasts, setToasts] = useState([]);
	const [more, setMore] = useState(false);
	const [theme, setThemeState] = useState(initialTheme);
	const busyRef = useRef(false);

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
		try { localStorage.setItem('dotorg-theme', theme); } catch (e) { /* ignore */ }
		const meta = document.querySelector('meta[name=theme-color]');
		if (meta) meta.content = theme === 'dark' ? '#1b1b1d' : '#235787';
	}, [theme]);

	const toast = useCallback((msg, err) => {
		const id = Math.random().toString(36).slice(2);
		setToasts((t) => t.concat({ id, msg, err }));
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
	}, []);

	const cycle = useCallback(async (force) => {
		if (busyRef.current || (document.hidden && !force)) return;
		busyRef.current = true;
		try {
			const s = await apiGet('status');
			setStatus(s); setConnErr(false);
			const route = VIEW_ROUTE[tab];
			if (route) { const d = await apiGet(route); setData(d); }
			setTick((t) => t + 1);
		} catch (e) { setConnErr(true); }
		busyRef.current = false;
	}, [tab]);

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

	const guest = !!(status && status.guest);
	const act = useCallback(async (route, params, okMsg) => {
		try {
			const res = await apiPost(route, params);
			if (res && res.ok === false) toast(res.error === 'guest' ? 'Guest mode: commands are disabled' : 'Error: ' + res.error, true);
			else if (okMsg) toast(okMsg);
			cycle(true);
			return res;
		} catch (e) { toast('Request failed: ' + e.message, true); return { ok: false, error: e.message }; }
	}, [cycle, toast]);

	const go = (id) => {
		setMore(false);
		if (id !== tab) {
			setData(null); setTab(id);
			try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
		}
	};

	const vp = { data, guest, act, status, tick };
	let view;
	if (tab === 'transfers') view = html`<${Transfers} ...${vp} />`;
	else if (tab === 'search') view = html`<${Search} ...${vp} />`;
	else if (tab === 'shared') view = html`<${Shared} ...${vp} />`;
	else if (tab === 'servers') view = html`<${Servers} ...${vp} />`;
	else if (tab === 'kad') view = html`<${Kad} ...${vp} />`;
	else if (tab === 'stats') view = html`<${Stats} tick=${tick} />`;
	else if (tab === 'settings') view = html`<${Settings} guest=${guest} act=${act} />`;
	else if (tab === 'log') view = html`<${Log} />`;

	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };
	const ed2kDot = ed2k.state === 'connected' ? 'on' : ed2k.state === 'connecting' ? 'busy' : 'off';
	const moreActive = MAIN_TABS.indexOf(tab) < 0;

	return html`
	<div>
		<header class="topbar">
			<div class="brand"><img src=${A + 'logo.png'} alt="" /><span>aMule</span></div>
			<nav>
				${TABS.map(([id, label]) => html`<a key=${id} href=${'#' + id} class=${tab === id ? 'on' : ''}
					onClick=${(e) => { e.preventDefault(); go(id); }}>${label}</a>`)}
			</nav>
			<div class="grow"></div>
			<div class="chips">
				<span class="chip" title=${'ed2k: ' + (ed2k.server || ed2k.state)}>
					<span class=${'dot ' + ed2kDot}></span><span class="txt">ed2k</span>
				</span>
				<span class="chip" title=${'Kad: ' + (kad.connected ? (kad.firewalled ? 'firewalled' : 'connected') : 'disconnected')}>
					<span class=${'dot ' + (kad.connected ? 'on' : 'off')}></span><span class="txt">Kad</span>
				</span>
				<span class="chip"><${Icon} name="arrowdn"/> ${fmtSpeed(status && status.speed_down)}</span>
				<span class="chip"><${Icon} name="arrowup"/> ${fmtSpeed(status && status.speed_up)}</span>
			</div>
			<button class="iconbtn" title="Toggle theme" onClick=${() => setThemeState(theme === 'dark' ? 'light' : 'dark')}>
				<${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} />
			</button>
			<a class="iconbtn" title="Log out" href="login.php"><${Icon} name="exit"/></a>
		</header>

		<main>
			${connErr ? html`<div class="banner">⚠ Cannot reach aMule. Is amuleweb running? Retrying…</div>` : ''}
			${guest ? html`<div class="banner">You are logged in as guest — commands are disabled.</div>` : ''}
			${view}
			<div class="sitefooter" style="border-radius: var(--radius)">
				<span>aMule control panel</span>
				<span class="grow"></span>
				<span class="rate"><${Icon} name="arrowdn"/> ${fmtSpeed(status && status.speed_down)}</span>
				<span class="rate"><${Icon} name="arrowup"/> ${fmtSpeed(status && status.speed_up)}</span>
				${status && status.version ? html`<span class="faint">aMule ${status.version}</span>` : ''}
			</div>
		</main>

		${more ? html`<div class="sheet-back" onClick=${() => setMore(false)}></div>
		<div class="sheet">
			${MORE_TABS.map(([id, label, icon]) => html`<button key=${id} onClick=${() => go(id)}>
				<${Icon} name=${icon} />${label}</button>`)}
		</div>` : ''}

		<nav class="bottnav">
			${MAIN_TABS.map((id) => {
				const t = TABS.find((x) => x[0] === id);
				return html`<button key=${id} class=${tab === id ? 'on' : ''} onClick=${() => go(id)}>
					<${Icon} name=${t[2]} />${t[1]}</button>`;
			})}
			<button class=${moreActive || more ? 'on' : ''} onClick=${() => setMore(!more)}>
				<${Icon} name="more" />More</button>
		</nav>

		<div class="toast-wrap">
			${toasts.map((t) => html`<div key=${t.id} class=${'toast' + (t.err ? ' err' : '')}>${t.msg}</div>`)}
		</div>
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
