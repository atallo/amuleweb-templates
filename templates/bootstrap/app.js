/*
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * app.js -- "bootstrap": Jaures P. (pedro77)'s Bootstrap 4 re-skin of the
 * aMule web interface, reproduced as a single-page app on top of the shared
 * JSON layer (api.php). Markup, texts and number formats are transcribed
 * from the original server-rendered pages; jQuery and bootstrap.bundle.js
 * are not needed (the navbar collapse, dropdown and statistics tree are
 * driven by the app itself), only Bootstrap's CSS is shipped.
 * Origin: https://github.com/pedro77/amuleweb-bootstrap-template
 */

import {
	html, render, useState, useEffect, useRef, useCallback,
} from './preact-htm-standalone.module.js';

// Asset base: resolves template images both deployed (flat, at the server
// root) and in the dev mock preview (/templates/bootstrap/).
const A = new URL('.', import.meta.url).pathname;

// The upstream template's SVG icon sprite, injected once so that
// <use href="#icon-..."> resolves both deployed and in the dev preview.
const SPRITE = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none">
<defs>
  <g id="icon-download-upload"><path fill-rule="evenodd" d="M11 3.5a.5.5 0 01.5.5v9a.5.5 0 01-1 0V4a.5.5 0 01.5-.5z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M10.646 2.646a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L11 3.707 8.354 6.354a.5.5 0 11-.708-.708l3-3zm-9 7a.5.5 0 01.708 0L5 12.293l2.646-2.647a.5.5 0 11.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M5 2.5a.5.5 0 01.5.5v9a.5.5 0 01-1 0V3a.5.5 0 01.5-.5z" clip-rule="evenodd"/></g>
  <g id="icon-shared-files"><path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1.001 1.001 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 11-2.83-2.83l.793-.792a4.018 4.018 0 01-.128-1.287z"/><path d="M5.712 6.96l.167-.167a1.99 1.99 0 01.896-.518 1.99 1.99 0 01.518-.896l.167-.167A3.004 3.004 0 006 5.499c-.22.46-.316.963-.288 1.46z"/><path d="M6.586 4.672A3 3 0 007.414 9.5l.775-.776a2 2 0 01-.896-3.346L9.12 3.55a2 2 0 012.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 00-4.243-4.243L6.586 4.672z"/><path d="M10 9.5a2.99 2.99 0 00.288-1.46l-.167.167a1.99 1.99 0 01-.896.518 1.99 1.99 0 01-.518.896l-.167.167A3.004 3.004 0 0010 9.501z"/></g>
  <g id="icon-search"><path fill-rule="evenodd" d="M10.442 10.442a1 1 0 011.415 0l3.85 3.85a1 1 0 01-1.414 1.415l-3.85-3.85a1 1 0 010-1.415z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM13 6.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" clip-rule="evenodd"/></g>
  <g id="icon-servers"><path d="M13 2c0-1.105-2.239-2-5-2S3 .895 3 2s2.239 2 5 2 5-.895 5-2z"/><path d="M13 3.75c-.322.24-.698.435-1.093.593C10.857 4.763 9.475 5 8 5s-2.857-.237-3.907-.657A4.881 4.881 0 013 3.75V6c0 1.105 2.239 2 5 2s5-.895 5-2V3.75z"/><path d="M13 7.75c-.322.24-.698.435-1.093.593C10.857 8.763 9.475 9 8 9s-2.857-.237-3.907-.657A4.881 4.881 0 013 7.75V10c0 1.105 2.239 2 5 2s5-.895 5-2V7.75z"/><path d="M13 11.75c-.322.24-.698.435-1.093.593-1.05.42-2.432.657-3.907.657s-2.857-.237-3.907-.657A4.883 4.883 0 013 11.75V14c0 1.105 2.239 2 5 2s5-.895 5-2v-2.25z"/></g>
  <g id="icon-kademlia"><path fill-rule="evenodd" d="M4.887 7.2l-.964-.165A2.5 2.5 0 103.5 12h10a1.5 1.5 0 00.237-2.981L12.7 8.854l.216-1.028a4 4 0 10-7.843-1.587l-.185.96zm9.084.341a5 5 0 00-9.88-1.492A3.5 3.5 0 103.5 13h9.999a2.5 2.5 0 00.394-4.968c.033-.16.06-.324.077-.49z" clip-rule="evenodd"/></g>
  <g id="icon-statistics"><path fill-rule="evenodd" d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5h-2v12h2V2zp-2-1a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V2a1 1 0 00-1-1h-2zM6 7a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1V7zm-5 4a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H2a1 1 0 01-1-1v-3z" clip-rule="evenodd"/></g>
  <g id="icon-utility"><path fill-rule="evenodd" d="M0 1l1-1 3.081 2.2a1 1 0 01.419.815v.07a1 1 0 00.293.708L10.5 9.5l.914-.305a1 1 0 011.023.242l3.356 3.356a1 1 0 010 1.414l-1.586 1.586a1 1 0 01-1.414 0l-3.356-3.356a1 1 0 01-.242-1.023L9.5 10.5 3.793 4.793a1 1 0 00-.707-.293h-.071a1 1 0 01-.814-.419L0 1zm11.354 9.646a.5.5 0 00-.708.708l3 3a.5.5 0 00.708-.708l-3-3z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M15.898 2.223a3.003 3.003 0 01-3.679 3.674L5.878 12.15a3 3 0 11-2.027-2.027l6.252-6.341A3 3 0 0113.778.1l-2.142 2.142L12 4l1.757.364 2.141-2.141zm-13.37 9.019L3.001 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026z" clip-rule="evenodd"/></g>
  <g id="icon-pause"><path fill-rule="evenodd" d="M6 3.5a.5.5 0 01.5.5v8a.5.5 0 01-1 0V4a.5.5 0 01.5-.5zm4 0a.5.5 0 01.5.5v8a.5.5 0 01-1 0V4a.5.5 0 01.5-.5z" clip-rule="evenodd"/></g>
  <g id="icon-resume"><path fill-rule="evenodd" d="M10.804 8L5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 010 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z" clip-rule="evenodd"/></g>
  <g id="icon-prioup"><path fill-rule="evenodd" d="M8 3.5a.5.5 0 01.5.5v9a.5.5 0 01-1 0V4a.5.5 0 01.5-.5z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M7.646 2.646a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8 3.707 5.354 6.354a.5.5 0 11-.708-.708l3-3z" clip-rule="evenodd"/></g>
  <g id="icon-priodown"><path fill-rule="evenodd" d="M4.646 9.646a.5.5 0 01.708 0L8 12.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M8 2.5a.5.5 0 01.5.5v9a.5.5 0 01-1 0V3a.5.5 0 01.5-.5z" clip-rule="evenodd"/></g>
  <g id="icon-cancel"><path fill-rule="evenodd" d="M11.854 4.146a.5.5 0 010 .708l-7 7a.5.5 0 01-.708-.708l7-7a.5.5 0 01.708 0z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M4.146 4.146a.5.5 0 000 .708l7 7a.5.5 0 00.708-.708l-7-7a.5.5 0 00-.708 0z" clip-rule="evenodd"/></g>
  <g id="icon-filter"><path fill-rule="evenodd" d="M1.5 1.5A.5.5 0 012 1h12a.5.5 0 01.5.5v2a.5.5 0 01-.128.334L10 8.692V13.5a.5.5 0 01-.342.474l-3 1A.5.5 0 016 14.5V8.692L1.628 3.834A.5.5 0 011.5 3.5v-2zm1 .5v1.308l4.372 4.858A.5.5 0 017 8.5v5.306l2-.666V8.5a.5.5 0 01.128-.334L13.5 3.308V2h-11z" clip-rule="evenodd"/></g>
  <g id="icon-connect"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/> <path d="M6.764 6.5H7c.364 0 .706.097 1 .268A1.99 1.99 0 0 1 9 6.5h.236A3.004 3.004 0 0 0 8 5.67a3 3 0 0 0-1.236.83z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/><path d="M8 11.33a3.01 3.01 0 0 0 1.236-.83H9a1.99 1.99 0 0 1-1-.268 1.99 1.99 0 0 1-1 .268h-.236c.332.371.756.66 1.236.83z"/></g>
  <g id="icon-remove"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></g>
  <g id="icon-reload"><path fill-rule="evenodd" d="M2.854 7.146a.5.5 0 00-.708 0l-2 2a.5.5 0 10.708.708L2.5 8.207l1.646 1.647a.5.5 0 00.708-.708l-2-2zm13-1a.5.5 0 00-.708 0L13.5 7.793l-1.646-1.647a.5.5 0 00-.708.708l2 2a.5.5 0 00.708 0l2-2a.5.5 0 000-.708z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M8 3a4.995 4.995 0 00-4.192 2.273.5.5 0 01-.837-.546A6 6 0 0114 8a.5.5 0 01-1.001 0 5 5 0 00-5-5zM2.5 7.5A.5.5 0 013 8a5 5 0 009.192 2.727.5.5 0 11.837.546A6 6 0 012 8a.5.5 0 01.501-.5z" clip-rule="evenodd"/></g>
  <g id="icon-setprio"><path fill-rule="evenodd" d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" clip-rule="evenodd"/></g>
  <g id="icon-folder-closed"><path fill-rule="evenodd" d="M8 3.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H4a.5.5 0 0 1 0-1h3.5V4a.5.5 0 0 1 .5-.5z"/><path fill-rule="evenodd" d="M7.5 8a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0V8z"/><path fill-rule="evenodd" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></g>
  <g id="icon-folder-opened"><path fill-rule="evenodd" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path fill-rule="evenodd" d="M3.5 8a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/></g>
  <g id="icon-item"><path fill-rule="evenodd" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></g>
</defs>
</svg>`;
if (typeof document !== 'undefined' && !document.getElementById('icon-download-upload')) {
	document.body.insertAdjacentHTML('afterbegin', SPRITE);
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
/* Formatting helpers (texts match the original template)               */
/* ==================================================================== */

const r2 = (n) => {
	const s = (Math.round(n * 100) / 100).toFixed(2);
	return s.replace(/\.?0+$/, '') || '0';
};
// CastToXBytes, transcribed from the original pages (uppercase units).
function fmtB(size) {
	size = Number(size) || 0;
	if (size < 1024) return size + ' B';
	if (size < 1048576) return r2(size / 1024) + ' KB';
	if (size < 1073741824) return r2(size / 1048576) + ' MB';
	return r2(size / 1073741824) + ' GB';
}
const pct2 = (done, size) => (size > 0 ? r2((Number(done) * 100) / Number(size)) : '0');

const PRIO = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Very high', 4: 'Very low', 5: 'Auto', 6: 'Release' };
function prioString(f) {
	let s = PRIO[f.prio] !== undefined ? PRIO[f.prio] : String(f.prio);
	if (f.prio_auto == 1) s += ' (auto)';
	return s;
}
// "Very low" sorts below "Low", like the original PrioSort().
const prioSort = (f) => (Number(f.prio) === 4 ? 0 : Number(f.prio) + 1);
function statusString(f) {
	if (f.status === 7) return 'Paused';
	return f.src_count_xfer > 0 ? 'Downloading' : 'Waiting';
}
function sourcesText(f) {
	let s = '';
	if (f.src_count_not_curr != 0) s += (f.src_count - f.src_count_not_curr) + '/';
	s += f.src_count + ' (' + f.src_count_xfer + ') ';
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

const Icon = ({ id, vb }) => html`<svg class="bi" viewBox=${vb || '0 0 16 16'}><use href=${'#icon-' + id} /></svg>`;
const SortA = ({ label, k, sort }) => html`<a href="#" class="text-light"
	onClick=${(e) => { e.preventDefault(); sort.by(k); }}>${label}</a>`;

// Header row + "None" placeholder of the .amule-list containers.
const ListHead = ({ children }) => html`
	<div class="row p-1 bg-secondary text-light border-bottom border-dark font-weight-bold">${children}</div>`;
const NoneRow = () => html`<div class="row p-1"><div class="col"><p class="text-center">None</p></div></div>`;

// File-name cell: checkbox + label, like the original custom-control markup.
function NameCheck({ f, sel, guest }) {
	const name = f.name || ((f.hash || '') + ' (unnamed)');
	return html`
	<div class="col-12 col-md-4 form-check form-check-inline custom-control custom-checkbox mr-0">
		${!guest ? html`<input type="checkbox" class="custom-control-input" id=${f.hash}
			checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} />` : ''}
		<label class=${(!guest ? 'custom-control-label' : 'col-form-label') + ' d-block text-break'} for=${f.hash}>${name}</label>
	</div>`;
}

// The original draws two stacked Bootstrap bars: a thin green "transferring"
// bar on top of the main completion bar with the percentage inside.
function Progress({ f }) {
	const p = pct2(f.size_done, f.size);
	const px = pct2(f.size_xfer, f.size);
	return html`
	<div class="progress" style="height: 2px; position: relative; top: 2px; opacity: 0.75">
		<div class="progress-bar bg-success" role="progressbar" style=${'width: ' + px + '%'}
			aria-valuenow=${px} aria-valuemin="0" aria-valuemax="100"></div>
	</div>
	<div class="progress">
		<div class="progress-bar" role="progressbar" style=${'width: ' + p + '%'}
			aria-valuenow=${p} aria-valuemin="0" aria-valuemax="100">${p}%</div>
	</div>`;
}

const GuestBanner = () => html`
	<div class="container mb-3"><div class="row"><div class="col text-center text-info">
		<strong>You logged in as guest - commands are disabled</strong>
	</div></div></div>`;

/* ==================================================================== */
/* Navbar / footer                                                      */
/* ==================================================================== */

const NAV = [
	['download', 'download-upload', 'Download/Upload', '0 0 16 16'],
	['shared', 'shared-files', 'Shared files', '0 0 16 16'],
	['search', 'search', 'Search', '0 0 20 20'],
	['servers', 'servers', 'Servers', '0 0 20 20'],
	['kad', 'kademlia', 'Kademlia', '0 0 16 16'],
	['stats', 'statistics', 'Statistics', '0 0 16 16'],
];

function Navbar({ view, go }) {
	const [open, setOpen] = useState(false);
	const [util, setUtil] = useState(false);
	const nav = (id) => (e) => { e.preventDefault(); setOpen(false); setUtil(false); go(id); };
	return html`
	<nav class="navbar navbar-expand-sm navbar-dark fixed-top bg-dark">
		<a class="navbar-brand" href="#download" onClick=${nav('download')}>
			<img src=${A + 'favicon-32x32.png'} alt="aMule" width="32" height="32" title="aMule Web" class="d-inline-block align-top" />
			${' '}<span class="d-lg-none d-xl-inline-block">aMule Web</span>
		</a>
		<button class="navbar-toggler" type="button" aria-controls="navbarCollapse"
			aria-expanded=${open} aria-label="Toggle navigation" onClick=${() => setOpen((o) => !o)}>
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class=${'collapse navbar-collapse' + (open ? ' show' : '')} id="navbarCollapse">
			<ul class="navbar-nav mr-auto">
				${NAV.map(([id, icon, label, vb]) => html`
				<li key=${id} class=${'nav-item' + (view === id ? ' active' : '')}>
					<a class="nav-link" href=${'#' + id} title=${label} onClick=${nav(id)}>
						<${Icon} id=${icon} vb=${vb} />
						${' '}<span class="d-sm-none d-md-inline-block">${label}</span>
						${view === id ? html`${' '}<span class="sr-only">(current)</span>` : ''}
					</a>
				</li>`)}
			</ul>
			<ul class="navbar-nav">
				<li class=${'nav-item dropdown' + (util ? ' show' : '')}>
					<a class="nav-link dropdown-toggle" title="Utility" href="#" id="navbarDropdownMenuLink"
						role="button" aria-haspopup="true" aria-expanded=${util}
						onClick=${(e) => { e.preventDefault(); setUtil((u) => !u); }}>
						<${Icon} id="utility" vb="0 0 20 20" />
						${' '}<span class="d-sm-none d-md-inline-block">Utility</span>
					</a>
					<div class=${'dropdown-menu dropdown-menu-right' + (util ? ' show' : '')} aria-labelledby="navbarDropdownMenuLink">
						<a class="dropdown-item" href="#log" onClick=${nav('log')}>Log</a>
						<a class="dropdown-item" href="#prefs" onClick=${nav('prefs')}>Configuration</a>
						<a class="dropdown-item" href="login.php">Exit</a>
					</div>
				</li>
			</ul>
		</div>
	</nav>`;
}

function Footer({ status, guard }) {
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
	if (ed2k.state === 'connecting') ed2kTxt = 'Connecting...';
	else if (ed2k.state !== 'connected') ed2kTxt = 'Not connected';
	else ed2kTxt = 'Connected with ' + (ed2k.lowid ? 'Low' : 'High') + ' ID to ' + ed2k.server + '  ' + ed2k.addr;
	const kadTxt = kad.connected ? ('Connected' + (kad.firewalled ? ' (Firewalled)' : ' (OK)')) : 'Disconnected';

	return html`
	<footer class="m-2 p-md-2">
		<form id="formlink" name="formlink" onSubmit=${submit}>
			<div class="container-fluid">
				<div class="form-row justify-content-sm-center">
					<div class="col-12 col-sm-6 col-xl-4 mb-1 mb-sm-0">
						<input id="ed2klink" name="ed2klink" type="text" size="50" class="form-control"
							disabled=${guest} value=${link} onInput=${(e) => setLink(e.target.value)} />
					</div>
					<div class="col-auto">
						<select id="selectcat" class="custom-select" title="Category" disabled=${guest}
							value=${cat} onChange=${(e) => setCat(+e.target.value)}>
							${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
						</select>
					</div>
					<div class="col-auto">
						<button type="submit" class="btn btn-secondary" disabled=${guest}>Download link</button>
					</div>
					<div class="row ml-xl-auto justify-content-center">
						<div class="col-12 col-lg-auto">
							<p class="mt-1 mb-0"><small class="align-bottom"><strong>Ed2k</strong>: ${ed2kTxt}</small></p>
						</div>
						<div class="col-12 col-lg-auto">
							<p class="mt-1 mb-0"><small class="align-bottom"><strong>Kad</strong>: ${kadTxt}</small></p>
						</div>
					</div>
				</div>
			</div>
		</form>
	</footer>`;
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

	const guest = !!(status && status.guest);
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
		prio: (f) => prioSort(f),
	});

	const cmd = (c) => {
		if (!guard()) return;
		if (c === 'cancel' && !confirm('Delete selected files?')) return;
		const list = sel.list();
		if (!list.length) return;
		apiPost('dload_cmd', { cmd: c, hashes: list.join(',') }).then(refresh).catch(() => {});
		if (c === 'cancel') sel.clear();
	};
	const tb = (title, icon, c) => html`
		<div class="col-auto pl-0 pr-1">
			<button type="button" class="btn btn-light" title=${title} disabled=${guest}
				onClick=${() => cmd(c)}><${Icon} id=${icon} /></button>
		</div>`;

	return html`
	<div>
		${guest ? html`<${GuestBanner} />` : ''}
		<form class="mb-3 amule" onSubmit=${(e) => e.preventDefault()}>
			<div class="form-row justify-content-center mb-2">
				${tb('Pause', 'pause', 'pause')}
				${tb('Resume', 'resume', 'resume')}
				${tb('Priority up', 'prioup', 'prioup')}
				${tb('Priority down', 'priodown', 'priodown')}
				${tb('Cancel', 'cancel', 'cancel')}
				<div class="col-auto pl-0 pr-1">
					<select class="custom-select" title="Status" value=${fStatus} onChange=${(e) => setFStatus(e.target.value)}>
						${['all', 'Waiting', 'Paused', 'Downloading'].map((s) => html`<option key=${s} value=${s}>${s}</option>`)}
					</select>
				</div>
				<div class="col-auto pl-0 pr-1">
					<select class="custom-select" title="Category" value=${fCat} onChange=${(e) => setFCat(e.target.value)}>
						<option value="all">all</option>
						${cats.filter((c) => c !== 'all').map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
					</select>
				</div>
				<div class="col-auto pl-0 pr-1">
					<button type="button" class="btn btn-light" title="Filter"
						onClick=${() => { setAStatus(fStatus); setACat(fCat); }}><${Icon} id="filter" /></button>
				</div>
			</div>

			<h5 class="text-center">Download</h5>
			<div class="container-fluid bg-light border border-dark rounded amule-list">
				<${ListHead}>
					<div class="col-12 col-md-4 text-nowrap"><${SortA} label="File name" k="name" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Size" k="size" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Completed" k="size_done" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Speed" k="speed" sort=${sort} /></div>
					<div class="col-12 col-md-2 text-nowrap"><${SortA} label="Progress" k="progress" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Sources" k="srccount" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Status" k="status" sort=${sort} /></div>
					<div class="col-4 col-md-1 text-nowrap"><${SortA} label="Priority" k="prio" sort=${sort} /></div>
				<//>
				${rows.length === 0 ? html`<${NoneRow} />` : rows.map((f) => html`
				<div key=${f.hash} class="row p-1 border-bottom border-secondary">
					<${NameCheck} f=${f} sel=${sel} guest=${guest} />
					<div class="col-4 col-md-1">${fmtB(f.size)}</div>
					<div class="col-4 col-md-1">${fmtB(f.size_done)}</div>
					<div class="col-4 col-md-1">${f.speed > 0 ? fmtB(f.speed) + '/s' : '-'}</div>
					<div class="col-12 col-md-2"><${Progress} f=${f} /></div>
					<div class="col-4 col-md-1">${sourcesText(f)}</div>
					<div class="col-4 col-md-1">${statusString(f)}</div>
					<div class="col-4 col-md-1">${prioString(f)}</div>
				</div>`)}
			</div>
		</form>

		<h5 class="text-center">Upload</h5>
		<div class="container-fluid bg-light border border-dark rounded amule-list">
			<${ListHead}>
				<div class="col-12 col-md-6 text-nowrap">File name</div>
				<div class="col-8 col-md-2 text-nowrap">Username</div>
				<div class="col-4 col-md-1 text-nowrap">Up</div>
				<div class="col-8 col-md-2 text-nowrap order-md-last">Speed</div>
				<div class="col-4 col-md-1 text-nowrap">Down</div>
			<//>
			${uploads.length === 0 ? html`<${NoneRow} />` : uploads.map((f, i) => html`
			<div key=${i} class="row p-1 border-bottom border-secondary">
				<div class="col-12 col-md-6 text-break">${f.name}</div>
				<div class="col-8 col-md-2">${f.user_name}</div>
				<div class="col-4 col-md-1">${fmtB(f.xfer_up)}</div>
				<div class="col-8 col-md-2 order-md-last">${f.xfer_speed > 0 ? fmtB(f.xfer_speed) + '/s' : '-'}</div>
				<div class="col-4 col-md-1">${fmtB(f.xfer_down)}</div>
			</div>`)}
		</div>
	</div>`;
}

/* ==================================================================== */
/* SHARED FILES                                                         */
/* ==================================================================== */

function SharedView({ data, status, guard, refresh }) {
	const sel = useSel();
	const sort = useSort('', 1);
	const [prio, setPrio] = useState('Select prio');
	const guest = !!(status && status.guest);
	const shared = (data && data.shared) || [];
	const rows = sort.sort(shared, {
		name: (f) => (f.name || '').toLowerCase(),
		xfer: (f) => Number(f.xfer), xfer_all: (f) => Number(f.xfer_all),
		req: (f) => Number(f.req), req_all: (f) => Number(f.req_all),
		acc: (f) => Number(f.accept), acc_all: (f) => Number(f.accept_all),
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
	const tb = (title, icon, fn) => html`
		<div class="col-auto pl-0 pr-1">
			<button type="button" class="btn btn-light" title=${title} disabled=${guest}
				onClick=${fn}><${Icon} id=${icon} /></button>
		</div>`;

	return html`
	<div>
		${guest ? html`<${GuestBanner} />` : ''}
		<form class="mb-3 amule" onSubmit=${(e) => e.preventDefault()}>
			<div class="form-row justify-content-center mb-2">
				${tb('Reload shared files', 'reload', () => run('reload'))}
				${tb('Priority up', 'prioup', () => run('prioup'))}
				${tb('Priority down', 'priodown', () => run('priodown'))}
				<div class="col-auto pl-0 pr-1">
					<select class="custom-select" disabled=${guest} value=${prio} onChange=${(e) => setPrio(e.target.value)}>
						${['Select prio', 'Low', 'Normal', 'High'].map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
					</select>
				</div>
				${tb('Set priority', 'setprio', setp)}
			</div>

			<h5 class="text-center">Shared files</h5>
			<div class="container-fluid bg-light border border-dark rounded amule-list">
				<${ListHead}>
					<div class="col-12 col-md-4"><${SortA} label="File name" k="name" sort=${sort} /></div>
					<div class="col-12 col-md-2"><${SortA} label="Transferred" k="xfer" sort=${sort} /> (<${SortA} label="Total" k="xfer_all" sort=${sort} />)</div>
					<div class="col-12 col-md-2"><${SortA} label="Requested" k="req" sort=${sort} /> (<${SortA} label="Total" k="req_all" sort=${sort} />)</div>
					<div class="col-12 col-md-2"><${SortA} label="Accepted requests" k="acc" sort=${sort} /> (<${SortA} label="Total" k="acc_all" sort=${sort} />)</div>
					<div class="col-6 col-md-1"><${SortA} label="Size" k="size" sort=${sort} /></div>
					<div class="col-6 col-md-1"><${SortA} label="Priority" k="prio" sort=${sort} /></div>
				<//>
				${rows.length === 0 ? html`<${NoneRow} />` : rows.map((f) => html`
				<div key=${f.hash} class="row p-1 border-bottom border-secondary">
					<${NameCheck} f=${f} sel=${sel} guest=${guest} />
					<div class="col-12 col-md-2">${fmtB(f.xfer)} (${fmtB(f.xfer_all)})</div>
					<div class="col-12 col-md-2">${f.req} (${f.req_all})</div>
					<div class="col-12 col-md-2">${f.accept} (${f.accept_all})</div>
					<div class="col-6 col-md-1">${fmtB(f.size)}</div>
					<div class="col-6 col-md-1">${prioString(f)}</div>
				</div>`)}
			</div>
		</form>
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

	const guest = !!(status && status.guest);
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
	const unitSel = (v, set) => html`<select class="custom-select" disabled=${guest}
		value=${v} onChange=${(e) => set(e.target.value)}>
		${Object.keys(UNITS).map((u) => html`<option key=${u} value=${u}>${u}</option>`)}
	</select>`;

	return html`
	<div>
		${guest ? html`<${GuestBanner} />` : ''}
		<form class="mb-3 amule search" onSubmit=${doSearch}>
			<h5 class="text-center">Search</h5>
			<div class="form-row">
				<div class="col-12 col-md-6">
					<div class="form-group form-inline">
						<input type="text" id="searchval4" class="form-control mr-1" placeholder="Search value"
							disabled=${guest} value=${q} onInput=${(e) => setQ(e.target.value)} />
						<button type="submit" class="btn btn-primary" title="Search" disabled=${guest}>Search</button>
					</div>
				</div>
				<div class="col-12 col-sm-6 col-md-3">
					<div class="form-group form-inline">
						<label for="avail13" class="mr-1">Availability</label>
						<input type="number" min="0" id="avail13" class="form-control" placeholder="1"
							title="Minimum availability" disabled=${guest} value=${avail} onInput=${(e) => setAvail(e.target.value)} />
					</div>
				</div>
				<div class="col-12 col-sm-6 col-md-3">
					<div class="form-group form-inline amule-size">
						<label for="minsize2" class="mr-1">Min size</label>
						<input type="number" min="0" id="minsize2" class="form-control mr-1" placeholder="700"
							disabled=${guest} value=${minV} onInput=${(e) => setMinV(e.target.value)} />
						${unitSel(minU, setMinU)}
					</div>
				</div>
				<div class="col-12 col-sm-6 col-md-3 order-sm-2 order-md-last amule-size">
					<div class="form-group form-inline amule-size">
						<label for="maxsize4" class="mr-1">Max size</label>
						<input type="number" min="0" id="maxsize4" class="form-control mr-1" placeholder="4000"
							disabled=${guest} value=${maxV} onInput=${(e) => setMaxV(e.target.value)} />
						${unitSel(maxU, setMaxU)}
					</div>
				</div>
				<div class="col-12 col-sm-6 col-md-3 order-sm-1 order-md-5">
					<div class="form-group form-inline">
						<label for="select" class="mr-1">Search type</label>
						<select id="select" class="custom-select" disabled=${guest}
							value=${stype} onChange=${(e) => setStype(e.target.value)}>
							${['Local', 'Global', 'Kad'].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}
						</select>
					</div>
				</div>
				<div class="col-12 col-md-6 order-sm-last order-md-0">
					<a class="align-bottom" href="#search" onClick=${(e) => { e.preventDefault(); refresh(); }}>Click here to update the search results</a>
				</div>
			</div>

			<h5 class="text-center">Results</h5>
			<div class="container-fluid bg-light border border-dark rounded amule-list">
				<${ListHead}>
					<div class="col-12 col-md-8 text-nowrap"><${SortA} label="File name" k="name" sort=${sort} /></div>
					<div class="col-6 col-md-3 text-nowrap"><${SortA} label="Size" k="size" sort=${sort} /></div>
					<div class="col-6 col-md-1 text-nowrap"><${SortA} label="Sources" k="sources" sort=${sort} /></div>
				<//>
				${rows.length === 0 ? html`<${NoneRow} />` : rows.map((f) => html`
				<div key=${f.hash} class="row p-1 border-bottom border-secondary">
					<div class="col-12 col-md-8 form-check form-check-inline custom-control custom-checkbox mr-0">
						${!guest ? html`<input type="checkbox" class="custom-control-input" id=${f.hash}
							checked=${sel.has(f.hash)} onChange=${() => sel.toggle(f.hash)} />` : ''}
						<label class=${(!guest ? 'custom-control-label' : 'col-form-label') + ' d-block text-break'} for=${f.hash}>${f.name}</label>
					</div>
					<div class="col-6 col-md-3">${fmtB(f.size)}</div>
					<div class="col-6 col-md-1 text-right">${f.sources}</div>
				</div>`)}
				<div class="row form-inline form-group p-3">
					<div class="col-auto ml-auto">
						<select id="select32" class="custom-select" disabled=${guest || results.length === 0}
							value=${tcat} onChange=${(e) => setTcat(+e.target.value)}>
							${cats.map((c, i) => html`<option key=${i} value=${i}>${c}</option>`)}
						</select>
						${' '}
						<button type="button" class="btn btn-primary mr-1" disabled=${guest || results.length === 0}
							onClick=${download}>Download</button>
					</div>
				</div>
			</div>
		</form>
	</div>`;
}

/* ==================================================================== */
/* SERVERS                                                              */
/* ==================================================================== */

function ServersView({ data, status, guard, refresh }) {
	const sort = useSort('', 1);
	const guest = !!(status && status.guest);
	const servers = (data && data.servers) || [];
	const rows = sort.sort(servers, {
		name: (s) => (s.name || '').toLowerCase(), desc: (s) => (s.desc || '').toLowerCase(),
		users: (s) => Number(s.users), files: (s) => Number(s.files),
	});
	const srvCmd = (cmd, s) => {
		if (!guard()) return;
		apiPost('server_cmd', { cmd, ip: s.ip, port: s.port }).then(refresh).catch(() => {});
	};
	return html`
	<div>
		<h5 class="text-center">Servers</h5>
		<div class="container-fluid bg-light border border-dark rounded amule-list amule-servers">
			<${ListHead}>
				<div class="col-12 col-md-3 text-nowrap"><${SortA} label="Server name" k="name" sort=${sort} /></div>
				<div class="col-12 col-md-4 text-nowrap"><${SortA} label="Description" k="desc" sort=${sort} /></div>
				<div class="col col-md-2 text-nowrap">Address</div>
				<div class="col text-nowrap"><${SortA} label="Users" k="users" sort=${sort} /></div>
				<div class="col text-nowrap"><${SortA} label="Files" k="files" sort=${sort} /></div>
			<//>
			${rows.length === 0 ? html`<${NoneRow} />` : rows.map((s) => html`
			<div key=${s.ip + ':' + s.port} class="row p-1 border-bottom border-secondary">
				<div class="col-12 col-md-3 pl-0 text-break">
					${!guest ? html`
						<button type="button" class="btn btn-light p-1" title="Connect" onClick=${() => srvCmd('connect', s)}><${Icon} id="connect" /></button>
						<button type="button" class="btn btn-light p-1" title="Remove" onClick=${() => srvCmd('remove', s)}><${Icon} id="remove" /></button>`
					: ''}
					${' '}${s.name}
				</div>
				<div class="col-12 col-md-4 text-break">${s.desc}</div>
				<div class="col col-md-2">${s.addr}</div>
				<div class="col text-right">${s.users}</div>
				<div class="col text-right">${s.files}</div>
			</div>`)}
		</div>
	</div>`;
}

/* ==================================================================== */
/* KADEMLIA                                                             */
/* ==================================================================== */

function KadView({ status, guard, refresh, tick }) {
	const [ip, setIp] = useState(['', '', '', '']);
	const [port, setPort] = useState('');
	const [gready, setGready] = useState(false);
	const guest = !!(status && status.guest);
	useEffect(() => {
		let alive = true;
		apiGet('statsgraph').then(() => { if (alive) setGready(true); }).catch(() => {});
		return () => { alive = false; };
	}, []);
	const connectIp = (e) => {
		e.preventDefault();
		if (!guard()) return;
		// the template's field order is ip3.ip2.ip1.ip0 (low octet first)
		apiPost('kad', { action: 'connect_ip', ip0: ip[3], ip1: ip[2], ip2: ip[1], ip3: ip[0], port }).then(refresh).catch(() => {});
	};
	const ipIn = (i, id) => html`<input type="number" id=${id} class="form-control mr-1" placeholder="123"
		disabled=${guest} value=${ip[i]}
		onInput=${(e) => setIp((p) => { const n = p.slice(); n[i] = e.target.value; return n; })} />`;
	return html`
	<div>
		${guest ? html`<${GuestBanner} />` : ''}
		<form class="mb-3 amule kad" onSubmit=${connectIp}>
			<h5 class="text-center">Kademlia</h5>
			<div class="container-fluid bg-light border border-dark rounded amule-list amule-kad">
				<div class="row p-1 border-bottom border-secondary">
					<div class="col-12 col-lg-6 p-2">
						${gready && !MOCK
							? html`<img src=${'amule_stats_kad.png?v=' + tick} class="img-fluid" alt="stats_kad" />`
							: html`<div class="bg-white" style="width:100%;max-width:500px;height:200px"></div>`}
						<p class="mt-2">Number of nodes</p>
					</div>
					<div class="col-12 col-lg-4 p-2">
						<div class="row">
							<div class="col-12 text-center">
								<h6><strong>Bootstrap from node</strong></h6>
							</div>
							<div class="col-12">
								<div class="form-group form-inline amule-ip">
									<label for="ip32" class="mr-1">IP</label>
									${ipIn(0, 'ip32')}${ipIn(1, 'ip23')}${ipIn(2, 'ip13')}${ipIn(3, 'ip03')}
								</div>
							</div>
							<div class="col-12">
								<div class="form-group form-inline">
									<label for="port3" class="mr-1">Port</label>
									<input type="number" id="port3" class="form-control mr-5" placeholder="4567"
										disabled=${guest} value=${port} onInput=${(e) => setPort(e.target.value)} />
									<button type="submit" class="btn btn-primary" disabled=${guest}>Connect</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</form>
	</div>`;
}

/* ==================================================================== */
/* STATISTICS                                                           */
/* ==================================================================== */

function TreeNode({ name, node }) {
	const [open, setOpen] = useState(true);
	if (node === null || node === undefined) {
		return html`<li class="item"><${Icon} id="item" vb="0 0 20 20" />${name}</li>`;
	}
	return html`
	<li class="folder">
		<a href="#" class="text-dark" onClick=${(e) => { e.preventDefault(); setOpen((o) => !o); }}>
			<${Icon} id=${open ? 'folder-opened' : 'folder-closed'} vb="0 0 20 20" />
			${name}
		</a>
		${open ? html`<ul class="list-unstyled pl-3">
			${Object.entries(node).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)}
		</ul>` : ''}
	</li>`;
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
		['amule_stats_download.png', 'Download speed'],
		['amule_stats_upload.png', 'Upload speed'],
		['amule_stats_conncount.png', 'Connections'],
	];
	return html`
	<div class="amule-stats">
		<h5 class="text-center">Statistics</h5>
		<div class="container-fluid bg-light border border-dark rounded amule-list">
			<div class="row p-1 border-bottom border-secondary">
				<div class="col-12 col-lg-6 p-2">
					${graphs.map(([src, label]) => html`
					<div key=${src}>
						${gready && !MOCK
							? html`<img src=${src + '?v=' + tick} class="img-fluid" alt=${label} />`
							: html`<div class="bg-white" style="width:100%;max-width:500px;height:200px"></div>`}
						<p class="mt-2">${label}</p>
					</div>`)}
				</div>
				<div class="col-12 col-lg-6 p-2">
					<ul id="tree" class="list-unstyled">
						${tree
							? Object.entries(tree).map(([k, v]) => html`<${TreeNode} key=${k} name=${k} node=${v} />`)
							: html`<li>Loading…</li>`}
					</ul>
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

	if (!form) return html`<div><h5 class="text-center">Preferences</h5><p class="text-center">Loading…</p></div>`;

	const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
	const apply = (e) => {
		e.preventDefault();
		if (!guard()) return;
		const payload = {};
		Object.keys(form).forEach((k) => { payload[k] = form[k] === undefined ? '' : String(form[k]); });
		apiPost('set_options', payload).then(load).catch(() => {});
	};
	const num = (k, label, extra) => html`
		<div class="col">
			<div class="form-group form-inline">
				<label for=${'pf-' + k} class="mr-1">${label}</label>
				<input type="number" id=${'pf-' + k} class="form-control" disabled=${guest} ...${extra || {}}
					value=${form[k] === undefined ? '' : form[k]} onInput=${(e) => set(k, e.target.value)} />
			</div>
		</div>`;
	const chk = (k, label) => html`
		<div class="col">
			<div class="form-group form-inline form-check form-check-inline custom-control custom-checkbox mr-0">
				<input type="checkbox" id=${'pf-' + k} class="custom-control-input" disabled=${guest}
					checked=${form[k] === '1' || form[k] === 1} onChange=${(e) => set(k, e.target.checked ? '1' : '0')} />
				<label for=${'pf-' + k} class="custom-control-label mr-1">${label}</label>
			</div>
		</div>`;
	const h6 = (t) => html`<div class="col text-center"><h6><strong>${t}</strong></h6></div>`;

	return html`
	<form class="mb-3 amule prefs" onSubmit=${apply}>
		<h5 class="text-center">Preferences</h5>
		<div class="container-fluid bg-light border border-dark rounded amule-list">
			<div class="row row-cols-1 row-cols-lg-2 p-1">
				<div class="col">
					<div class="row row-cols-1 no-gutters">
						${h6('Webserver')}
						${num('autorefresh_time', 'Page refresh interval')}
						${chk('use_gzip', 'Use gzip compression')}
						${h6('Bandwidth limits')}
						${num('max_down_limit', 'Max download rate')}
						${num('max_up_limit', 'Max upload rate')}
						${num('slot_alloc', 'Slot allocation')}
						${h6('Connection settings')}
						${num('max_conn_total', 'Max total connections (total)')}
						${num('max_file_src', 'Max sources per file')}
						${chk('autoconn_en', 'Autoconnect at startup')}
						${chk('reconn_en', 'Reconnect when connection lost')}
						${h6('Network settings')}
						${num('tcp_port', 'TCP port', { min: 1, max: 65535 })}
						${num('udp_port', 'UDP port', { min: 1, max: 65535 })}
						${chk('udp_dis', 'Disable UDP connections')}
					</div>
				</div>
				<div class="col">
					<div class="row row-cols-1 no-gutters">
						${h6('Line capacity (for statistics only)')}
						${num('max_line_down_cap', 'Max download rate')}
						${num('max_line_up_cap', 'Max upload rate')}
						${h6('File settings')}
						${chk('check_free_space', 'Check free space => Minimum free space (Mb)')}
						${num('min_free_space', 'Minimum free space (Mb)')}
						${chk('new_files_auto_dl_prio', 'Added download files have auto priority')}
						${chk('new_files_auto_ul_prio', 'New shared files have auto priority')}
						${chk('ich_en', 'I.C.H. active')}
						${chk('aich_trust', 'AICH trusts every hash (not recommended)')}
						${chk('alloc_full_chunks', 'Alloc full chunks of .part files')}
						${chk('alloc_full', 'Alloc full disk space for .part files')}
						${chk('new_files_paused', 'Add files to download queue in pause mode')}
						${chk('extract_metadata', 'Extract metadata tags')}
					</div>
				</div>
			</div>
			<div class="row p-1">
				<div class="col">
					${guest
						? html`<p class="text-center"><strong>You can not change options - logged in as guest</strong></p>`
						: html`<button type="submit" class="btn btn-primary btn-block">Apply</button>`}
				</div>
			</div>
		</div>
	</form>`;
}

/* ==================================================================== */
/* AMULE LOG                                                            */
/* ==================================================================== */

function LogView({ status }) {
	const [log, setLog] = useState('');
	const [srv, setSrv] = useState('');
	const guest = !!(status && status.guest);
	const loadLog = useCallback((reset) => apiText('log', reset ? { reset: 1 } : {}).then(setLog).catch(() => {}), []);
	const loadSrv = useCallback((reset) => apiText('serverinfo', reset ? { reset: 1 } : {}).then(setSrv).catch(() => {}), []);
	useEffect(() => { loadLog(); loadSrv(); }, [loadLog, loadSrv]);
	return html`
	<div>
		<h5 class="text-center">Log</h5>
		<div class="container-fluid bg-light border border-dark rounded amule-list">
			<div class="row p-1 border-bottom border-dark">
				<div class="col-auto"><h5><strong>aMule log</strong></h5></div>
				${!guest ? html`<div class="col-auto">
					<a href="#log" onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to reset aMule log?')) loadLog(1); }}>(Reset)</a>
				</div>` : ''}
			</div>
			<div class="row p-1 border-bottom border-dark">
				<div class="col"><pre>${log || ' '}</pre></div>
			</div>
			<div class="row p-1 border-bottom border-dark">
				<div class="col-auto"><h5><strong>Serverinfo</strong></h5></div>
				${!guest ? html`<div class="col-auto">
					<a href="#log" onClick=${(e) => { e.preventDefault(); if (confirm('Do you really want to reset Serverinfo?')) loadSrv(1); }}>(Reset)</a>
				</div>` : ''}
			</div>
			<div class="row p-1 border-bottom border-dark">
				<div class="col"><pre>${srv || ' '}</pre></div>
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
	else if (view === 'log') body = html`<${LogView} status=${status} />`;

	return html`
	<div>
		<${Navbar} view=${view} go=${go} />
		<main role="main" class="m-2">${body}</main>
		<${Footer} status=${status} guard=${guard} />
	</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
