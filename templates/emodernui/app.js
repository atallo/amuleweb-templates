/*
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "emodernui": Vincenzo Petronio's eMuleModernUI, a responsive
 * Bootstrap 3 (Bootswatch "Flatly") template designed for *eMule*'s web
 * server, ported to aMule on top of the shared JSON layer (api.php).
 * Layouts are transcribed from the upstream HTML prototypes; eMule-only
 * placeholders are mapped to their aMule equivalents (see the README for
 * the exact substitutions). jQuery and bootstrap.js are not needed --
 * the navbar, dropdown, tabs, modal and popovers are app-driven.
 * Origin: https://github.com/vincenzo-petronio/eMuleModernUI
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
/* Formatting helpers                                                   */
/* ==================================================================== */

const r2 = (n) => {
	const s = (Math.round(n * 100) / 100).toFixed(2);
	return s.replace(/\.?0+$/, '') || '0';
};
function fmtB(size) {
	size = Number(size) || 0;
	if (size < 1024) return size + ' B';
	if (size < 1048576) return r2(size / 1024) + ' KB';
	if (size < 1073741824) return r2(size / 1048576) + ' MB';
	return r2(size / 1073741824) + ' GB';
}
const speedKB = (n) => r2((Number(n) || 0) / 1024) + ' kB/s';
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
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + '/';
	s += f.src_count + ' (' + f.src_count_xfer + ')';
	if (f.src_count_a4af != 0) s += ' + ' + f.src_count_a4af;
	return s;
}

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
const Gi = ({ name }) => html`<span class=${'glyphicon glyphicon-' + name} aria-hidden="true"></span>`;
const SortA = ({ label, k, sort }) => html`<a href="#"
	onClick=${(e) => { e.preventDefault(); sort.by(k); }}><b>${label}</b></a>`;

const Panel = ({ title, children }) => html`
	<div class="row">
		<div class="panel panel-default">
			<div class="panel-heading"><h3 class="panel-title">${title}</h3></div>
			<div class="panel-body">${children}</div>
		</div>
	</div>`;

// Bootstrap-3 style popover menu, app-driven (the upstream prototypes used
// jQuery popovers for the per-row menus).
function PopMenu({ label, items }) {
	const [open, setOpen] = useState(false);
	return html`
	<span class="popmenu-wrap">
		<a href="#" onClick=${(e) => { e.preventDefault(); setOpen((o) => !o); }}>${label}</a>
		${open ? html`<span class="popover bottom in popmenu" role="tooltip">
			<span class="arrow"></span>
			<span class="popover-content">
				${items.map(([txt, fn]) => html`<a key=${txt} class="popmenu-item" href="#"
					onClick=${(e) => { e.preventDefault(); setOpen(false); fn(); }}>${txt}</a>`)}
			</span>
		</span>` : ''}
	</span>`;
}

/* ==================================================================== */
/* Navbar + status rows (from main_site.html)                           */
/* ==================================================================== */

const NAV = [
	['kad', 'cloud', 'Kad'],
	['server', 'hdd', 'Server'],
	['transfer', 'transfer', 'Transfer'],
	['search', 'search', 'Search'],
	['shared', 'folder-open', 'Shared'],
	['stats', 'stats', 'Stats'],
	['graphs', 'signal', 'Graphs'],
	['prefs', 'cog', 'Options'],
];

function Navbar({ view, go, openEd2k }) {
	const [open, setOpen] = useState(false);
	const [drop, setDrop] = useState(false);
	const nav = (id) => (e) => { e.preventDefault(); setOpen(false); setDrop(false); go(id); };
	return html`
	<nav class="navbar navbar-default navbar-static-top" role="navigation">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle" onClick=${() => setOpen((o) => !o)}>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<a class="navbar-brand" href="#transfer" onClick=${nav('transfer')}>Web Control</a>
			</div>
			<div class=${'collapse navbar-collapse' + (open ? ' in' : '')} id="navbar-collapse-custom">
				<ul class="nav navbar-nav">
					${NAV.map(([id, icon, label]) => html`
					<li key=${id} class=${view === id ? 'active' : ''}>
						<a href=${'#' + id} onClick=${nav(id)}><${Gi} name=${icon} /><br />${label}</a>
					</li>`)}
					<li class=${'dropdown' + (drop ? ' open' : '')}>
						<a href="#" class="dropdown-toggle" onClick=${(e) => { e.preventDefault(); setDrop((d) => !d); }}>
							Web Options <b class="caret"></b>
						</a>
						<ul class="dropdown-menu">
							<li><a href="#" onClick=${(e) => { e.preventDefault(); setDrop(false); setOpen(false); openEd2k(); }}><${Gi} name="link" /> eD2k link</a></li>
							<li class="divider"></li>
							<li><a href="#log" onClick=${nav('log')}><${Gi} name="list-alt" /> Log</a></li>
							<li><a href="#sinfo" onClick=${nav('sinfo')}><${Gi} name="list-alt" /> ServerInfo</a></li>
							<li><a href="https://www.amule.org" target="_blank" rel="noopener"><${Gi} name="home" /> aMule Homepage</a></li>
							<li class="divider"></li>
							<li><a href="login.php"><${Gi} name="log-out" /> Logout</a></li>
						</ul>
					</li>
				</ul>
			</div>
		</div>
	</nav>`;
}

function StatusRows({ status }) {
	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };
	const s = status || {};
	const cur = (v, lim) => speedKB(v) + (Number(lim) > 0 ? ' (' + speedKB(lim) + ')' : '');
	let conTxt;
	if (ed2k.state === 'connecting') conTxt = 'Connecting...';
	else if (ed2k.state !== 'connected') conTxt = 'Not connected';
	else conTxt = 'Connected with ' + (ed2k.lowid ? 'Low' : 'High') + ' ID to ' + ed2k.server + ' ' + ed2k.addr;
	const kadTxt = 'Kad: ' + (kad.connected ? (kad.firewalled ? 'connected (firewalled)' : 'connected (ok)') : 'disconnected');
	return html`
	<div class="container statusrows">
		<div class="row">
			<div class="col-md-1"><p>Connection</p></div>
			<div class="col-md-11">
				<div class="row">
					<div class="col-md-6"><${Gi} name=${ed2k.state === 'connected' ? 'ok-sign' : 'remove-sign'} /> <label>${conTxt}</label></div>
					<div class="col-md-6"><${Gi} name="cloud" /> <label>${kadTxt}</label></div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-1"><p>QuickStats</p></div>
			<div class="col-md-11">
				<div class="row">
					<div class="col-md-3"><${Gi} name="arrow-down" /> <label>Down: ${cur(s.speed_down, s.speed_limit_down)}</label></div>
					<div class="col-md-3"><${Gi} name="arrow-up" /> <label>Up: ${cur(s.speed_up, s.speed_limit_up)}</label></div>
				</div>
			</div>
		</div>
	</div>`;
}

// eD2k link modal (the upstream navbar's [Ed2klink] entry).
function Ed2kModal({ status, guard, close }) {
	const [text, setText] = useState('');
	const [cat, setCat] = useState(0);
	const cats = (status && status.categories) || [];
	const start = (e) => {
		e.preventDefault();
		if (!guard()) return;
		const links = text.split(/\s+/).map((s) => s.trim()).filter((s) => s.indexOf('ed2k://') === 0);
		links.forEach((l) => apiPost('ed2k', { link: l, cat }).catch(() => {}));
		setText('');
		close();
	};
	return html`
	<div>
		<div class="modal fade in" style="display:block" role="dialog">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" onClick=${close}>${'×'}</button>
						<h4 class="modal-title">eD2k link</h4>
					</div>
					<div class="modal-body">
						<form onSubmit=${start}>
							<div class="form-group">
								<textarea rows="4" class="form-control" style="resize: vertical" autofocus
									placeholder="ed2k://|file|...|/" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
							</div>
							<input type="submit" class="btn btn-default" value="Start" />
							${' '}
							<select class="form-control cat-inline" value=${cat} onChange=${(e) => setCat(+e.target.value)}>
								${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
							</select>
						</form>
					</div>
				</div>
			</div>
		</div>
		<div class="modal-backdrop fade in" onClick=${close}></div>
	</div>`;
}

/* ==================================================================== */
/* TRANSFER (transfer.html)                                             */
/* ==================================================================== */

function TransferView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const cats = (status && status.categories) || [];
	const downloads = (data && data.downloads) || [];
	const uploads = (data && data.uploads) || [];
	const rows = sort.sort(downloads, {
		name: (f) => (f.name || '').toLowerCase(),
		size: (f) => Number(f.size),
		size_done: (f) => Number(f.size_done),
		speed: (f) => Number(f.speed),
		progress: (f) => Number(f.size_done) / Math.max(1, Number(f.size)),
		srccount: (f) => Number(f.src_count),
		prio: (f) => prioSort(f),
		cat: (f) => Number(f.category),
	});
	const tot = downloads.reduce((a, f) => ({
		size: a.size + Number(f.size), done: a.done + Number(f.size_done), speed: a.speed + Number(f.speed),
	}), { size: 0, done: 0, speed: 0 });

	const cmd = (c) => {
		if (!guard()) return;
		if (c === 'cancel' && !confirm('Cancel the selected downloads?')) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') sel.clear();
	};
	const tbtn = (title, icon, c) => html`
		<button type="button" class="btn btn-default btn-xs" title=${title} onClick=${() => cmd(c)}><${Gi} name=${icon} /></button>`;

	return html`
	<div class="container">
		<div class="row top-buffer">
			<div class="col-sm-12">
				<div class="table-responsive">
					<table class="table table-hover table-bordered">
						<thead>
							<tr>
								<th colspan="9">
									<${Gi} name="arrow-down" /> Download list
									${' '}
									<span class="btn-group">
										${tbtn('Pause', 'pause', 'pause')}
										${tbtn('Resume', 'play', 'resume')}
										${tbtn('Priority up', 'arrow-up', 'prioup')}
										${tbtn('Priority down', 'arrow-down', 'priodown')}
										${tbtn('Cancel', 'remove', 'cancel')}
									</span>
								</th>
							</tr>
							<tr>
								<th></th>
								<th><${SortA} label="File name" k="name" sort=${sort} /></th>
								<th><${SortA} label="Size" k="size" sort=${sort} /></th>
								<th><${SortA} label="Transferred" k="size_done" sort=${sort} /></th>
								<th><${SortA} label="Progress" k="progress" sort=${sort} /></th>
								<th><${SortA} label="Speed" k="speed" sort=${sort} /></th>
								<th><${SortA} label="Sources" k="srccount" sort=${sort} /></th>
								<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
								<th><${SortA} label="Category" k="cat" sort=${sort} /></th>
							</tr>
							<tr class="totals">
								<th><b>Total</b></th>
								<th>${downloads.length} files</th>
								<th><b>${fmtB(tot.size)}</b></th>
								<th><b>${fmtB(tot.done)}</b></th>
								<th></th>
								<th><b>${speedKB(tot.speed)}</b></th>
								<th></th><th></th><th></th>
							</tr>
						</thead>
						<tbody>
							${rows.map((f) => html`
							<tr key=${f.hash}>
								<td><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
								<td class="namecell" title=${(f.name || '') + ' Hash: ' + f.hash}>${f.name || '(unnamed) ' + f.hash}</td>
								<td>${fmtB(f.size)}</td>
								<td>${fmtB(f.size_done)}</td>
								<td class="progcell">
									<div class="progress">
										<div class=${'progress-bar' + (statusString(f) === 'Paused' ? ' progress-bar-warning' : '')}
											style=${'width:' + pct2(f.size_done, f.size) + '%'}>${pct2(f.size_done, f.size)}%</div>
									</div>
								</td>
								<td>${f.speed > 0 ? speedKB(f.speed) : '-'}</td>
								<td>${sourcesText(f)}</td>
								<td>${prioString(f)}</td>
								<td>${cats[f.category] || ''}</td>
							</tr>`)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<div class="row top-buffer">
			<div class="col-sm-12">
				<div class="table-responsive">
					<table class="table table-hover table-bordered">
						<thead>
							<tr><th colspan="5"><${Gi} name="arrow-up" /> Upload list</th></tr>
							<tr><th>File name</th><th>User</th><th>Up</th><th>Down</th><th>Speed</th></tr>
						</thead>
						<tbody>
							${uploads.map((f, i) => html`
							<tr key=${i}>
								<td class="namecell">${f.name}</td>
								<td>${f.user_name}</td>
								<td>${fmtB(f.xfer_up)}</td>
								<td>${fmtB(f.xfer_down)}</td>
								<td>${f.xfer_speed > 0 ? speedKB(f.xfer_speed) : '-'}</td>
							</tr>`)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SERVER (server.html)                                                 */
/* ==================================================================== */

function ServerView({ data, status, guard, refresh }) {
	const sort = useSort('', 1);
	const [tab, setTab] = useState(0);
	const [addr, setAddr] = useState('');
	const [port, setPort] = useState('');
	const [name, setName] = useState('');
	const [msg, setMsg] = useState('');
	const servers = (data && data.servers) || [];
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(), addr: (s) => (s.addr || ''),
		desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users), files: (s) => Number(s.files),
	});
	const srvCmd = (cmd, s) => {
		if (!guard()) return;
		apiPost('server_cmd', { cmd, ip: s.ip, port: s.port })
			.then(() => { setMsg(cmd === 'connect' ? 'Connecting to ' + s.name + '...' : 'Removed ' + s.name); refresh(); })
			.catch(() => {});
	};
	const disconnect = () => {
		if (!guard()) return;
		apiPost('server_disconnect', {}).then(() => { setMsg('Disconnected.'); refresh(); }).catch(() => {});
	};
	const add = (e) => {
		e.preventDefault();
		if (!guard() || !addr.trim() || !port.trim()) return;
		apiPost('server_add', { addr: addr.trim(), port: port.trim(), name: name.trim() })
			.then(() => { setMsg('Server added.'); setAddr(''); setPort(''); setName(''); refresh(); })
			.catch(() => {});
	};
	const tabA = (i, icon, label) => html`
		<li class=${tab === i ? 'active' : ''}>
			<a href="#server" onClick=${(e) => { e.preventDefault(); setTab(i); }}><${Gi} name=${icon} /> ${label}</a>
		</li>`;

	return html`
	<div class="container">
		<div class="row">
			<div class="col-sm-12">
				<ul class="nav nav-tabs">
					${tabA(0, 'flash', 'Server options')}
					${tabA(1, 'plus', 'Add server')}
				</ul>
				<div class="tab-content">
					${tab === 0 ? html`
					<div class="tab-pane active">
						<form role="form" style="padding:15px" onSubmit=${(e) => e.preventDefault()}>
							<p>
								<button type="button" class="btn btn-default" onClick=${disconnect}>Disconnect</button>
							</p>
						</form>
					</div>` : html`
					<div class="tab-pane active">
						<form role="form" style="padding:15px" class="col-sm-4" onSubmit=${add}>
							<div class="form-group">
								<input type="text" class="form-control" placeholder="IP" value=${addr} onInput=${(e) => setAddr(e.target.value)} />
							</div>
							<div class="form-group">
								<input type="text" class="form-control" placeholder="Port" value=${port} onInput=${(e) => setPort(e.target.value)} />
							</div>
							<div class="form-group">
								<input type="text" class="form-control" placeholder="Name" value=${name} onInput=${(e) => setName(e.target.value)} />
							</div>
							<div><button type="submit" class="btn btn-default">Add</button></div>
						</form>
					</div>`}
				</div>
			</div>
		</div>
		${msg ? html`<div class="alert alert-info">${msg}</div>` : ''}
		<div class="row top-buffer">
			<div class="col-sm-12">
				<div class="table-responsive">
					<table class="table table-hover table-bordered">
						<thead>
							<tr><th colspan="5"><${Gi} name="hdd" /> Server list</th></tr>
							<tr>
								<th><${SortA} label="Server name" k="name" sort=${sort} /></th>
								<th><${SortA} label="Address" k="addr" sort=${sort} /></th>
								<th><${SortA} label="Description" k="desc" sort=${sort} /></th>
								<th><${SortA} label="Users" k="users" sort=${sort} /></th>
								<th><${SortA} label="Files" k="files" sort=${sort} /></th>
							</tr>
						</thead>
						<tbody>
							${rows.map((s) => html`
							<tr key=${s.ip + ':' + s.port}>
								<td><${PopMenu} label=${s.name} items=${[
									['Connect', () => srvCmd('connect', s)],
									['Remove', () => srvCmd('remove', s)],
								]} /></td>
								<td>${s.addr}</td>
								<td>${s.desc}</td>
								<td>${s.users}</td>
								<td>${s.files}</td>
							</tr>`)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SEARCH (search.html)                                                 */
/* ==================================================================== */

function SearchView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [q, setQ] = useState('');
	const [minV, setMinV] = useState('');
	const [maxV, setMaxV] = useState('');
	const [avail, setAvail] = useState('');
	const [method, setMethod] = useState('kademlia');
	const results = (data && data.results) || [];
	const rows = sort.sort(results, {
		name: (f) => (f.name || '').toLowerCase(), size: (f) => Number(f.size),
		hash: (f) => f.hash || '', sources: (f) => Number(f.sources),
	});
	const doSearch = (e) => {
		e.preventDefault();
		if (!guard() || !q.trim()) return;
		const types = { server: 0, global: 1, kademlia: 2 };
		apiPost('search_start', {
			keyword: q.trim(), type: types[method] || 0, avail: avail || 0,
			minsize: minV ? Math.round(Number(minV) * 1048576) : 0,
			maxsize: maxV ? Math.round(Number(maxV) * 1048576) : 0,
		}).then(refresh).catch(() => {});
	};
	const download = (e) => {
		e.preventDefault();
		if (!guard()) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('search_download', { hashes: list.join(','), cat: 0 }).then(refresh).catch(() => {});
		sel.clear();
	};
	const radio = (val, label) => html`
		<label>
			${label}
			${' '}<input type="radio" name="method" value=${val} checked=${method === val}
				onChange=${() => setMethod(val)} />
		</label><br />`;

	return html`
	<div class="container">
		<div class="row">
			<div class="col-sm-4 col-sm-offset-4">
				<form role="form" onSubmit=${doSearch}>
					<div class="form-group">
						<input type="text" class="form-control" placeholder="Name" value=${q} onInput=${(e) => setQ(e.target.value)} />
					</div>
					<div class="form-group">
						<input type="text" class="form-control" placeholder="Min size (MB)" value=${minV} onInput=${(e) => setMinV(e.target.value)} />
					</div>
					<div class="form-group">
						<input type="text" class="form-control" placeholder="Max size (MB)" value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
					</div>
					<div class="form-group">
						<input type="text" class="form-control" placeholder="Availability" value=${avail} onInput=${(e) => setAvail(e.target.value)} />
					</div>
					<div class="form-group">
						<p>Method</p>
						${radio('kademlia', 'Use Kademlia')}
						${radio('global', 'Global (all servers)')}
						${radio('server', 'Connected server')}
					</div>
					<div><button type="submit" class="btn btn-default">Search</button></div>
				</form>
			</div>
		</div>
		<div class="row top-buffer">
			<div class="col-sm-12">
				<form role="form" onSubmit=${download}>
					<div class="table-responsive">
						<table class="table table-hover table-bordered">
							<thead>
								<tr>
									<th colspan="5">
										<${Gi} name="search" /> Result
										${' '}<a href="#search" onClick=${(e) => { e.preventDefault(); refresh(); }}>(update)</a>
									</th>
								</tr>
								<tr>
									<th><${SortA} label="File name" k="name" sort=${sort} /></th>
									<th><${SortA} label="Size" k="size" sort=${sort} /></th>
									<th><${SortA} label="Hash" k="hash" sort=${sort} /></th>
									<th><${SortA} label="Sources" k="sources" sort=${sort} /></th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								${rows.map((f) => html`
								<tr key=${f.hash}>
									<td class="namecell">${f.name}</td>
									<td>${fmtB(f.size)}</td>
									<td class="hashcell">${f.hash}</td>
									<td>${f.sources}</td>
									<td><input type="checkbox" checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} /></td>
								</tr>`)}
							</tbody>
						</table>
					</div>
					<button type="submit" class="btn btn-default">Download</button>
				</form>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SHARED (sharedfiles.html)                                            */
/* ==================================================================== */

function SharedView({ data, guard, refresh }) {
	const sort = useSort('', 1);
	const shared = (data && data.shared) || [];
	const rows = sort.sort(shared, {
		name: (f) => (f.name || '').toLowerCase(),
		xfer: (f) => Number(f.xfer), req: (f) => Number(f.req), acc: (f) => Number(f.accept),
		size: (f) => Number(f.size), prio: (f) => prioSort(f),
	});
	const setPrio = (f, p) => {
		if (!guard()) return;
		apiPost('shared_cmd', { cmd: 'setprio', hashes: f.hash, prio: p }).then(refresh).catch(() => {});
	};
	const reload = () => {
		if (!guard()) return;
		apiPost('shared_cmd', { cmd: 'reload' }).then(refresh).catch(() => {});
	};
	return html`
	<div class="container">
		<div class="row top-buffer">
			<div class="col-sm-12">
				<div class="table-responsive">
					<table class="table table-hover table-bordered">
						<thead>
							<tr><th colspan="6"><${Gi} name="folder-open" /> Shared list</th></tr>
							<tr>
								<th><${SortA} label="File name" k="name" sort=${sort} /></th>
								<th><${SortA} label="Transferred" k="xfer" sort=${sort} /></th>
								<th><${SortA} label="Requests" k="req" sort=${sort} /></th>
								<th><${SortA} label="Accepts" k="acc" sort=${sort} /></th>
								<th><${SortA} label="Size" k="size" sort=${sort} /></th>
								<th><${SortA} label="Priority" k="prio" sort=${sort} /></th>
							</tr>
						</thead>
						<tbody>
							${rows.map((f) => html`
							<tr key=${f.hash}>
								<td class="namecell" title=${(f.name || '') + ' Hash: ' + f.hash}>${f.name}</td>
								<td>${fmtB(f.xfer)} (${fmtB(f.xfer_all)})</td>
								<td>${f.req} (${f.req_all})</td>
								<td>${f.accept} (${f.accept_all})</td>
								<td>${fmtB(f.size)}</td>
								<td><${PopMenu} label=${prioString(f)} items=${[
									['Low', () => setPrio(f, 0)],
									['Normal', () => setPrio(f, 1)],
									['High', () => setPrio(f, 2)],
								]} /></td>
							</tr>`)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<div>
			<form onSubmit=${(e) => { e.preventDefault(); reload(); }}>
				<input type="submit" class="btn btn-default" value="Reload" />
			</form>
		</div>
	</div>`;
}

/* ==================================================================== */
/* KAD (kad.html)                                                       */
/* ==================================================================== */

function KadView({ status, guard, refresh, tick }) {
	const [ipTxt, setIpTxt] = useState('');
	const [port, setPort] = useState('');
	const [gready, setGready] = useState(false);
	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const act = (action, extra) => {
		if (!guard()) return;
		apiPost('kad', Object.assign({ action }, extra || {})).then(refresh).catch(() => {});
	};
	const bootstrap = (e) => {
		e.preventDefault();
		const m = ipTxt.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (!m || !port.trim()) return;
		// the stock form posts octets low-to-high (ip0 is the last one)
		act('connect_ip', { ip0: m[4], ip1: m[3], ip2: m[2], ip3: m[1], port });
	};
	return html`
	<div class="container">
		<${Panel} title="Kad">
			<div class="col-xs-4">${ed2k.state === 'connected' ? 'eD2k: connected' : 'eD2k: not connected'}</div>
			<div class="col-xs-4">${kad.connected ? (kad.firewalled ? 'Kad: firewalled' : 'Kad: connected') : 'Kad: disconnected'}</div>
			<div class="col-lg-4">
				<button type="button" class="btn btn-default btn-sm" onClick=${() => act('connect_known')}>Connect (known nodes)</button>
				${' '}
				<button type="button" class="btn btn-default btn-sm" onClick=${() => act('disconnect')}>Disconnect</button>
			</div>
		<//>
		<${Panel} title="Bootstrap">
			<form method="get" role="form" class="col-xs-6" onSubmit=${bootstrap}>
				<div class="form-group">
					<label for="ip">IP</label>
					<input type="text" id="ip" class="form-control" placeholder="123.45.67.89"
						value=${ipTxt} onInput=${(e) => setIpTxt(e.target.value)} />
					<label for="port">Port</label>
					<input type="text" id="port" class="form-control" placeholder="4672"
						value=${port} onInput=${(e) => setPort(e.target.value)} />
				</div>
				<button type="submit" class="btn btn-default">Bootstrap</button>
			</form>
		<//>
		<${Panel} title="Kad statistics">
			<div class="col-xs-12">
				${gready && !MOCK
					? html`<img src=${'amule_stats_kad.png?v=' + tick} class="img-responsive" alt="Kad nodes" />`
					: html`<div class="graphbox"></div>`}
				<p>Number of nodes</p>
			</div>
		<//>
	</div>`;
}

/* ==================================================================== */
/* STATS tree + GRAPHS (statistics.html + the Graphs nav entry)         */
/* ==================================================================== */

function TreeNode({ name, node }) {
	const [open, setOpen] = useState(true);
	if (node === null || node === undefined) {
		return html`<li class="tree-item">${name}</li>`;
	}
	return html`
	<li>
		<a href="#" class="tree-toggle" onClick=${(e) => { e.preventDefault(); setOpen((o) => !o); }}>
			<${Gi} name=${open ? 'minus-sign' : 'plus-sign'} /> ${name}
		</a>
		${open ? html`<ul class="list-unstyled tree-branch">
			${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}
		</ul>` : ''}
	</li>`;
}

function StatsView({ tick }) {
	const [tree, setTree] = useState(null);
	useEffect(() => {
		let alive = true;
		apiGet('statstree').then((d) => { if (alive) setTree(d || null); }).catch(() => {});
		return () => { alive = false; };
	}, [tick]);
	return html`
	<div class="container">
		<div class="row top-buffer">
			<div class="col-sm-12">
				<ul class="list-unstyled stats-tree">
					${tree
						? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)
						: html`<li>Loading…</li>`}
				</ul>
			</div>
		</div>
	</div>`;
}

function GraphsView({ tick }) {
	const [gready, setGready] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const graphs = [
		['amule_stats_download.png', 'Download speed'],
		['amule_stats_upload.png', 'Upload speed'],
		['amule_stats_conncount.png', 'Connections'],
	];
	return html`
	<div class="container">
		${graphs.map(([src, label]) => html`
		<${Panel} key=${src} title=${label}>
			<div class="col-xs-12">
				${gready && !MOCK
					? html`<img src=${src + '?v=' + tick} class="img-responsive" alt=${label} />`
					: html`<div class="graphbox"></div>`}
			</div>
		<//>`)}
	</div>`;
}

/* ==================================================================== */
/* OPTIONS (preferences.html)                                           */
/* ==================================================================== */

function PrefsView({ status, guard }) {
	const [form, setForm] = useState(null);
	const guest = !!(status && status.guest);
	const load = useCallback(() => apiGet('options').then((o) => {
		const f = Object.assign({}, o); delete f.categories; setForm(f);
	}).catch(() => {}), []);
	useEffect(() => { load(); }, [load]);
	if (!form) return html`<div class="container"><p class="top-buffer">Loading…</p></div>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const apply = (e) => {
		e.preventDefault();
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(load).catch(() => {});
	};
	const num = (k, label, suffix) => html`
		<p>${label}: <input type="text" class="form-control" disabled=${guest}
			value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} /> ${suffix || ''}</p>`;

	return html`
	<div class="container">
		<form role="form" onSubmit=${apply}>
			<${Panel} title="Web Control">
				<div class="col-xs-6">
					<label>Gzip compression</label>
					<p>Save bandwidth ${' '}<input type="checkbox" disabled=${guest}
						checked=${form.use_gzip === '1' || form.use_gzip === 1}
						onChange=${(e) => set('use_gzip', e.target.checked ? '1' : '0')} /></p>
				</div>
				<div class="col-xs-6">
					<label>Refresh time</label>
					${num('autorefresh_time', 'Page refresh interval (s)')}
				</div>
			<//>
			<${Panel} title="aMule">
				<div class="col-xs-4">
					<label>Line capacities</label>
					${num('max_line_down_cap', 'Download capacity', 'kB/s')}
					${num('max_line_up_cap', 'Upload capacity', 'kB/s')}
				</div>
				<div class="col-xs-4">
					<label>Speed limits</label>
					${num('max_down_limit', 'Max download', 'kB/s')}
					${num('max_up_limit', 'Max upload', 'kB/s')}
				</div>
				<div class="col-xs-4">
					<label>Limits</label>
					${num('max_file_src', 'Max sources per file')}
					${num('max_conn_total', 'Max connections')}
				</div>
			<//>
			<div class="row">
				${guest
					? html`<p><strong>You are logged in as guest - options are read-only.</strong></p>`
					: html`<button type="submit" class="btn btn-default">Apply</button>`}
			</div>
		</form>
	</div>`;
}

/* ==================================================================== */
/* LOG / SERVERINFO (the Web Options dropdown entries)                  */
/* ==================================================================== */

function TextView({ route, title }) {
	const [txt, setTxt] = useState('');
	const load = useCallback((reset) => apiText(route, reset ? { reset: 1 } : {}).then(setTxt).catch(() => {}), [route]);
	useEffect(() => { load(); }, [load]);
	return html`
	<div class="container">
		<div class="top-buffer">
			<${Panel} title=${html`${title} ${' '}<a href="#" class="reset-link"
				onClick=${(e) => { e.preventDefault(); if (confirm('Reset ' + title + '?')) load(1); }}>(reset)</a>`}>
				<pre class="logpre">${txt || ' '}</pre>
			<//>
		</div>
	</div>`;
}

/* ==================================================================== */
/* Shell                                                                */
/* ==================================================================== */

const VIEWS = ['kad', 'server', 'transfer', 'search', 'shared', 'stats', 'graphs', 'prefs', 'log', 'sinfo'];
const VIEW_ROUTE = { transfer: 'transfers', shared: 'shared', server: 'servers', search: 'search' };
const REFRESH_MS = 5000;

const initialView = () => {
	const h = location.hash.replace('#', '');
	return VIEWS.indexOf(h) >= 0 ? h : 'transfer';
};

function App() {
	const [view, setView] = useState(initialView);
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [tick, setTick] = useState(0);
	const [ed2kOpen, setEd2kOpen] = useState(false);
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

	const vp = { data, status, guard, refresh, tick };
	let body;
	if (view === 'transfer') body = html`<${TransferView} ...${vp} />`;
	else if (view === 'server') body = html`<${ServerView} ...${vp} />`;
	else if (view === 'search') body = html`<${SearchView} ...${vp} />`;
	else if (view === 'shared') body = html`<${SharedView} ...${vp} />`;
	else if (view === 'kad') body = html`<${KadView} ...${vp} />`;
	else if (view === 'stats') body = html`<${StatsView} tick=${tick} />`;
	else if (view === 'graphs') body = html`<${GraphsView} tick=${tick} />`;
	else if (view === 'prefs') body = html`<${PrefsView} status=${status} guard=${guard} />`;
	else if (view === 'log') body = html`<${TextView} route="log" title="Log" />`;
	else if (view === 'sinfo') body = html`<${TextView} route="serverinfo" title="ServerInfo" />`;

	return html`
	<div>
		<${Navbar} view=${view} go=${go} openEd2k=${() => setEd2kOpen(true)} />
		<${StatusRows} status=${status} />
		<main role="main">${body}</main>
		${ed2kOpen ? html`<${Ed2kModal} status=${status} guard=${guard} close=${() => setEd2kOpen(false)} />` : ''}
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
