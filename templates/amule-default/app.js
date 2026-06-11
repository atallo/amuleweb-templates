/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "amule-default": aMule's classic stock web template, faithfully
 * reproduced as a single-page app on top of the shared JSON layer (api.php).
 * Markup, texts and number formats are transcribed from the original
 * server-rendered pages; only the transport changed.
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

// Asset base: resolves template images both deployed (flat, at the server
// root) and in the dev mock preview (/templates/amule-default/).
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
/* Formatting helpers (texts match the original templates)              */
/* ==================================================================== */

const r2 = (n) => {
	const s = (Math.round(n * 100) / 100).toFixed(2);
	return s.replace(/\.?0+$/, '') || '0';
};
// Per-page byte formats, transcribed from each original page's CastToXBytes.
function fmtB(size, style) {
	size = Number(size) || 0;
	const u = style === 'shared'
		? [' bytes', 'KB', 'MB', 'GB']
		: style === 'search' ? [' b', 'kb', 'mb', 'gb'] : [' b', ' kb', ' mb', ' gb'];
	if (size < 1024) return size + u[0];
	if (size < 1048576) return r2(size / 1024) + u[1];
	if (size < 1073741824) return r2(size / 1048576) + u[2];
	return r2(size / 1073741824) + u[3];
}
const pct2 = (done, size) => (size > 0 ? r2((Number(done) * 100) / Number(size)) : '0');

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
function sourcesText(f) {
	let s = '';
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + ' / ';
	s += f.src_count + ' ( ' + f.src_count_xfer + ' ) ';
	if (f.src_count_a4af != 0) s += '+ ' + f.src_count_a4af;
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
const SortA = ({ label, k, sort }) => html`<a href="#" onClick=${(e) => { e.preventDefault(); sort.by(k); }}>${label}</a>`;

// The classic framed box: rounded-corner images around a white area.
function Box({ caption, children }) {
	return html`
	<table class="boxframe" width="100%" border="0" cellspacing="0" cellpadding="0">
		${caption ? html`<caption>${caption}</caption>` : ''}
		<tr>
			<td width="24"><img src=${A + 'tab_top_left.png'} width="24" height="24" /></td>
			<td background=${A + 'tab_top.png'}>${' '}</td>
			<td width="24"><img src=${A + 'tab_top_right.png'} width="24" height="24" /></td>
		</tr>
		<tr>
			<td width="24" background=${A + 'tab_left.png'}>${' '}</td>
			<td bgcolor="#FFFFFF"><div class="tw">${children}</div></td>
			<td width="24" background=${A + 'tab_right.png'}>${' '}</td>
		</tr>
		<tr>
			<td width="24"><img src=${A + 'tab_bottom_left.png'} width="24" height="24" /></td>
			<td background=${A + 'tab_bottom.png'}>${' '}</td>
			<td width="24"><img src=${A + 'tab_bottom_right.png'} width="24" height="24" /></td>
		</tr>
	</table>`;
}

const HSEP = (n) => html`<tr><td colspan=${n} height="1" bgcolor="#000000"></td></tr>`;
const RSEP = (n) => html`<tr><td colspan=${n} height="1" bgcolor="#c0c0c0"></td></tr>`;

// Name cell: this interpreter/locale combo can deliver an empty name for
// exotic cases; keep the row usable by showing the hash.
const NameTd = ({ name, hash, cls }) => (name
	? html`<td class=${'texte ' + (cls || '')} height="22" title=${name}>${name}</td>`
	: html`<td class=${'texte ' + (cls || '')} height="22" title=${hash || ''} style="color:#908c8c">(unnamed)${hash ? ' · ' + hash.slice(0, 10) + '…' : ''}</td>`);

// Per-download chunk bar, rendered by amuleweb (dyn_<hash>.png) like the
// stock template; plain bar fallback for mock mode / no-libpng builds.
function Progress({ hash, done, size }) {
	const [ok, setOk] = useState(true);
	if (ok && !MOCK) {
		return html`<img class="pimg" alt="Progress bar" src=${'dyn_' + hash + '.png?v=' + done} onError=${() => setOk(false)} />`;
	}
	return html`<span class="pfall" title=${pct2(done, size) + '%'}><i style=${'width:' + pct2(done, size) + '%'}></i></span>`;
}

/* ==================================================================== */
/* Header / footer (replace the original frames)                        */
/* ==================================================================== */

function Hdr({ go }) {
	const nav = [
		['download', 'nav-transf', 'transfert'],
		['shared', 'nav-shared', 'shared'],
		['search', 'nav-search', 'search'],
		['servers', 'nav-edkserv', 'edkserver'],
		['kad', 'nav-sheserv', 'sheserv'],
		['stats', 'nav-stats', 'statistiques'],
	];
	return html`
	<div class="hdr">
		<img class="logo" src=${A + 'logo.png'} alt="aMule" />
		<div class="band">
			<div class="nav">
				${nav.map(([id, cls, alt]) => html`<a key=${id} class=${'navbtn ' + cls} title=${alt}
					href=${'#' + id} onClick=${(e) => { e.preventDefault(); go(id); }}></a>`)}
			</div>
			<img class="colsep" src=${A + 'col.png'} alt="" />
			<div class="hdrlinks texteinv">
				<a href="login.php">exit</a><br />
				<a href="#log" onClick=${(e) => { e.preventDefault(); go('log'); }}>log ${'•'}</a>${' '}
				<a href="#prefs" onClick=${(e) => { e.preventDefault(); go('prefs'); }}>configuration</a>
			</div>
		</div>
	</div>`;
}

function Footer({ status, guard }) {
	const [link, setLink] = useState('');
	const [cat, setCat] = useState(0);
	const cats = (status && status.categories) || [];
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
	else ed2kTxt = 'Connected with ' + (ed2k.lowid ? 'low' : 'high') + ' ID to ' + ed2k.server + '  ' + ed2k.addr;
	const kadTxt = kad.connected ? (kad.firewalled ? 'Connected(Firewalled)' : 'Connected(OK)') : 'Disconnected';

	return html`
	<div class="footerbar">
		<div>
			<form name="formlink" onSubmit=${submit}>
				<input name="ed2klink" type="text" size="50" placeholder="ed2k://"
					value=${link} onInput=${(e) => setLink(e.target.value)} />
				${' '}
				<select value=${cat} onChange=${(e) => setCat(+e.target.value)}>
					${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
				</select>
				${' '}
				<input type="submit" value="Download link" />
			</form>
		</div>
		<div>
			<strong>Ed2k : </strong>${ed2kTxt}
			${'  '}
			<strong>Kad :</strong> ${kadTxt}
		</div>
	</div>`;
}

/* ==================================================================== */
/* DOWNLOAD / UPLOAD                                                    */
/* ==================================================================== */

function DownloadView({ data, status, guard, refresh }) {
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
		name: (f) => (f.name || '').toLowerCase(),
		size: (f) => Number(f.size),
		size_done: (f) => Number(f.size_done),
		speed: (f) => Number(f.speed),
		progress: (f) => Number(f.size_done) / Math.max(1, Number(f.size)),
		srccount: (f) => Number(f.src_count),
		status: (f) => statusString(f),
		prio: (f) => Number(f.prio),
	});

	const tot = downloads.reduce((a, f) => ({
		size: a.size + Number(f.size), done: a.done + Number(f.size_done), speed: a.speed + Number(f.speed),
	}), { size: 0, done: 0, speed: 0 });
	const utot = uploads.reduce((a, f) => ({
		up: a.up + Number(f.xfer_up), dn: a.dn + Number(f.xfer_down), speed: a.speed + Number(f.xfer_speed),
	}), { up: 0, dn: 0, speed: 0 });

	const cmd = (c) => {
		if (!guard()) return;
		if (c === 'cancel' && !confirm('Delete selected files ?')) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') sel.clear();
	};
	const tb = (name, img, c) => html`<td><a class="tbtn" href="#" title=${name}
		onClick=${(e) => { e.preventDefault(); cmd(c); }}><img src=${A + img} alt=${name} /></a></td>`;

	return html`
	<div>
		<table width="100%" border="0" cellpadding="0" cellspacing="0">
			<tr><td align="center">
				<table border="0" cellpadding="0" cellspacing="0" class="toolrow"><tr>
					${tb('pause', 'pause.png', 'pause')}
					${tb('resume', 'play.png', 'resume')}
					${tb('prioup', 'up.png', 'prioup')}
					${tb('priodown', 'down.png', 'priodown')}
					${tb('cancel', 'close.png', 'cancel')}
					<td>
						${' '}
						<select value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
							${['all', 'Waiting', 'Paused', 'Downloading'].map((s) => html`<option key=${s}>${s}</option>`)}
						</select>
						<select value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
							<option>all</option>
							${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c}>${c}</option>`)}
						</select>
					</td>
					<td><a class="tbtn" href="#" title="Apply"
						onClick=${(e) => { e.preventDefault(); setAStatus(fStatus); setACat(fCat); }}><img src=${A + 'filter.png'} alt="Apply" /></a></td>
					<td>${(status && status.guest) ? html`<span class="guestmsg">${' '}You logged in as guest - commands are disabled</span>` : ''}</td>
				</tr></table>
			</td></tr>
		</table>
		<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td height="10"></td></tr></table>
		<${Box} caption="DOWNLOAD">
			<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
				<tr>
					<th>${' '}</th>
					<th><${SortA} label="File name" k="name" sort=${sort} /></th>
					<th><${SortA} label="Size" k="size" sort=${sort} /></th>
					<th><${SortA} label="Completed" k="size_done" sort=${sort} /></th>
					<th><${SortA} label="Download speed" k="speed" sort=${sort} /></th>
					<th><${SortA} label="Progress" k="progress" sort=${sort} /></th>
					<th><${SortA} label="Sources" k="srccount" sort=${sort} /></th>
					<th><${SortA} label="Status" k="status" sort=${sort} /></th>
					<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
				</tr>
				${HSEP(9)}
				${rows.map((f) => html`
					<tr key=${f.hash}>
						<td class="texte" height="22"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
						<${NameTd} name=${f.name} hash=${f.hash} cls="texte-full-name" />
						<td class="texte" height="22" align="center">${fmtB(f.size, 'dl')}</td>
						<td class="texte" height="22" align="center">${fmtB(f.size_done, 'dl')}${' '}(${pct2(f.size_done, f.size)}%)</td>
						<td class="texte" height="22" align="center">${f.speed > 0 ? fmtB(f.speed, 'dl') + '/s' : '-'}</td>
						<td class="texte" height="22" align="center"><${Progress} hash=${f.hash} done=${f.size_done} size=${f.size} /></td>
						<td class="texte" height="22" align="center">${sourcesText(f)}</td>
						<td class="texte" height="22" align="center">${statusString(f)}</td>
						<td class="texte" height="22" align="center">${prioString(f)}</td>
					</tr>
					${RSEP(9)}`)}
				${downloads.length ? html`<tr>
					<td class="totrow"></td>
					<td class="totrow" height="22" style="text-align:right;padding-right:20px">Total</td>
					<td class="totrow" height="22" align="center">${fmtB(tot.size, 'dl')}</td>
					<td class="totrow" height="22" align="center">${fmtB(tot.done, 'dl')}${' '}(${pct2(tot.done, tot.size)}%)</td>
					<td class="totrow" height="22" align="center">${tot.speed > 0 ? fmtB(tot.speed, 'dl') + '/s' : ''}</td>
					<td class="totrow"></td><td class="totrow"></td><td class="totrow"></td><td class="totrow"></td>
				</tr>` : ''}
			</table>
		<//>
		<${Box} caption="UPLOAD">
			<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
				<tr>
					<td>${' '}</td>
					<th>File Name</th>
					<th>Username</th>
					<th>Up</th>
					<th>Down</th>
					<th>${' '}</th>
					<th>${' '}</th>
					<th>Speed</th>
					<td>${' '}</td>
				</tr>
				${HSEP(9)}
				${uploads.map((f, i) => html`
					<tr key=${i}>
						<td class="texte" height="22" align="center"></td>
						<${NameTd} name=${f.name} cls="texte-full-name texte-full-name-upload" />
						<td class="texte" height="22" align="center">${f.user_name}</td>
						<td class="texte" height="22" align="center">${fmtB(f.xfer_up, 'dl')}</td>
						<td class="texte" height="22" align="center">${fmtB(f.xfer_down, 'dl')}</td>
						<td class="texte" height="22" align="center"></td>
						<td class="texte" height="22" align="center"></td>
						<td class="texte" height="22" align="center">${f.xfer_speed > 0 ? fmtB(f.xfer_speed, 'dl') + '/s' : '-'}</td>
						<td class="texte" height="22" align="center"></td>
					</tr>
					${RSEP(9)}`)}
				${uploads.length ? html`<tr>
					<td class="totrow"></td><td class="totrow"></td>
					<td class="totrow" height="22" style="text-align:right;padding-right:20px">Total</td>
					<td class="totrow" height="22" align="center">${fmtB(utot.up, 'dl')}</td>
					<td class="totrow" height="22" align="center">${fmtB(utot.dn, 'dl')}</td>
					<td class="totrow"></td><td class="totrow"></td>
					<td class="totrow" height="22" align="center">${fmtB(utot.speed, 'dl')}/s</td>
					<td class="totrow"></td>
				</tr>` : ''}
			</table>
		<//>
	</div>`;
}

/* ==================================================================== */
/* SHARED FILES                                                         */
/* ==================================================================== */

function SharedView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [prio, setPrio] = useState('Select prio');
	const shared = (data && data.shared) || [];
	const rows = sort.sort(shared, {
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
	const setp = () => {
		const map = { Low: 0, Normal: 1, High: 2 };
		if (map[prio] === undefined) return;
		run('setprio', map[prio]);
	};
	return html`
	<div>
		<table border="0" align="center" cellpadding="0" cellspacing="0" class="toolrow"><tr>
			<td><a class="tbtn" href="#" title="Reload shared files" onClick=${(e) => { e.preventDefault(); run('reload'); }}><img src=${A + 'refresh.png'} alt="Reload" /></a></td>
			<td><a class="tbtn" href="#" title="Priority up" onClick=${(e) => { e.preventDefault(); run('prioup'); }}><img src=${A + 'up.png'} alt="Up" /></a></td>
			<td><a class="tbtn" href="#" title="Priority down" onClick=${(e) => { e.preventDefault(); run('priodown'); }}><img src=${A + 'down.png'} alt="Down" /></a></td>
			<td><select value=${prio} onChange=${(e) => setPrio(e.target.value)}>
				${['Select prio', 'Low', 'Normal', 'High'].map((o) => html`<option key=${o}>${o}</option>`)}
			</select>${' '}</td>
			<td><a class="tbtn" href="#" title="Set priority" onClick=${(e) => { e.preventDefault(); setp(); }}><img src=${A + 'ok.png'} alt="Set" /></a></td>
			<td>${(status && status.guest) ? html`<span class="guestmsg">${' '}You logged in as guest - commands are disabled</span>` : ''}</td>
		</tr></table>
		<${Box} caption="SHARED FILES">
			<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
				<tr>
					<th></th>
					<th><${SortA} label="File Name" k="name" sort=${sort} /></th>
					<th><${SortA} label="Transferred" k="xfer" sort=${sort} /> (<${SortA} label="Total" k="xfer_all" sort=${sort} />)</th>
					<th><${SortA} label="Requested" k="req" sort=${sort} /> (<${SortA} label="Total" k="req_all" sort=${sort} />)</th>
					<th><${SortA} label="Accepted requests" k="acc" sort=${sort} /> (<${SortA} label="Total" k="acc_all" sort=${sort} />)</th>
					<th><${SortA} label="Size" k="size" sort=${sort} /></th>
					<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
				</tr>
				${HSEP(9)}
				${rows.map((f) => html`
					<tr key=${f.hash}>
						<td class="texte"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
						<${NameTd} name=${f.name} hash=${f.hash} cls="texte-full-name" />
						<td class="texte" align="center">${fmtB(f.xfer, 'shared')} (${fmtB(f.xfer_all, 'shared')})</td>
						<td class="texte" align="center">${f.req} (${f.req_all})</td>
						<td class="texte" align="center">${f.accept} (${f.accept_all})</td>
						<td class="texte" align="center">${fmtB(f.size, 'shared')}</td>
						<td class="texte" align="center">${prioString(f)}</td>
					</tr>
					${RSEP(9)}`)}
			</table>
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
	const unitSel = (v, set) => html`<select value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u}>${u}</option>`)}
	</select>`;

	return html`
	<${Box} caption="SEARCH">
		<form onSubmit=${doSearch}>
			<table width="100%" border="0" align="center" cellpadding="4" cellspacing="0">
				<tr align="center">
					<td align="center">
						<input type="text" size="60" value=${q} onInput=${(e) => setQ(e.target.value)} />
						${' '}
						<input type="submit" value="Search" />
					</td>
					<td align="right">Availability :</td>
					<td align="left"><input type="text" size="6" value=${avail} onInput=${(e) => setAvail(e.target.value)} /></td>
					<td align="left">Min Size : </td>
					<td align="left">
						<input type="text" size="5" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
						${' '}${unitSel(minU, setMinU)}
					</td>
				</tr>
				<tr>
					<td align="center"><a href="#" onClick=${(e) => { e.preventDefault(); refresh(); }}>Click here to update the search results</a></td>
					<td align="right">Search type :</td>
					<td><select value=${stype} onChange=${(e) => setStype(e.target.value)}>
						${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t}>${t}</option>`)}
					</select></td>
					<td>Max Size : </td>
					<td>
						<input type="text" size="5" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
						${' '}${unitSel(maxU, setMaxU)}
					</td>
				</tr>
			</table>
		</form>
		<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
			<tr>
				<th>${' '}</th>
				<th><${SortA} label="File Name" k="name" sort=${sort} /></th>
				<th><${SortA} label="Size" k="size" sort=${sort} /></th>
				<th><${SortA} label="Sources" k="sources" sort=${sort} /></th>
			</tr>
			${HSEP(9)}
			${rows.map((f) => html`
				<tr key=${f.hash}>
					<td class="texte"><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
					<${NameTd} name=${f.name} hash=${f.hash} cls="texte-full-name" />
					<td class="texte" align="center">${fmtB(f.size, 'search')}</td>
					<td class="texte" align="center">${f.sources}</td>
				</tr>
				${RSEP(9)}`)}
			<tr align="right">
				<td colspan="4">
					<input type="submit" value="Download" onClick=${download} />
					${' '}
					<select value=${tcat} onChange=${(e) => setTcat(+e.target.value)}>
						${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
					</select>
				</td>
			</tr>
		</table>
	<//>`;
}

/* ==================================================================== */
/* SERVERS                                                              */
/* ==================================================================== */

function ServersView({ data, status, guard, refresh }) {
	const sort = useSort('', 1);
	const servers = (data && data.servers) || [];
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(), desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users), files: (s) => Number(s.files),
	});
	const guest = !!(status && status.guest);
	const srvCmd = (cmd, s) => {
		if (!guard()) return;
		apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {});
	};
	const disconnect = (e) => {
		e.preventDefault();
		if (!guard()) return;
		apiPost('server_disconnect', {}).then(refresh).catch(() => {});
	};
	return html`
	<${Box} caption="SERVERS">
		<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
			${!guest ? html`<tr><td colspan="6" align="right" style="padding:4px 8px">
				<button type="button" onClick=${disconnect}>Disconnect from current ed2k server</button>
			</td></tr>` : ''}
			<tr>
				<th width="3%"></th>
				<th width="22%"><${SortA} label="Server Name" k="name" sort=${sort} /></th>
				<th width="42%"><${SortA} label="Description" k="desc" sort=${sort} /></th>
				<th width="19%">Address</th>
				<th width="7%"><${SortA} label="Users" k="users" sort=${sort} /></th>
				<th width="7%"><${SortA} label="Files" k="files" sort=${sort} /></th>
			</tr>
			${HSEP(8)}
			${rows.map((s) => html`
				<tr key=${s.ip + ':' + s.port}>
					<td class="texte" align="center">
						${guest ? '' : html`
							<a href="#" title="Connect" onClick=${(e) => { e.preventDefault(); srvCmd('connect', s); }}><img src=${A + 'connect.gif'} width="16" height="16" border="0" /></a>
							<a href="#" title="Remove" onClick=${(e) => { e.preventDefault(); srvCmd('remove', s); }}><img src=${A + 'cancel.gif'} width="16" height="16" border="0" /></a>`}
					</td>
					<td class="texte">${s.name}</td>
					<td class="texte">${s.desc}</td>
					<td class="texte" align="center">${s.addr}</td>
					<td class="texte" align="center">${s.users}</td>
					<td class="texte" align="center">${s.files}</td>
				</tr>
				${RSEP(9)}`)}
		</table>
	<//>`;
}

/* ==================================================================== */
/* KADEMLIA                                                             */
/* ==================================================================== */

function KadView({ guard, refresh, tick }) {
	const [ip, setIp] = useState(['', '', '', '']);
	const [port, setPort] = useState('');
	const [url, setUrl] = useState('');
	const [gready, setGready] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const act = (action, extra) => {
		if (!guard()) return;
		apiPost('kad', Object.assign({ action }, extra || {})).then(refresh).catch(() => {});
	};
	const connectIp = () => {
		// the template's field order is ip3.ip2.ip1.ip0 (low octet first)
		act('connect_ip', { ip0: ip[3], ip1: ip[2], ip2: ip[1], ip3: ip[0], port });
	};
	const ipIn = (i) => html`<input type="text" size="3" maxlength="3" value=${ip[i]}
		onInput=${(e) => setIp((p) => { const n = p.slice(); n[i] = e.target.value; return n; })} />`;
	return html`
	<${Box} caption="KADEMLIA">
		<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
			<tr valign="top" class="kadcols">
				<td height="200" width="500">
					${gready && !MOCK
						? html`<img class="statimg" src=${'amule_stats_kad.png?v=' + tick} border="0" alt="" />`
						: html`<div style="width:500px;height:200px;background:#fff"></div>`}
				</td>
				<td valign="top">
					<table border="0" align="center" cellpadding="0" cellspacing="6">
						<tr><th colspan="2">Network</th></tr>
						<tr><td colspan="2" align="center">
							<button type="button" onClick=${() => act('connect_known')}>Connect from known peers</button>
							${' '}
							<button type="button" onClick=${() => act('disconnect')}>Disconnect</button>
						</td></tr>
						<tr><th colspan="2">Bootstrap from node</th></tr>
						<tr>
							<td align="right">IP :</td>
							<td align="left">${ipIn(0)} ${' '} ${ipIn(1)} ${' '} ${ipIn(2)} ${' '} ${ipIn(3)}</td>
						</tr>
						<tr>
							<td align="right">Port :</td>
							<td align="left">
								<input type="text" size="4" maxlength="5" value=${port} onInput=${(e) => setPort(e.target.value)} />
								${' '}
								<button type="button" onClick=${connectIp}>Connect</button>
							</td>
						</tr>
						<tr><th colspan="2">Update bootstrap from URL</th></tr>
						<tr>
							<td align="right">URL :</td>
							<td align="left">
								<input type="text" size="32" value=${url} onInput=${(e) => setUrl(e.target.value)} />
								${' '}
								<button type="button" onClick=${() => { if (url.trim()) act('update_url', { url: url.trim() }); }}>Update</button>
							</td>
						</tr>
					</table>
				</td>
			</tr>
			<tr valign="top">
				<td height="20" width="500" align="center">Number of nodes</td>
				<td></td>
			</tr>
		</table>
	<//>`;
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
			<img src=${A + (open ? 'tree-open.gif' : 'tree-closed.gif')} border="0" alt="" />
			${name}
		</span>
		${open ? html`<span class="branch">
			${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}
		</span>` : ''}
	</div>`;
}

function StatsView({ tick }) {
	const [tree, setTree] = useState(null);
	const [gready, setGready] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		apiGet('statstree').then((d) => { if (alive) setTree(d || null); }).catch(() => {});
		return () => { alive = false; };
	}, [tick]);
	const graphs = [
		['amule_stats_download.png', 'Download-Speed'],
		['amule_stats_upload.png', 'Upload-Speed'],
		['amule_stats_conncount.png', 'Connections'],
	];
	return html`
	<${Box} caption="STATISTICS">
		<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
			<tr valign="top" class="kadcols">
				<td class="tree-wrap" style="padding:4px">
					${tree
						? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)
						: html`<span class="texte">Loading…</span>`}
				</td>
				<td width="500" align="right">
					${graphs.map(([src, label]) => html`
						<div key=${src}>
							${gready && !MOCK
								? html`<img class="statimg" src=${src + '?v=' + tick} border="0" alt="" />`
								: html`<div style="width:500px;height:200px;background:#fff"></div>`}
							<div align="center" class="texte" style="height:20px">${label}</div>
						</div>`)}
				</td>
			</tr>
		</table>
	<//>`;
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
	if (!form) return html`<${Box} caption="PREFERENCES"><span class="texte">Loading…</span><//>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const txt = (k, size) => html`<input type="text" size=${size || 4} disabled=${guest}
		value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />`;
	const chk = (k) => html`<input type="checkbox" disabled=${guest}
		checked=${form[k] === '1' || form[k] === 1} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />`;
	const apply = () => {
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(load).catch(() => {});
	};
	const row = (label, field) => html`<tr>
		<td width="22" height="25">${' '}</td><td height="25">${label}</td><td width="63" height="25">${field}</td>
	</tr>`;
	const crow = (box, label) => html`<tr>
		<td width="22" height="25">${box}</td><td height="25"> ${label}</td><td width="63" height="25">${' '}</td>
	</tr>`;
	const sub = (title, children) => html`
		<table width="350" border="0" align="center" cellpadding="0" cellspacing="0">
			<tr><td width="22">${' '}</td><th>${title}</th><td width="63">${' '}</td></tr>
			${children}
		</table>`;

	return html`
	<${Box} caption="PREFERENCES">
		<table border="0" align="center" cellpadding="0" cellspacing="6">
			<tr align="center" valign="top">
				<td>
					${sub('General', row('Nickname', txt('nick', 20)))}
					${sub('Webserver', [
						row('Page refresh interval ', txt('autorefresh_time')),
						crow(chk('use_gzip'), 'Use gzip compression '),
					])}
				</td>
				<td width="50%">
					${sub('Line capacity (for statistics only)', [
						row('Max download rate ', txt('max_line_down_cap')),
						row('Max upload rate ', txt('max_line_up_cap')),
					])}
				</td>
			</tr>
			<tr align="center" valign="top">
				<td>
					${sub('Bandwidth limits', [
						row('Max download rate ', txt('max_down_limit')),
						row('Max upload rate ', txt('max_up_limit')),
						row('Slot allocation ', txt('slot_alloc')),
					])}
				</td>
				<td width="50%" rowspan="3">
					${sub('File settings', [
						crow(chk('check_free_space'), html`Check free space => Minimum free space (Mb) ${txt('min_free_space')}`),
						crow(chk('new_files_auto_dl_prio'), 'Added download files have auto priority'),
						crow(chk('new_files_auto_ul_prio'), 'New shared files have auto priority'),
						crow(chk('ich_en'), 'I.C.H. active'),
						crow(chk('aich_trust'), 'AICH trusts every hash (not recommended)'),
						crow(chk('alloc_full_chunks'), 'Alloc full chunks of .part files'),
						crow(chk('alloc_full'), 'Alloc full disk space for .part files'),
						crow(chk('new_files_paused'), 'Add files to download queue in pause mode'),
						crow(chk('extract_metadata'), 'Extract metadata tags '),
					])}
				</td>
			</tr>
			<tr align="center" valign="top">
				<td>
					${sub('Connection settings', [
						row('Max total connections (total) ', txt('max_conn_total')),
						row('Max sources per file ', txt('max_file_src')),
						crow(chk('autoconn_en'), 'Autoconnect at startup '),
						crow(chk('reconn_en'), 'Reconnect when connection lost '),
						crow(chk('network_ed2k'), 'Enable ED2K network '),
						crow(chk('network_kad'), 'Enable Kademlia network '),
					])}
				</td>
			</tr>
			<tr align="center" valign="top">
				<td>
					${sub('Network settings', [
						row('TCP port ', txt('tcp_port')),
						row('UDP port ', txt('udp_port')),
						crow(chk('udp_dis'), 'Disable UDP connections '),
					])}
				</td>
			</tr>
			<tr align="center">
				<td colspan="2">
					${guest
						? html`<b>${' '}You can not change options - logged in as guest</b>`
						: html`<input type="submit" value="Apply" onClick=${apply} />`}
				</td>
			</tr>
		</table>
	<//>`;
}

/* ==================================================================== */
/* AMULE LOG                                                            */
/* ==================================================================== */

function LogView() {
	const [log, setLog] = useState('');
	const [srv, setSrv] = useState('');
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<${Box} caption="AMULE LOG">
		<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">
			<tr valign="top"><td>
				<h1 style="display:inline">aMule log</h1>
				${' '}
				<a href="#" onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to reset aMule log?')) loadLog(1); }}>(Reset log)</a><br />
				<pre class="logpre">${log || ' '}</pre>
			</td></tr>
			<tr><td>
				<h1 style="display:inline">Serverinfo</h1>
				${' '}
				<a href="#" onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to reset Serverinfo?')) loadSrv(1); }}>(Reset Serverinfo)</a>
				<pre class="logpre small">${srv || ' '}</pre>
			</td></tr>
		</table>
	<//>`;
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
		} catch (e) { /* keep last data; footer will catch up */ }
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

	// Original behaviour: guests get an alert when trying to run a command.
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
	<div class="page">
		<${Hdr} go=${go} />
		<main class="content">${body}</main>
		<${Footer} status=${status} guard=${guard} />
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
