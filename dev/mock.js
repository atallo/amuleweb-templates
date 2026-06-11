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
 * mock.js -- canned data so the UI can be developed and previewed without a
 * running aMule / amuleweb. Loaded by dev/index.html before app.js; it installs
 * window.AMULE_MOCK, which app.js uses instead of talking to api.php.
 *
 * This file is a development aid only and is NOT part of the distributed skin.
 */
(function () {
	const cats = ['all', 'Movies', 'Music', 'Software'];

	const downloads = [
		{ hash: 'a'.repeat(32), name: 'Ubuntu 26.04 LTS Desktop amd64.iso', size: 4900000000, size_done: 3650000000, size_xfer: 3650000000, speed: 1280000, src_count: 312, src_count_xfer: 24, src_count_not_curr: 40, src_count_a4af: 8, status: 0, prio: 1, prio_auto: 1, category: 3 },
		{ hash: 'b'.repeat(32), name: 'Big Buck Bunny (2008) 1080p.mkv', size: 1280000000, size_done: 1280000000, size_xfer: 0, speed: 0, src_count: 95, src_count_xfer: 0, src_count_not_curr: 0, src_count_a4af: 0, status: 0, prio: 2, prio_auto: 0, category: 1 },
		{ hash: 'c'.repeat(32), name: 'Some.Linux.Distro.netinst.iso', size: 780000000, size_done: 120000000, size_xfer: 120000000, speed: 0, src_count: 4, src_count_xfer: 0, src_count_not_curr: 1, src_count_a4af: 0, status: 7, prio: 0, prio_auto: 0, category: 0 },
		{ hash: 'd'.repeat(32), name: 'public-domain-album-FLAC.zip', size: 320000000, size_done: 64000000, size_xfer: 64000000, speed: 256000, src_count: 41, src_count_xfer: 6, src_count_not_curr: 5, src_count_a4af: 2, status: 0, prio: 5, prio_auto: 1, category: 2 },
		// Empty name: amuleweb builds with a C-locale container export "" for
		// names with non-ASCII chars; the UI must fall back to the hash.
		{ hash: 'E7A1B2C3D4E5F60718293A4B5C6D7E8F', name: '', size: 1500000000, size_done: 300000000, size_xfer: 300000000, speed: 64000, src_count: 9, src_count_xfer: 2, src_count_not_curr: 1, src_count_a4af: 0, status: 0, prio: 1, prio_auto: 1, category: 0 },
	];
	const uploads = [
		{ name: 'Ubuntu 26.04 LTS Desktop amd64.iso', user_name: 'peer_42', xfer_up: 18000000, xfer_down: 240000, xfer_speed: 92000 },
		{ name: 'Big Buck Bunny (2008) 1080p.mkv', user_name: 'helpful_seeder', xfer_up: 5400000, xfer_down: 0, xfer_speed: 41000 },
	];
	const shared = downloads.map((d, i) => ({
		hash: d.hash, name: d.name, size: d.size,
		xfer: (i + 1) * 12000000, xfer_all: (i + 1) * 80000000,
		req: (i + 1) * 14, req_all: (i + 1) * 110, accept: (i + 1) * 9, accept_all: (i + 1) * 70,
		prio: i % 3, prio_auto: i === 0 ? 1 : 0,
	}));
	const servers = [
		{ name: 'eMule Security No1', desc: 'Welcome', addr: '1.2.3.4:4242', ip: 16909060, port: 4242, users: 84210, maxusers: 120000, files: 23400000 },
		{ name: 'PeerBooter', desc: 'High capacity server', addr: '5.6.7.8:5000', ip: 84281096, port: 5000, users: 51234, maxusers: 80000, files: 15900000 },
		{ name: '', desc: 'Community server', addr: '9.10.11.12:4661', ip: 151653132, port: 4661, users: 9211, maxusers: 20000, files: 2100000 },
	];
	const results = [
		{ hash: '1'.repeat(32), name: 'Cosmos.Laundromat.2015.1080p.mkv', size: 1600000000, sources: 540, present: false },
		{ hash: '2'.repeat(32), name: 'Sintel.2010.1080p.BluRay.mkv', size: 1100000000, sources: 320, present: true },
		{ hash: '3'.repeat(32), name: 'Tears.of.Steel.1080p.mkv', size: 740000000, sources: 180, present: false },
	];
	const options = {
		nick: 'http_user', categories: cats,
		max_line_down_cap: '2000', max_line_up_cap: '300', max_down_limit: '0', max_up_limit: '50', slot_alloc: '2',
		max_conn_total: '500', max_file_src: '300', autoconn_en: '1', reconn_en: '1', network_ed2k: '1', network_kad: '1',
		tcp_port: '4662', udp_port: '4672', udp_dis: '0', check_free_space: '1', min_free_space: '500',
		new_files_auto_dl_prio: '1', new_files_auto_ul_prio: '1', ich_en: '1', aich_trust: '0',
		alloc_full_chunks: '0', alloc_full: '0', new_files_paused: '0', extract_metadata: '0', use_gzip: '1', autorefresh_time: '2',
	};
	const log = '21:00:01 aMule started.\n21:00:03 Connecting to eMule Security No1 (1.2.3.4:4242)...\n21:00:05 Connection established.\n21:00:05 New high ID: 3232235777\n21:00:12 Kademlia: Connected, status: OK';
	const info = 'eMule Security No1 (1.2.3.4:4242)\n  Users: 84210 / 120000\n  Files: 23,400,000';

	let down = 1536000, up = 133000;
	function status() {
		down = Math.max(0, down + (Math.random() - 0.5) * 300000);
		up = Math.max(0, up + (Math.random() - 0.5) * 30000);
		return {
			version: '2.3.3-mock', guest: false, auto_refresh: 2,
			speed_down: Math.round(down), speed_up: Math.round(up), speed_limit_down: 0, speed_limit_up: 50000,
			ed2k: { state: 'connected', lowid: false, server: 'eMule Security No1', addr: '1.2.3.4:4242', users: 84210 },
			kad: { connected: true, firewalled: false }, categories: cats,
		};
	}
	const tree = {
		'Statistics': {
			'Transfer': { 'Uploads: 1,204': null, 'Downloads: 8,640': null, 'Active uploads: 2': null },
			'Connection': { 'Reconnects: 3': null, 'Active connections: 128': null },
			'Clients': { 'Total: 412': { 'aMule: 120': null, 'eMule: 270': null, 'Other: 22': null } },
		},
		'Kad': { 'Contacts: 1,024': null, 'Indexed keywords: 5,210': null },
	};

	const GET = {
		status, options: () => options,
		transfers: () => ({ downloads, uploads }), shared: () => ({ shared }), servers: () => ({ servers }), search: () => ({ results }),
		statstree: () => tree, statsgraph: () => ({ ok: true }),
	};
	window.AMULE_MOCK = {
		get(route) { const f = GET[route]; return Promise.resolve(f ? f() : {}); },
		post(route, params) { console.log('[mock] POST', route, params); return Promise.resolve({ ok: true }); },
		// log/serverinfo are plain-text routes in the real API
		text(route) { return Promise.resolve(route === 'serverinfo' ? info : log); },
	};
})();
