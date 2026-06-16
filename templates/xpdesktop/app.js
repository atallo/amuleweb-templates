/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "xpdesktop": the aMule desktop application, recreated in the
 * browser as faithfully as possible to how it looks running on Windows XP
 * (Luna theme), on top of the shared JSON layer (api.php). The toolbar,
 * views, lists, status bar and the Preferences dialog mirror the desktop
 * client; the window chrome is XP Luna. An original design (the aMule GUI
 * belongs to the aMule project), not a migration of an existing template.
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

const A = new URL('.', import.meta.url).pathname;

/* ==================================================================== */
/* API client (serialized -- amuleweb is single-threaded)               */
/* ==================================================================== */

const MOCK = (typeof window !== 'undefined' && window.AMULE_MOCK) || null;
let _chain = Promise.resolve();
const serialize = (fn) => { const p = _chain.then(fn, fn); _chain = p.then(() => {}, () => {}); return p; };
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
	const res = await fetch('api.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
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

const r1 = (n) => { const s = (Math.round(n * 10) / 10).toFixed(1); return s.replace(/\.0$/, ''); };
function fmtB(size) {
	size = Number(size) || 0;
	if (size < 1024) return size + ' bytes';
	if (size < 1048576) return r1(size / 1024) + ' KB';
	if (size < 1073741824) return r1(size / 1048576) + ' MB';
	return r1(size / 1073741824) + ' GB';
}
const fmtSpeed = (n) => (Number(n) > 0 ? r1(Number(n) / 1024) + ' kB/s' : '0.0');
const pct = (done, size) => (size > 0 ? Math.min(100, (Number(done) * 100) / Number(size)) : 0);
const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very High', 4: 'Very Low', 5: 'Auto', 6: 'Release' };
function prioStr(f) { let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio); if (f.prio_auto == 1) s += ' [Auto]'; return s; }
function statusStr(f) { if (f.status === 7) return 'Paused'; return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting'; }
const UNITS = { Bytes: 1, KB: 1024, MB: 1048576, GB: 1073741824 };

/* ==================================================================== */
/* aMule toolbar icons (SVG, evoking the desktop client's icon set)     */
/* ==================================================================== */

const ICONS = {
	disconnect: `<svg viewBox="0 0 32 32"><defs><radialGradient id="xr" cx="35%" cy="30%"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#c00"/></radialGradient></defs><circle cx="16" cy="16" r="13" fill="url(#xr)" stroke="#900" stroke-width="1.5"/><path d="M10 10l12 12M22 10L10 22" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>`,
	networks: `<svg viewBox="0 0 32 32"><defs><radialGradient id="gg" cx="35%" cy="30%"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#1769c4"/></radialGradient></defs><circle cx="16" cy="16" r="13" fill="url(#gg)" stroke="#0c4a8a" stroke-width="1.2"/><g fill="none" stroke="#0c4a8a" stroke-width="1.1"><ellipse cx="16" cy="16" rx="6" ry="13"/><ellipse cx="16" cy="16" rx="13" ry="6"/><line x1="3" y1="16" x2="29" y2="16"/><line x1="16" y1="3" x2="16" y2="29"/></g></svg>`,
	searches: `<svg viewBox="0 0 32 32"><circle cx="13" cy="13" r="8.5" fill="#dff0ff" stroke="#1769c4" stroke-width="2.2"/><circle cx="13" cy="13" r="5" fill="#a9d6ff" opacity=".6"/><path d="M19 19l8 8" stroke="#0c4a8a" stroke-width="3.5" stroke-linecap="round"/></svg>`,
	downloads: `<svg viewBox="0 0 32 32"><g fill="none" stroke="#ff8a00" stroke-width="4" stroke-linecap="round"><path d="M7 13a10 10 0 0 1 17-4"/><path d="M25 19a10 10 0 0 1-17 4"/></g><path d="M24 4l1 7-7-1z" fill="#ff8a00"/><path d="M8 28l-1-7 7 1z" fill="#ff8a00"/></svg>`,
	shared: `<svg viewBox="0 0 32 32"><path d="M16 5l11 5-11 5L5 10z" fill="#7fb8ec" stroke="#0c4a8a" stroke-width="1"/><path d="M5 10v12l11 5V15z" fill="#4f93d6" stroke="#0c4a8a" stroke-width="1"/><path d="M27 10v12l-11 5V15z" fill="#3877b8" stroke="#0c4a8a" stroke-width="1"/></svg>`,
	messages: `<svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="6" fill="#9aa6b2" stroke="#5b6670" stroke-width="1"/><path d="M5 28c1-7 6-10 11-10s10 3 11 10z" fill="#9aa6b2" stroke="#5b6670" stroke-width="1"/></svg>`,
	statistics: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#eaf4ff" stroke="#1769c4" stroke-width="1.5"/><path d="M16 16L8 9" stroke="#c00" stroke-width="2.4" stroke-linecap="round"/><g stroke="#1769c4" stroke-width="1.4"><line x1="16" y1="4" x2="16" y2="7"/><line x1="28" y1="16" x2="25" y2="16"/><line x1="6" y1="9" x2="8" y2="11"/></g><circle cx="16" cy="16" r="2" fill="#0c4a8a"/></svg>`,
	preferences: `<svg viewBox="0 0 32 32"><path d="M6 24l9-9" stroke="#b9bdc4" stroke-width="4.5" stroke-linecap="round"/><path d="M4 6l5 5 3-3-5-5z" fill="#c9a44a" stroke="#7a5e1e" stroke-width="1"/><path d="M22 5l5 5-9 9-5-5z" fill="#d9534f" stroke="#7a1e1e" stroke-width="1"/><circle cx="9" cy="23" r="2.5" fill="#fff" stroke="#888"/></svg>`,
	import: `<svg viewBox="0 0 32 32"><path d="M6 8h10l6 6-6 6H6l6-6z" fill="#d9534f" stroke="#7a1e1e" stroke-width="1"/><path d="M14 14h14" stroke="#1769c4" stroke-width="3" stroke-linecap="round"/><path d="M24 9l5 5-5 5" fill="none" stroke="#1769c4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	about: `<svg viewBox="0 0 32 32"><defs><radialGradient id="ab" cx="35%" cy="30%"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#1769c4"/></radialGradient></defs><circle cx="16" cy="16" r="13" fill="url(#ab)" stroke="#0c4a8a" stroke-width="1.2"/><text x="16" y="23" font-family="Georgia,serif" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">?</text></svg>`,
	commit: `<svg viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" fill="none" stroke="#2a7d2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	reload: `<svg viewBox="0 0 16 16"><g fill="none" stroke="#2a7d2a" stroke-width="2" stroke-linecap="round"><path d="M3 7a5 5 0 0 1 9-2"/><path d="M13 9a5 5 0 0 1-9 2"/></g><path d="M12 2v3h-3z" fill="#2a7d2a"/><path d="M4 14v-3h3z" fill="#2a7d2a"/></svg>`,
	greendown: `<svg viewBox="0 0 16 16"><path d="M3 5h10l-5 7z" fill="#2a9d2a" stroke="#176617" stroke-width="1"/></svg>`,
};
const Icon = ({ name }) => html`<span class="ic" dangerouslySetInnerHTML=${{ __html: ICONS[name] || '' }}></span>`;

/* ==================================================================== */
/* Window chrome                                                        */
/* ==================================================================== */

const TOOLBAR = [
	['disconnect', 'Disconnect'],
	['networks', 'Networks'],
	['searches', 'Searches'],
	['downloads', 'Downloads'],
	['shared', 'Shared files'],
	['messages', 'Messages'],
	['statistics', 'Statistics'],
	['preferences', 'Preferences'],
	['import', 'Import'],
	['about', 'About'],
];

function TitleBar() {
	return html`
	<div class="xp-title">
		<div class="xp-title-left">
			<img class="xp-title-icon" src=${A + 'logo.png'} alt="" />
			<span class="xp-title-text">aMule</span>
		</div>
		<div class="xp-caption">
			<button class="xp-cap min" title="Minimize"><span></span></button>
			<button class="xp-cap max" title="Maximize"><span></span></button>
			<button class="xp-cap close" title="Close">✕</button>
		</div>
	</div>`;
}

function Toolbar({ view, onPick }) {
	return html`
	<div class="xp-toolbar">
		${TOOLBAR.map(([id, label]) => html`
		<button key=${id} class=${'tbtn' + (view === id ? ' active' : '')} title=${label}
			onClick=${() => onPick(id)}>
			<${Icon} name=${id} />
			<span class="tlabel">${label}</span>
		</button>`)}
	</div>`;
}

function StatusBar({ status, now }) {
	const ed2k = (status && status.ed2k) || { state: 'disconnected' };
	const kad = (status && status.kad) || { connected: false };
	const sp = status || {};
	const ed2kTxt = ed2k.state === 'connected'
		? 'eD2k: ' + (ed2k.server || 'Connected')
		: ed2k.state === 'connecting' ? 'eD2k: Connecting' : 'eD2k: Not connected';
	const kadTxt = 'Kad: ' + (kad.connected ? (kad.firewalled ? 'Firewalled' : 'Connected') : 'Off');
	const users = ed2k.users != null ? ed2k.users : 0;
	return html`
	<div class="xp-status">
		<div class="sp info"><img class="spico" src=${A + 'logo.png'} /> ${now}</div>
		<div class="sp">Users: E: ${esShort(users)}</div>
		<div class="sp">${'↑'} Up: ${fmtSpeed(sp.speed_up)} | ${'↓'} Down: ${fmtSpeed(sp.speed_down)}</div>
		<div class="sp grow">${ed2kTxt} | ${kadTxt}</div>
	</div>`;
}
const esShort = (n) => { n = Number(n) || 0; if (n >= 1e6) return r1(n / 1e6) + 'M'; if (n >= 1e3) return Math.round(n / 1e3) + 'k'; return String(n); };

function Footer({ status, guard }) {
	const [link, setLink] = useState('');
	const cats = (status && status.categories) || [];
	const [cat, setCat] = useState(0);
	const submit = () => { if (!guard() || !link.trim()) return; apiPost('ed2k', { link: link.trim(), cat }).catch(() => {}); setLink(''); };
	return html`
	<div class="xp-footer">
		<span class="lbl">eD2k Link:</span>
		<input class="xp-input" type="text" value=${link} onInput=${(e) => setLink(e.target.value)}
			onKeyDown=${(e) => { if (e.key === 'Enter') submit(); }} />
		<button class="xp-btn" onClick=${submit}>Commit</button>
	</div>`;
}

/* ==================================================================== */
/* Generic list-view (XP listctrl look)                                 */
/* ==================================================================== */

function ListView({ columns, children }) {
	return html`
	<div class="lv">
		<div class="lv-head">
			${columns.map((c, i) => html`<div key=${i} class="lv-col" style=${'width:' + (c.w || 100) + 'px' + (c.grow ? ';flex:1 1 auto' : '')}>${c.label}</div>`)}
		</div>
		<div class="lv-body">${children}</div>
	</div>`;
}

/* ==================================================================== */
/* DOWNLOADS                                                            */
/* ==================================================================== */

function DownloadsView({ data, status, guard, refresh }) {
	const [sel, setSel] = useState(() => new Set());
	const downloads = (data && data.downloads) || [];
	const cats = (status && status.categories) || [];
	const toggle = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const cmd = (c) => {
		if (!guard()) return;
		const list = Array.from(sel);
		if (c === 'cancel' && list.length && !confirm('Delete the selected file(s)?')) return;
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') setSel(new Set());
	};
	const ctx = (f) => (e) => {
		e.preventDefault();
		if (!sel.has(f.hash)) setSel(new Set([f.hash]));
	};
	const cols = [
		{ label: 'Part', w: 36 }, { label: 'File Name', w: 240, grow: true }, { label: 'Size', w: 70 },
		{ label: 'Transferred', w: 80 }, { label: 'Completed', w: 70 }, { label: 'Speed', w: 60 },
		{ label: 'Progress', w: 150 }, { label: 'Sources', w: 60 }, { label: 'Priority', w: 70 },
	];
	return html`
	<div class="view-fill">
		<div class="dl-tabs">
			<div class="dl-tab"><${Icon} name="commit" /> Downloads</div>
			<div class="dl-cat active">all (${downloads.length}/${downloads.length})</div>
		</div>
		<${ListView} columns=${cols}>
			${downloads.length === 0 ? html`<div class="lv-empty"></div>` : downloads.map((f) => html`
			<div key=${f.hash} class=${'lv-row' + (sel.has(f.hash) ? ' sel' : '')}
				onClick=${() => toggle(f.hash)} onContextMenu=${ctx(f)}>
				<div class="lv-cell" style="width:36px;text-align:center">${f.status === 7 ? '❚❚' : ''}</div>
				<div class="lv-cell" style="width:240px;flex:1 1 auto" title=${f.name}>${f.name || '?'}</div>
				<div class="lv-cell" style="width:70px">${fmtB(f.size)}</div>
				<div class="lv-cell" style="width:80px">${fmtB(f.size_xfer || f.size_done)}</div>
				<div class="lv-cell" style="width:70px">${fmtB(f.size_done)}</div>
				<div class="lv-cell" style="width:60px">${f.speed > 0 ? fmtSpeed(f.speed) : ''}</div>
				<div class="lv-cell" style="width:150px"><${Progress} f=${f} /></div>
				<div class="lv-cell" style="width:60px;text-align:center">${f.src_count} (${f.src_count_xfer})</div>
				<div class="lv-cell" style="width:70px">${prioStr(f)}</div>
			</div>`)}
		<//>
		<div class="dl-bottom">
			<button class="xp-iconbtn" title="Toolbar"><${Icon} name="greendown" /></button>
			<div class="dl-actions">
				${(status && status.guest) ? html`<span class="guest">Guest mode — commands disabled</span>` : html`
				<button class="xp-btn sm" onClick=${() => cmd('resume')}>Resume</button>
				<button class="xp-btn sm" onClick=${() => cmd('pause')}>Pause</button>
				<button class="xp-btn sm" onClick=${() => cmd('prioup')}>Prio +</button>
				<button class="xp-btn sm" onClick=${() => cmd('priodown')}>Prio −</button>
				<button class="xp-btn sm" onClick=${() => cmd('cancel')}>Cancel</button>`}
			</div>
			<div class="dl-sources">File sources: ${downloads.reduce((a, f) => a + (f.src_count || 0), 0)}</div>
		</div>
	</div>`;
}

function Progress({ f }) {
	const [ok, setOk] = useState(true);
	const p = pct(f.size_done, f.size);
	if (ok && !MOCK) {
		return html`<img class="pbar" alt="" src=${'dyn_' + f.hash + '.png?v=' + f.size_done} onError=${() => setOk(false)} />`;
	}
	return html`<span class="pbar fb"><i style=${'width:' + p + '%'}></i></span>`;
}

/* ==================================================================== */
/* NETWORKS (ED2K servers + Kad)                                        */
/* ==================================================================== */

function NetworksView({ data, status, guard, refresh, tick }) {
	const [tab, setTab] = useState('ed2k');
	return html`
	<div class="view-fill">
		<div class="xp-tabs">
			<button class=${'xp-tab' + (tab === 'ed2k' ? ' active' : '')} onClick=${() => setTab('ed2k')}>ED2K</button>
			<button class=${'xp-tab' + (tab === 'kad' ? ' active' : '')} onClick=${() => setTab('kad')}>Kad</button>
		</div>
		${tab === 'ed2k'
			? html`<${ServersView} data=${data} status=${status} guard=${guard} refresh=${refresh} />`
			: html`<${KadView} status=${status} guard=${guard} refresh=${refresh} tick=${tick} />`}
	</div>`;
}

function ServersView({ data, status, guard, refresh }) {
	const [name, setName] = useState(''); const [ipport, setIpport] = useState('');
	const servers = (data && data.servers) || [];
	const curAddr = (status && status.ed2k && status.ed2k.state === 'connected' && status.ed2k.addr) || '';
	const srv = (cmd, s) => { if (guard()) apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {}); };
	const disconnect = () => { if (guard()) apiPost('server_disconnect', {}).then(refresh).catch(() => {}); };
	const add = () => {
		if (!guard()) return;
		const m = ipport.trim().match(/^(\S+):(\d+)$/);
		if (!m) return;
		apiPost('server_add', { addr: m[1], port: m[2], name: name.trim() }).then(() => { setName(''); setIpport(''); refresh(); }).catch(() => {});
	};
	const cols = [
		{ label: 'Server Name', w: 150, grow: true }, { label: 'Address', w: 130 }, { label: 'Description', w: 160 },
		{ label: 'Users', w: 55 }, { label: 'Files', w: 60 }, { label: 'Priority', w: 60 },
	];
	return html`
	<div class="net-pane">
		<div class="net-row">
			<button class="xp-iconbtn" disabled title="Update from server.met URL is not available in the web interface"><${Icon} name="reload" /></button>
			<span class="lbl">Servers (${servers.length})</span>
			<input class="xp-input grow" placeholder="https://.../server.met (not available via web)" disabled
				title="Update from server.met URL is not available in the web interface" />
		</div>
		<div class="net-row">
			<span class="lbl">Add server manually: Name</span>
			<input class="xp-input" style="width:140px" value=${name} onInput=${(e) => setName(e.target.value)} />
			<span class="lbl">IP:Port</span>
			<input class="xp-input" style="width:150px" value=${ipport} onInput=${(e) => setIpport(e.target.value)} />
			<button class="xp-btn" onClick=${add}>Add</button>
			<button class="xp-btn" onClick=${disconnect}>Disconnect</button>
		</div>
		<${ListView} columns=${cols}>
			${servers.map((s) => {
		const connected = curAddr && s.addr === curAddr;
		return html`
			<div key=${s.ip + ':' + s.port} class=${'lv-row' + (connected ? ' bold' : '')}
				onDblClick=${() => srv('connect', s)} onContextMenu=${(e) => { e.preventDefault(); if (confirm('Remove ' + (s.name || s.addr) + '?')) srv('remove', s); }}>
				<div class="lv-cell" style="width:150px;flex:1 1 auto">${s.name}</div>
				<div class="lv-cell" style="width:130px">${s.addr}</div>
				<div class="lv-cell" style="width:160px" title=${s.desc}>${s.desc}</div>
				<div class="lv-cell" style="width:55px;text-align:right">${s.users}</div>
				<div class="lv-cell" style="width:60px;text-align:right">${s.files}</div>
				<div class="lv-cell" style="width:60px">Normal</div>
			</div>`;
	})}
		<//>
		<div class="net-hint">Double-click a server to connect · right-click to remove</div>
	</div>`;
}

function KadView({ status, guard, refresh, tick }) {
	const [ip, setIp] = useState(['', '', '', '']);
	const [port, setPort] = useState('');
	const [nurl, setNurl] = useState('');
	const [gready, setGready] = useState(false);
	const kad = (status && status.kad) || { connected: false };
	useEffect(() => { let alive = true; apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {}); return () => { alive = false; }; }, []);
	const act = (action, extra) => { if (guard()) apiPost('kad', Object.assign({ action }, extra || {})).then(refresh).catch(() => {}); };
	const connectIp = () => act('connect_ip', { ip0: ip[3], ip1: ip[2], ip2: ip[1], ip3: ip[0], port });
	const ipIn = (i) => html`<input class="xp-input ipoct" maxLength="3" value=${ip[i]}
		onInput=${(e) => setIp((p) => { const n = p.slice(); n[i] = e.target.value; return n; })} />`;
	return html`
	<div class="net-pane">
		<div class="net-row">
			<button class="xp-iconbtn" title="Update nodes.dat from URL"
				onClick=${() => { if (nurl.trim()) act('update_url', { url: nurl.trim() }); }}><${Icon} name="reload" /></button>
			<span class="lbl">Nodes</span>
			<input class="xp-input grow" placeholder="https://.../nodes.dat" value=${nurl}
				onInput=${(e) => setNurl(e.target.value)}
				onKeyDown=${(e) => { if (e.key === 'Enter' && nurl.trim()) act('update_url', { url: nurl.trim() }); }} />
		</div>
		<div class="kad-grid">
			<div class="kad-graph">
				<div class="graph-title">Nodes stats</div>
				${gready && !MOCK
					? html`<img class="statimg" src=${'amule_stats_kad.png?v=' + tick} alt="" />`
					: html`<div class="graphbox"><span>Nodes</span></div>`}
				<div class="graph-legend"><span class="lg cur">Current</span><span class="lg avg">Running average</span><span class="lg sess">Session average</span></div>
			</div>
			<div class="kad-boot">
				<fieldset><legend>Bootstrap</legend>
					<div class="grp-lbl">New node</div>
					<div class="kad-line"><span class="lbl">IP:</span>${ipIn(0)}${ipIn(1)}${ipIn(2)}${ipIn(3)}</div>
					<div class="kad-line"><span class="lbl">Port:</span><input class="xp-input" style="width:80px" value=${port} onInput=${(e) => setPort(e.target.value)} /></div>
					<div class="kad-line"><button class="xp-btn" onClick=${connectIp}>Connect</button></div>
					<hr/>
					<button class="xp-btn wide" onClick=${() => act('connect_known')}>Bootstrap from known clients</button>
					<button class="xp-btn wide" onClick=${() => act('disconnect')}>Disconnect Kad</button>
				</fieldset>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* SEARCHES                                                             */
/* ==================================================================== */

function SearchesView({ data, status, guard, refresh }) {
	const [q, setQ] = useState('');
	const [type, setType] = useState('Local');
	const [sel, setSel] = useState(() => new Set());
	const cats = (status && status.categories) || [];
	const [tcat, setTcat] = useState(0);
	const results = (data && data.results) || [];
	const start = () => {
		if (!guard() || !q.trim()) return;
		const t = { Local: 0, Global: 1, Kad: 2 };
		apiPost('search_start', { keyword: q.trim(), type: t[type] || 0, avail: 0, minsize: 0, maxsize: 0 }).then(refresh).catch(() => {});
	};
	const download = () => {
		if (!guard()) return;
		const list = Array.from(sel); if (!list.length) return;
		apiPost('search_download', { hashes: list.join(','), cat: tcat }).then(refresh).catch(() => {});
		setSel(new Set());
	};
	const toggle = (h) => setSel((s) => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
	const cols = [{ label: 'File Name', w: 300, grow: true }, { label: 'Size', w: 80 }, { label: 'Sources', w: 70 }, { label: 'Type', w: 80 }];
	return html`
	<div class="view-fill">
		<fieldset class="search-box"><legend>Search</legend>
			<div class="srow">
				<span class="lbl">Name:</span>
				<input class="xp-input grow" value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') start(); }} />
				<span class="lbl">Type</span>
				<select class="xp-select" value=${type} onChange=${(e) => setType(e.target.value)}>
					${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
				</select>
				${/* extended params + filtering are not exposed by api.php */ ''}
				<label class="xp-check dis"><input type="checkbox" disabled /> Extended Parameters</label>
				<label class="xp-check dis"><input type="checkbox" disabled /> Filtering</label>
			</div>
			<div class="srow btns">
				<button class="xp-btn" onClick=${start}>Start</button>
				<button class="xp-btn" disabled title="Not available in the web interface">More</button>
				<button class="xp-btn" disabled title="Not available in the web interface">Stop</button>
				<button class="xp-btn" onClick=${download}>Download</button>
				<button class="xp-btn" onClick=${() => setQ('')}>Reset Fields</button>
				<button class="xp-btn" onClick=${() => { setQ(''); }}>Clear</button>
			</div>
		</fieldset>
		<div class="results-lbl">Results</div>
		<${ListView} columns=${cols}>
			${results.map((f) => html`
			<div key=${f.hash} class=${'lv-row' + (sel.has(f.hash) ? ' sel' : '')} onClick=${() => toggle(f.hash)}>
				<div class="lv-cell" style="width:300px;flex:1 1 auto" title=${f.name}>${f.name}</div>
				<div class="lv-cell" style="width:80px">${fmtB(f.size)}</div>
				<div class="lv-cell" style="width:70px;text-align:right">${f.sources}</div>
				<div class="lv-cell" style="width:80px"></div>
			</div>`)}
		<//>
	</div>`;
}

/* ==================================================================== */
/* SHARED FILES                                                         */
/* ==================================================================== */

function SharedView({ data, status, guard, refresh }) {
	const shared = (data && data.shared) || [];
	const reload = () => { if (guard()) apiPost('shared_cmd', { cmd: 'reload' }).then(refresh).catch(() => {}); };
	const cols = [
		{ label: 'File Name', w: 240, grow: true }, { label: 'Size', w: 80 }, { label: 'Type', w: 60 },
		{ label: 'Priority', w: 70 }, { label: 'FileID', w: 160 }, { label: 'Requests', w: 70 },
	];
	return html`
	<div class="view-fill">
		<div class="shared-top">
			<span class="lbl strong">Shared Files (${shared.length})</span>
			${/* per-file client lists are not exposed by api.php -> shown disabled */ ''}
			<fieldset class="show-for"><legend>Show Clients for</legend>
				${[['all', 'All files'], ['selected', 'Selected files'], ['active', 'Active uploads only']].map(([v, l]) => html`
				<label key=${v} class="xp-radio dis"><input type="radio" name="sf" disabled checked=${v === 'selected'} /> ${l}</label>`)}
			</fieldset>
			<div class="reload-box"><span class="lbl">Reload:</span><button class="xp-iconbtn" onClick=${reload}><${Icon} name="reload" /></button></div>
		</div>
		<${ListView} columns=${cols}>
			${shared.map((f) => html`
			<div key=${f.hash} class="lv-row">
				<div class="lv-cell" style="width:240px;flex:1 1 auto" title=${f.name}>${f.name}</div>
				<div class="lv-cell" style="width:80px">${fmtB(f.size)}</div>
				<div class="lv-cell" style="width:60px"></div>
				<div class="lv-cell" style="width:70px">${prioStr(f)}</div>
				<div class="lv-cell" style="width:160px;font-family:monospace;font-size:10px">${(f.hash || '').slice(0, 24)}</div>
				<div class="lv-cell" style="width:70px;text-align:right">${f.req} (${f.req_all})</div>
			</div>`)}
		<//>
		<div class="shared-stats">
			<div class="ss-title">Statistics and queued clients for selected file(s) : Session / All time</div>
			<div class="ss-row"><span>Requested</span><b>- / -</b><span>Active Uploads</span><b>- / -</b><span>Transferred</span><b>- / -</b></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* MESSAGES (faithful but inert -- api.php has no message bridge)       */
/* ==================================================================== */

function MessagesView() {
	return html`
	<div class="view-fill msg-grid">
		<div class="friends">
			<div class="pane-title"><${Icon} name="messages" /> Friends</div>
			<${ListView} columns=${[{ label: 'Username', w: 180, grow: true }]}><//>
		</div>
		<div class="messages">
			<div class="pane-title">✉ Messages</div>
			<div class="msg-area"></div>
			<div class="msg-input">
				<input class="xp-input grow" disabled />
				<button class="xp-btn" disabled>Send</button>
				<button class="xp-btn" disabled>Close</button>
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* STATISTICS                                                           */
/* ==================================================================== */

function TreeNode({ name, node, depth }) {
	const [open, setOpen] = useState(depth < 1);
	if (node === null || node === undefined) return html`<div class="tnode leaf" style=${'padding-left:' + (depth * 14 + 6) + 'px'}>${name}</div>`;
	return html`
	<div>
		<div class="tnode" style=${'padding-left:' + (depth * 14) + 'px'} onClick=${() => setOpen((o) => !o)}>
			<span class="texp">${open ? '−' : '+'}</span>${name}
		</div>
		${open ? Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} depth=${depth + 1} />`) : ''}
	</div>`;
}

function StatisticsView({ tick }) {
	const [tree, setTree] = useState(null);
	const [gready, setGready] = useState(false);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		apiGet('statstree').then((d) => { if (alive) setTree(d || null); }).catch(() => {});
		return () => { alive = false; };
	}, [tick]);
	const graph = (src, title, max) => html`
		<div class="stat-graph">
			<div class="graph-title">${title}</div>
			${gready && !MOCK ? html`<img class="statimg" src=${src + '?v=' + tick} alt="" />` : html`<div class="graphbox"><span>${max}</span></div>`}
			<div class="graph-legend"><span class="lg cur">Current</span><span class="lg avg">Running average</span><span class="lg sess">Session average</span></div>
		</div>`;
	return html`
	<div class="view-fill stats-grid">
		${graph('amule_stats_download.png', 'Download-Speed', 'kB/s')}
		${graph('amule_stats_upload.png', 'Upload-Speed', 'kB/s')}
		${graph('amule_stats_conncount.png', 'Connections', '')}
		<div class="stat-graph">
			<div class="graph-title">Statistics Tree</div>
			<div class="stat-tree">
				${tree ? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} depth=${0} />`) : html`<div class="tnode leaf">Loading…</div>`}
			</div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* PREFERENCES dialog                                                   */
/* ==================================================================== */

const PREF_CATS = ['General', 'Connection', 'Directories', 'Servers', 'Files', 'Security', 'Interface', 'Statistics', 'Proxy', 'Filters', 'Remote Controls', 'Online Signature', 'Advanced', 'Events'];

// Representative options for the preference pages the web API (api.php) does
// not expose. They are rendered DISABLED for fidelity (you see them, greyed).
const PREF_PLACEHOLDER = {
	Directories: [['text', 'Incoming directory'], ['text', 'Temporary directory'], ['check', 'Share new files automatically']],
	Servers: [['check', 'Update server list when connecting to a server'], ['check', 'Update server list when a client connects'], ['check', 'Use the priority system'], ['check', 'Smart LowID check on connect'], ['check', 'Safe server connect'], ['check', 'Remove dead servers after retries']],
	Security: [['check', 'Filter incoming messages from unknown clients'], ['check', 'Allow others to see my shared files'], ['check', 'Enable IP filtering'], ['check', 'Filter clients'], ['check', 'Filter servers']],
	Interface: [['check', 'Show splash screen on startup'], ['check', 'Use single click to expand/collapse trees'], ['check', 'Show fast eD2k links handler'], ['text', 'Skin']],
	Statistics: [['text', 'Update delay (seconds)'], ['text', 'Time for average graph (minutes)'], ['check', 'Use VBR display']],
	Proxy: [['check', 'Enable proxy'], ['text', 'Proxy host'], ['text', 'Proxy port'], ['text', 'Username'], ['text', 'Password']],
	Filters: [['check', 'Filter LAN IP addresses'], ['check', 'Paranoid header checks'], ['check', 'Auto-update ipfilter.dat'], ['text', 'ipfilter.dat URL']],
	'Remote Controls': [['check', 'Enable web server (amuleweb)'], ['check', 'Enable external connections'], ['text', 'Web server port'], ['text', 'External connection port']],
	'Online Signature': [['check', 'Enable Online Signature'], ['text', 'Online signature directory']],
	Advanced: [['check', 'Enable UPnP port mapping'], ['check', 'Check disk space'], ['text', 'Max new connections per 5 seconds'], ['text', 'File buffer size']],
	Events: [['check', 'Run a command when a download finishes'], ['text', 'Command'], ['check', 'Run a command when a new chat session starts']],
};

function PrefsDialog({ status, guard, onClose }) {
	const [catSel, setCatSel] = useState('General');
	const [form, setForm] = useState(null);
	const guest = !!(status && status.guest);
	useEffect(() => { apiGet('options').then((o) => { const f = Object.assign({}, o); delete f.categories; setForm(f); }).catch(() => setForm({})); }, []);
	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const apply = () => {
		if (!guard()) { onClose(); return; }
		const payload = {}; Object.keys(form || {}).forEach((k) => { payload[k] = form[k] == null ? '' : String(form[k]); });
		apiPost('set_options', payload).then(onClose).catch(onClose);
	};
	const chk = (k, label) => html`<label class="xp-check block"><input type="checkbox" disabled=${guest}
		checked=${form && (form[k] === '1' || form[k] === 1)} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} /> ${label}</label>`;
	const txt = (k, w) => html`<input class="xp-input" style=${'width:' + (w || 60) + 'px'} disabled=${guest}
		value=${form && form[k] != null ? form[k] : ''} onInput=${(e) => set(k, e.target.value)} />`;

	return html`
	<div class="xp-modal-backdrop" onClick=${onClose}>
		<div class="xp-dialog" onClick=${(e) => e.stopPropagation()}>
			<div class="xp-title sm"><span class="xp-title-text">Preferences</span>
				<div class="xp-caption"><button class="xp-cap close" onClick=${onClose}>✕</button></div></div>
			<div class="prefs-body">
				<div class="prefs-cats">
					${PREF_CATS.map((c) => html`<div key=${c} class=${'prefcat' + (catSel === c ? ' active' : '')} onClick=${() => setCatSel(c)}>${c}</div>`)}
				</div>
				<div class="prefs-pane">
					${!form ? html`<p>Loading…</p>` : catSel === 'General' ? html`
						<fieldset><legend>Nick</legend>${txt('nick', 300)}</fieldset>
						${chk('use_gzip', 'Use gzip compression on the web server')}
						${chk('new_files_paused', 'Add new downloads in paused mode')}
						${chk('new_files_auto_dl_prio', 'Added download files have auto priority')}
						<div class="prow"><span>Tooltip delay time:</span>${txt('autorefresh_time', 40)}<span>seconds (web refresh)</span></div>
					` : catSel === 'Connection' ? html`
						<div class="prow"><span>Max download rate (kB/s):</span>${txt('max_down_limit')}</div>
						<div class="prow"><span>Max upload rate (kB/s):</span>${txt('max_up_limit')}</div>
						<div class="prow"><span>Max sources per file:</span>${txt('max_file_src')}</div>
						<div class="prow"><span>Max connections:</span>${txt('max_conn_total')}</div>
						<div class="prow"><span>TCP port:</span>${txt('tcp_port')}</div>
						<div class="prow"><span>UDP port:</span>${txt('udp_port')}</div>
						${chk('autoconn_en', 'Reconnect on loss')}
						${chk('network_ed2k', 'Enable ED2K')}${chk('network_kad', 'Enable Kademlia')}
					` : catSel === 'Files' ? html`
						${chk('ich_en', 'I.C.H. active')}${chk('aich_trust', 'AICH trusts every hash (not recommended)')}
						${chk('alloc_full', 'Allocate full disk space for .part files')}
						${chk('check_free_space', 'Check disk free space')}
						<div class="prow"><span>Minimum free space (MB):</span>${txt('min_free_space')}</div>
						${chk('extract_metadata', 'Extract metadata tags')}
					` : html`
						${(PREF_PLACEHOLDER[catSel] || []).map(([kind, label], i) => kind === 'check'
							? html`<label key=${i} class="xp-check block dis"><input type="checkbox" disabled /> ${label}</label>`
							: html`<div key=${i} class="prow dis"><span>${label}:</span><input class="xp-input" style="width:160px" disabled /></div>`)}
						<p class="muted note">These options are not available through the web interface (read-only here).</p>`}
				</div>
			</div>
			<div class="prefs-foot">
				<button class="xp-btn def" onClick=${apply}>OK</button>
				<button class="xp-btn" onClick=${onClose}>Cancel</button>
			</div>
		</div>
	</div>`;
}

function AboutDialog({ status, onClose }) {
	return html`
	<div class="xp-modal-backdrop" onClick=${onClose}>
		<div class="xp-dialog about" onClick=${(e) => e.stopPropagation()}>
			<div class="xp-title sm"><span class="xp-title-text">About aMule</span>
				<div class="xp-caption"><button class="xp-cap close" onClick=${onClose}>✕</button></div></div>
			<div class="about-body">
				<img src=${A + 'logo.png'} class="about-logo" alt="" />
				<div>
					<h3>aMule</h3>
					<p>${status && status.version ? 'Core version: ' + status.version : 'all-platform eMule P2P client'}</p>
					<p class="muted">Web interface — “xpdesktop” skin. The desktop look,
					   rendered in your browser on the shared api.php layer.</p>
				</div>
			</div>
			<div class="prefs-foot"><button class="xp-btn def" onClick=${onClose}>OK</button></div>
		</div>
	</div>`;
}

/* ==================================================================== */
/* App shell                                                            */
/* ==================================================================== */

const VIEW_ROUTE = { downloads: 'transfers', shared: 'shared', networks: 'servers', searches: 'search' };
const REFRESH_MS = 4000;
const VIEWS = ['downloads', 'networks', 'searches', 'shared', 'messages', 'statistics'];

function App() {
	const [view, setView] = useState(() => { const h = location.hash.replace('#', ''); return VIEWS.indexOf(h) >= 0 ? h : 'downloads'; });
	const [status, setStatus] = useState(null);
	const [data, setData] = useState(null);
	const [tick, setTick] = useState(0);
	const [modal, setModal] = useState(null);
	const [now, setNow] = useState('');
	const busy = useRef(false);

	const cycle = useCallback(async (force) => {
		if (busy.current || (document.hidden && !force)) return;
		busy.current = true;
		try {
			const s = await apiGet('status'); setStatus(s);
			const route = VIEW_ROUTE[view];
			if (route) { const d = await apiGet(route); setData(d); }
			setTick((t) => t + 1);
		} catch (e) { /* keep last */ }
		busy.current = false;
	}, [view]);

	useEffect(() => { cycle(true); const t = setInterval(() => cycle(false), REFRESH_MS); return () => clearInterval(t); }, [cycle]);
	useEffect(() => {
		const upd = () => setNow(new Date().toLocaleString());
		upd(); const t = setInterval(upd, 1000); return () => clearInterval(t);
	}, []);
	useEffect(() => { if (location.pathname.endsWith('login.php')) { try { history.replaceState(null, '', './'); } catch (e) { /* ignore */ } } }, []);

	const guard = useCallback(() => { if (status && status.guest) { alert('You logged in as guest - commands are disabled'); return false; } return true; }, [status]);
	const refresh = useCallback(() => cycle(true), [cycle]);

	const pick = (id) => {
		if (id === 'preferences') { setModal('prefs'); return; }
		if (id === 'about') { setModal('about'); return; }
		if (id === 'disconnect') { if (guard()) apiPost('server_disconnect', {}).then(refresh).catch(() => {}); return; }
		if (id === 'import') { alert('Import: drop ed2k links in the box at the bottom, or paste a collection — handled by the core.'); return; }
		if (id !== view) { setData(null); setView(id); try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } }
	};

	const vp = { data, status, guard, refresh, tick };
	let body;
	if (view === 'downloads') body = html`<${DownloadsView} ...${vp} />`;
	else if (view === 'networks') body = html`<${NetworksView} ...${vp} />`;
	else if (view === 'searches') body = html`<${SearchesView} ...${vp} />`;
	else if (view === 'shared') body = html`<${SharedView} ...${vp} />`;
	else if (view === 'messages') body = html`<${MessagesView} />`;
	else if (view === 'statistics') body = html`<${StatisticsView} tick=${tick} />`;

	return html`
	<div class="xp-desktop">
		<div class="xp-window">
			<${TitleBar} />
			<${Toolbar} view=${view} onPick=${pick} />
			<div class="xp-content">${body}</div>
			<${Footer} status=${status} guard=${guard} />
			<${StatusBar} status=${status} now=${now} />
		</div>
		${modal === 'prefs' ? html`<${PrefsDialog} status=${status} guard=${guard} onClose=${() => setModal(null)} />` : ''}
		${modal === 'about' ? html`<${AboutDialog} status=${status} onClose=${() => setModal(null)} />` : ''}
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
