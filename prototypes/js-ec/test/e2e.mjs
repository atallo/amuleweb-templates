/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * End-to-end test: JS AmuleClient -> WebSocket -> relay.py -> mock EC server.
 * Exercises the whole stack (transport, framing, auth handshake, codec).
 * Run via test/run-e2e.sh (which starts the mock + relay).
 */
import { AmuleClient } from '../ec/index.js';

const URL = process.env.EC_WS_URL || 'ws://127.0.0.1:8092/ec';

let rc = 1;
try {
	const c = await AmuleClient.connect(URL, 'any-password');
	const s = await c.getStats();
	const cs = s.connection;
	console.log('auth version :', c.version);
	console.log('ed2k         :', cs.ed2kConnected, 'id', cs.ed2kId);
	console.log('server       :', cs.server && cs.server.name, cs.server && cs.server.address);
	console.log('speeds       :', s.downloadSpeed, '/', s.uploadSpeed);
	console.log('kad nodes    :', s.kadNodes);
	const ok = c.version === '2.3.3-mock'
		&& cs.ed2kConnected === true && cs.ed2kId === 81258542
		&& cs.server.name === 'eMule Security No1' && cs.server.address === '1.2.3.4:4242'
		&& s.downloadSpeed === 1530000 && s.uploadSpeed === 48800 && s.kadNodes === 1024;
	console.log(ok ? '\nE2E PASS' : '\nE2E FAIL');
	c.close();
	rc = ok ? 0 : 1;
} catch (e) {
	console.log('E2E ERROR:', e.message);
	rc = 1;
}
process.exit(rc);
