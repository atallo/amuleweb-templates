/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. See the LICENSE file for details.
 */
/*
 * app.js -- minimalist aMule control panel (single-page app).
 *
 * Front end only: it talks to api.php (the PHP service layer inside amuleweb)
 * over fetch and renders everything with Preact + HTM. No build step.
 *
 * amuleweb is single-threaded, so EVERY request goes through one serialized
 * queue -- there is never more than one request in flight, and polling cycles
 * are skipped while one is still running.
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

/* ==================================================================== */
/* API client (single-flight, serialized)                               */
/* ==================================================================== */

const MOCK = (typeof window !== 'undefined' && window.AMULE_MOCK) || null;

// All requests are chained so two never overlap.
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
/* Formatting / domain helpers                                          */
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
/* Inline-SVG icons (no image files)                                    */
/* ==================================================================== */

const ICONS = {
	play: 'M8 5v14l11-7z',
	pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
	up: 'M12 7l7 9H5z',
	down: 'M12 17l-7-9h14z',
	x: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
	reload: 'M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
	search: 'M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
	plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
	dl: 'M11 4h2v7h3l-4 5-4-5h3zM5 18h14v2H5z',
	arrowdn: 'M12 16l-6-7h12z',
	arrowup: 'M12 8l6 7H6z',
	plug: 'M14 2h-2v6h2zM8 2H6v6h2zm9 8H3v2a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 17 12z',
	menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
};
const Icon = ({ name }) => html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

/* ==================================================================== */
/* Local UI-state hooks                                                  */
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
// Name cell with a graceful fallback: this amuleweb build exports an EMPTY
// name for files whose real name contains non-ASCII characters (locale-
// dependent conversion in the container). Show the hash so rows stay usable.
const NameCell = ({ name, hash }) => (name
	? html`<td class="name" title=${name}>${name}</td>`
	: html`<td class="name faint" title=${hash || ''}>(unnamed)${hash ? ' · ' + hash.slice(0, 10) + '…' : ''}</td>`);

const Th = ({ label, k, sort, cls }) => html`
	<th class=${cls} onClick=${() => sort.by(k)}>
		${label}${sort.key === k ? html`<span class="arrow">${sort.dir > 0 ? '▾' : '▴'}</span>` : ''}
	</th>`;
const SelTh = ({ rows, sel }) => {
	const hashes = rows.map((x) => x.hash);
	const all = hashes.length > 0 && hashes.every((h) => sel.has(h));
	return html`<th class="check"><input type="checkbox" checked=${all}
		onChange=${(e) => sel.setAll(hashes, e.target.checked)} /></th>`;
};
const Tw = ({ children }) => html`<div class="tablewrap">${children}</div>`;

// Chunk-level progress bar: amuleweb renders a 200x20 PNG per download at
// dyn_<HASH>.png (green done, blue shades = availability, red = no source,
// yellow = downloading) -- the same technique the stock template uses. The
// ?v= cache-buster changes only when the file actually advances. Falls back
// to a plain CSS bar in mock mode or if the image cannot be served.
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
		if (fCat !== 'All') { const idx = cats.indexOf(fCat); if (idx >= 0 && f.category !== idx) return false; }
		return true;
	});
	const rows = sort.sort(filtered, {
		name: (f) => f.name.toLowerCase(), size: (f) => Number(f.size),
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
	<div class="view">
		<div class="card">
			<h2>Downloads <span class="count">${filtered.length}/${downloads.length}</span></h2>
			<div class="card-body" style="padding-bottom:4px">
				<div class="toolbar" style="padding-top:0">
					<div class="group">
						<button class="btn icon" title="Resume" disabled=${dis} onClick=${() => cmd('resume')}><${Icon} name="play"/></button>
						<button class="btn icon" title="Pause" disabled=${dis} onClick=${() => cmd('pause')}><${Icon} name="pause"/></button>
						<button class="btn icon" title="Priority up" disabled=${dis} onClick=${() => cmd('prioup')}><${Icon} name="up"/></button>
						<button class="btn icon" title="Priority down" disabled=${dis} onClick=${() => cmd('priodown')}><${Icon} name="down"/></button>
						<button class="btn icon danger" title="Cancel" disabled=${dis} onClick=${() => cmd('cancel')}><${Icon} name="x"/></button>
					</div>
					<div class="sep"></div>
					<div class="group">
						<select value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
							${['All', 'Downloading', 'Waiting', 'Paused'].map((s) => html`<option>${s}</option>`)}
						</select>
						<select value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
							<option>All</option>${cats.map((c) => html`<option>${c}</option>`)}
						</select>
					</div>
					<div class="grow"></div>
					<div class="group addlink">
						<input type="text" placeholder="ed2k://… link" value=${link}
							onInput=${(e) => setLink(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addLink()} />
						${cats.length > 0 ? html`<select value=${linkCat} onChange=${(e) => setLinkCat(+e.target.value)}>
							${cats.map((c, i) => html`<option value=${i}>${c}</option>`)}</select>` : ''}
						<button class="btn" disabled=${guest || !link.trim()} onClick=${addLink}><${Icon} name="plus"/> Add</button>
					</div>
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
							<td><span class=${'pill ' + (st === 'Downloading' ? 'dl' : st === 'Paused' ? 'pause' : 'wait')}>${st}</span></td>
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
			<h2>Uploads <span class="count">${uploads.length}</span></h2>
			<${Tw}><table class="tbl">
				<thead><tr><th class="name">Name</th><th>User</th><th class="num">Up</th><th class="num">Down</th><th class="num">Speed</th></tr></thead>
				<tbody>
					${uploads.map((f, i) => html`<tr key=${i}>
						<${NameCell} name=${f.name} hash=${f.hash} />
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
		name: (f) => f.name.toLowerCase(), size: (f) => Number(f.size), sources: (f) => Number(f.sources),
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
	return html`
	<div class="view">
		<div class="card">
			<h2>Search</h2>
			<div class="card-body">
				<form class="toolbar" style="padding:0" onSubmit=${doSearch}>
					<input type="search" placeholder="Search term" class="grow" value=${q} onInput=${(e) => setQ(e.target.value)} />
					<select value=${type} onChange=${(e) => setType(e.target.value)} title="Search type">
						<option value="0">Local</option><option value="1">Global</option><option value="2">Kad</option>
					</select>
					<button class="btn primary" type="submit" disabled=${guest || !q.trim()}><${Icon} name="search"/> Search</button>
				</form>
				<div class="toolbar" style="padding-bottom:0">
					<label class="muted">Avail ≥</label>
					<input type="number" min="0" style="width:72px" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
					<div class="sep"></div>
					<label class="muted">Size</label>
					<input type="number" min="0" placeholder="min" style="width:72px" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
					<select value=${minU} onChange=${(e) => setMinU(e.target.value)}>${Object.keys(UNITS).map((u) => html`<option>${u}</option>`)}</select>
					<span class="muted">–</span>
					<input type="number" min="0" placeholder="max" style="width:72px" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
					<select value=${maxU} onChange=${(e) => setMaxU(e.target.value)}>${Object.keys(UNITS).map((u) => html`<option>${u}</option>`)}</select>
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
						<td class="ok">${f.present ? '✓' : ''}</td>
					</tr>`)}
					${rows.length === 0 ? html`<tr><td colspan="5" class="empty">No results — start a search above</td></tr>` : ''}
				</tbody>
			</table><//>
			${rows.length ? html`<div class="card-body toolbar" style="border-top:1px solid var(--border)">
				<div class="grow"></div>
				<span class="muted">${sel.sel.size} selected →</span>
				${cats.length ? html`<select value=${dlCat} onChange=${(e) => setDlCat(+e.target.value)}>${cats.map((c, i) => html`<option value=${i}>${c}</option>`)}</select>` : ''}
				<button class="btn primary" disabled=${guest || sel.sel.size === 0} onClick=${download}><${Icon} name="dl"/> Download</button>
			</div>` : ''}
		</div>
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
		name: (f) => f.name.toLowerCase(), xfer: (f) => Number(f.xfer), req: (f) => Number(f.req),
		acc: (f) => Number(f.accept), size: (f) => Number(f.size), prio: (f) => Number(f.prio),
	});
	const run = (cmd, prio) => {
		const list = sel.list(); if (!list.length) return;
		act('shared_cmd', { cmd, hashes: list.join(','), prio: prio !== undefined ? prio : 0 });
	};
	const dis = guest || sel.sel.size === 0;
	return html`
	<div class="view">
		<div class="card">
			<h2>Shared files <span class="count">${shared.length}</span></h2>
			<div class="card-body"><div class="toolbar" style="padding:0">
				<button class="btn" disabled=${guest} onClick=${() => act('shared_cmd', { cmd: 'reload' }, 'Reloading shared files')}><${Icon} name="reload"/> Reload</button>
				<div class="sep"></div>
				<button class="btn icon" title="Priority up" disabled=${dis} onClick=${() => run('prioup')}><${Icon} name="up"/></button>
				<button class="btn icon" title="Priority down" disabled=${dis} onClick=${() => run('priodown')}><${Icon} name="down"/></button>
				<div class="sep"></div>
				<select value=${setPrio} onChange=${(e) => setSetPrio(e.target.value)}>
					<option value="0">Low</option><option value="1">Normal</option><option value="2">High</option>
				</select>
				<button class="btn" disabled=${dis} onClick=${() => run('setprio', setPrio)}>Set</button>
			</div></div>
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
		</div>
	</div>`;
}

/* ==================================================================== */
/* Servers                                                              */
/* ==================================================================== */

function Servers({ data, guest, act }) {
	const sort = useSort('users', -1);
	const [name, setName] = useState(''); const [addr, setAddr] = useState(''); const [port, setPort] = useState('');
	const servers = (data && data.servers) || [];
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
	<div class="view">
		<div class="card">
			<h2>ed2k servers <span class="count">${servers.length}</span></h2>
			<div class="card-body"><div class="toolbar" style="padding:0">
				<button class="btn danger" disabled=${guest} onClick=${() => act('server_disconnect', {}, 'Disconnecting')}><${Icon} name="plug"/> Disconnect</button>
				<div class="grow"></div>
				<input type="text" placeholder="Name" style="width:120px" value=${name} onInput=${(e) => setName(e.target.value)} />
				<input type="text" placeholder="Address" style="width:150px" value=${addr} onInput=${(e) => setAddr(e.target.value)} />
				<input type="number" placeholder="Port" style="width:78px" value=${port} onInput=${(e) => setPort(e.target.value)} />
				<button class="btn" disabled=${guest || !addr.trim() || !port} onClick=${addServer}><${Icon} name="plus"/> Add</button>
			</div></div>
			<${Tw}><table class="tbl">
				<thead><tr>
					<th class="nosort" style="width:96px">Action</th>
					<${Th} label="Name" k="name" sort=${sort} />
					<${Th} label="Description" k="desc" sort=${sort} cls="name" />
					<th class="nosort">Address</th>
					<${Th} label="Users" k="users" sort=${sort} cls="num" />
					<${Th} label="Files" k="files" sort=${sort} cls="num" />
				</tr></thead>
				<tbody>
					${rows.map((s) => html`<tr key=${s.ip + ':' + s.port}>
						<td class="nowrap">
							<button class="btn sm" disabled=${guest} title="Connect" onClick=${() => act('server_cmd', { cmd: 'connect', ip: s.ip, port: s.port }, 'Connecting to ' + (s.name || s.addr))}>Connect</button>
							<button class="btn sm danger" disabled=${guest} title="Remove" onClick=${() => act('server_cmd', { cmd: 'remove', ip: s.ip, port: s.port })}>✕</button>
						</td>
						<td>${s.name || html`<span class="faint">(unnamed)</span>`}</td>
						<td class="name muted" title=${s.desc}>${s.desc}</td>
						<td class="mono muted nowrap">${s.addr}</td>
						<td class="num">${s.users}${s.maxusers ? ' / ' + s.maxusers : ''}</td>
						<td class="num">${s.files}</td>
					</tr>`)}
					${rows.length === 0 ? html`<tr><td colspan="6" class="empty">No servers</td></tr>` : ''}
				</tbody>
			</table><//>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Kad                                                                  */
/* ==================================================================== */

function Kad({ guest, act, status, tick }) {
	const [ip, setIp] = useState(''); const [port, setPort] = useState(''); const [url, setUrl] = useState('');
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
		act('kad', { action: 'connect_ip', ip0: m[0], ip1: m[1], ip2: m[2], ip3: m[3], port }, 'Bootstrapping');
	};
	return html`
	<div class="view">
		<div class="card">
			<h2>Kademlia network</h2>
			<div class="card-body">
				<p>Status:
					${kad.connected
						? html`<span class="pill ok" style="margin-left:6px">Connected${kad.firewalled ? ' (firewalled)' : ' (open)'}</span>`
						: html`<span class="pill pause" style="margin-left:6px">Disconnected</span>`}</p>
				${!MOCK && gready ? html`<figure class="gfig" style="max-width:540px;margin:0 0 14px">
					<img class="gimg" src=${'amule_stats_kad.png?v=' + tick} alt="Kad nodes" />
					<figcaption class="hint" style="text-align:center">Kad nodes</figcaption>
				</figure>` : ''}
				<div class="grid">
					<div class="fieldset">
						<h3>Network</h3>
						<div class="toolbar" style="padding:0">
							<button class="btn primary" disabled=${guest} onClick=${() => act('kad', { action: 'connect_known' }, 'Connecting to Kad')}>Connect from known peers</button>
							<button class="btn danger" disabled=${guest} onClick=${() => act('kad', { action: 'disconnect' }, 'Disconnecting Kad')}>Disconnect</button>
						</div>
					</div>
					<div class="fieldset">
						<h3>Bootstrap from a node</h3>
						<div class="toolbar" style="padding:0">
							<input type="text" placeholder="IP (a.b.c.d)" style="width:140px" value=${ip} onInput=${(e) => setIp(e.target.value)} />
							<input type="number" placeholder="Port" style="width:90px" value=${port} onInput=${(e) => setPort(e.target.value)} />
							<button class="btn" disabled=${guest || !ip.trim() || !port} onClick=${bootstrapIp}>Connect</button>
						</div>
					</div>
					<div class="fieldset">
						<h3>Update node list from URL</h3>
						<div class="toolbar" style="padding:0">
							<input type="text" placeholder="http://…/nodes.dat" class="grow" value=${url} onInput=${(e) => setUrl(e.target.value)} />
							<button class="btn" disabled=${guest || !url.trim()} onClick=${() => act('kad', { action: 'update_url', url: url.trim() }, 'Updating nodes')}>Update</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Statistics (server-rendered graphs + stats tree)                     */
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

// The graphs are PNGs rendered by amuleweb itself (with real server-side
// history), same as the stock template; statsgraph registers them for this
// session before they are loaded.
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
	<div class="view">
		<div class="card">
			<h2>Graphs</h2>
			<div class="card-body gwrap">
				${MOCK ? html`<div class="empty">Graphs are rendered by a live aMule</div>`
				: !ready ? html`<div class="empty">Loading…</div>`
				: GRAPHS.map(([src, label]) => html`<figure class="gfig" key=${src}>
					<img class="gimg" src=${src + '?v=' + tick} alt=${label} />
					<figcaption class="hint" style="text-align:center">${label}</figcaption>
				</figure>`)}
			</div>
		</div>
		<div class="card">
			<h2>Statistics</h2>
			<div class="card-body">
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
	if (!form) return html`<div class="view"><div class="card"><div class="empty">Loading…</div></div></div>`;

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
	return html`
	<div class="view">
		<div class="grid">
			<div class="card"><h2>General</h2><div class="card-body fieldset">${txt('nick', 'Nickname')}</div></div>
			<div class="card"><h2>Web server</h2><div class="card-body fieldset">
				${txt('autorefresh_time', 'Auto-refresh', 'seconds')}${chk('use_gzip', 'Use gzip compression')}</div></div>
			<div class="card"><h2>Line capacity (statistics)</h2><div class="card-body fieldset">
				${txt('max_line_down_cap', 'Max download rate', 'kB/s')}${txt('max_line_up_cap', 'Max upload rate', 'kB/s')}</div></div>
			<div class="card"><h2>Bandwidth limits</h2><div class="card-body fieldset">
				${txt('max_down_limit', 'Max download rate', 'kB/s')}${txt('max_up_limit', 'Max upload rate', 'kB/s')}${txt('slot_alloc', 'Slot allocation')}</div></div>
			<div class="card"><h2>Connection</h2><div class="card-body fieldset">
				${txt('max_conn_total', 'Max connections')}${txt('max_file_src', 'Max sources / file')}
				${chk('autoconn_en', 'Auto-connect at startup')}${chk('reconn_en', 'Reconnect when lost')}
				${chk('network_ed2k', 'Enable ed2k network')}${chk('network_kad', 'Enable Kad network')}</div></div>
			<div class="card"><h2>Network ports</h2><div class="card-body fieldset">
				${txt('tcp_port', 'TCP port')}${txt('udp_port', 'UDP port')}${chk('udp_dis', 'Disable UDP')}</div></div>
			<div class="card"><h2>Files</h2><div class="card-body fieldset">
				${chk('check_free_space', 'Check free space')}${txt('min_free_space', 'Min free space', 'MB')}
				${chk('new_files_auto_dl_prio', 'New downloads: auto priority')}${chk('new_files_auto_ul_prio', 'New shares: auto priority')}
				${chk('ich_en', 'I.C.H. active')}${chk('aich_trust', 'AICH trusts every hash')}
				${chk('alloc_full_chunks', 'Alloc full chunks of .part')}${chk('alloc_full', 'Alloc full disk space for .part')}
				${chk('new_files_paused', 'Add new downloads paused')}${chk('extract_metadata', 'Extract metadata tags')}</div></div>
		</div>
		<div class="toolbar">
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
	// log/serverinfo are served as plain text (see api.php).
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<div class="view">
		<div class="card">
			<h2>aMule log<span class="grow"></span>
				<button class="btn sm" onClick=${() => loadLog(0)}>Refresh</button>
				<button class="btn sm danger" onClick=${() => confirm('Reset the aMule log?') && loadLog(1)}>Reset</button></h2>
			<div class="card-body"><pre class="logbox">${log || 'empty'}</pre></div>
		</div>
		<div class="card">
			<h2>Server info<span class="grow"></span>
				<button class="btn sm" onClick=${() => loadSrv(0)}>Refresh</button>
				<button class="btn sm danger" onClick=${() => confirm('Reset server info?') && loadSrv(1)}>Reset</button></h2>
			<div class="card-body"><pre class="logbox">${srv || 'empty'}</pre></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

const TABS = [
	['transfers', 'Transfers'], ['search', 'Search'], ['shared', 'Shared'],
	['servers', 'Servers'], ['kad', 'Kad'], ['stats', 'Statistics'],
	['settings', 'Settings'], ['log', 'Log'],
];
const REFRESH_OPTS = [['0', 'off'], ['2000', '2s'], ['5000', '5s'], ['10000', '10s']];
const VIEW_ROUTE = { transfers: 'transfers', shared: 'shared', servers: 'servers', search: 'search' };

// Deep-linkable tabs: #search, #stats, ... pick the initial view.
const initialTab = () => {
	const h = location.hash.replace('#', '');
	return TABS.some((t) => t[0] === h) ? h : 'transfers';
};

function App() {
	const [tab, setTab] = useState(initialTab);
	const [refreshMs, setRefreshMs] = useState(2000);
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [connErr, setConnErr] = useState(false);
	const [toasts, setToasts] = useState([]);
	const [menuOpen, setMenuOpen] = useState(false);
	const [tick, setTick] = useState(0); // increments per poll; drives graph cache-busting
	const busyRef = useRef(false);

	const toast = useCallback((msg, err) => {
		const id = Math.random().toString(36).slice(2);
		setToasts((t) => t.concat({ id, msg, err }));
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
	}, []);

	// One serialized poll cycle: status, then (if any) the active view's data.
	// `force` skips the hidden-tab guard: explicit loads (mount, tab change,
	// after an action, tab became visible) always run; only the background
	// interval is suppressed while the page is not visible.
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
		if (!refreshMs) return undefined;
		const t = setInterval(() => cycle(false), refreshMs);
		return () => clearInterval(t);
	}, [cycle, refreshMs]);

	// Refresh immediately when the tab becomes visible again.
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
		if (id !== tab) {
			setData(null); setTab(id);
			try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
		}
		setMenuOpen(false);
	};

	let view;
	const vp = { data, guest, act, status, tick };
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
	const ed2kText = ed2k.state === 'connected'
		? (ed2k.server || 'Connected') + (ed2k.lowid ? ' · LowID' : '')
		: ed2k.state === 'connecting' ? 'Connecting…' : 'Not connected';
	const activeLabel = (TABS.find((t) => t[0] === tab) || ['', ''])[1];

	return html`
	<div class="app">
		<header class="topbar">
			<button class="btn icon menubtn" title="Menu" onClick=${() => setMenuOpen((o) => !o)}><${Icon} name="menu"/></button>
			<div class="brand"><img src="logo.png" alt="aMule" /><span>aMule</span></div>
			<nav class=${'tabs' + (menuOpen ? ' open' : '')}>
				${TABS.map(([id, label]) => html`<button class=${'tab' + (tab === id ? ' active' : '')} onClick=${() => go(id)}>${label}</button>`)}
			</nav>
			<div class="grow current">${activeLabel}</div>
			<select class="refresh" title="Auto-refresh" value=${String(refreshMs)} onChange=${(e) => setRefreshMs(+e.target.value)}>
				${REFRESH_OPTS.map(([v, l]) => html`<option value=${v}>${l === 'off' ? 'sync: off' : '↻ ' + l}</option>`)}
			</select>
			<a class="btn-link" href="login.php" title="Log out">Exit</a>
		</header>

		<main onClick=${() => menuOpen && setMenuOpen(false)}>
			${connErr ? html`<div class="view"><div class="banner">⚠ Cannot reach aMule. Is amuleweb running? Retrying…</div></div>` : ''}
			${guest ? html`<div class="view"><div class="banner">You are logged in as guest — commands are disabled.</div></div>` : ''}
			${view}
		</main>

		<footer class="statusbar">
			<span><span class=${'dot ' + ed2kDot}></span><b>ed2k</b> <span class="hide-sm">${ed2kText}</span></span>
			<span><span class=${'dot ' + (kad.connected ? 'on' : 'off')}></span><b>Kad</b> <span class="hide-sm">${kad.connected ? (kad.firewalled ? 'Firewalled' : 'Connected') : 'Disconnected'}</span></span>
			<span class="grow"></span>
			<span class="rate dn"><${Icon} name="arrowdn"/> ${fmtSpeed(status && status.speed_down)}</span>
			<span class="rate up"><${Icon} name="arrowup"/> ${fmtSpeed(status && status.speed_up)}</span>
			${status && status.version ? html`<span class="faint hide-sm">v${status.version}</span>` : ''}
		</footer>

		<div class="toast-wrap">
			${toasts.map((t) => html`<div key=${t.id} class=${'toast' + (t.err ? ' err' : '')}>${t.msg}</div>`)}
		</div>
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
