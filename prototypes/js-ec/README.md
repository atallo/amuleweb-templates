# Prototype: js-ec

A **JavaScript implementation of aMule's EC (External Connection) protocol**
that runs in the browser, plus a **minimal** Python relay whose only job is to
work around the one thing a browser cannot do: open a raw TCP socket.

All the protocol logic — packet framing, the tag system, opcodes, the
salt/MD5 authentication handshake, zlib — lives in **`ec/` (pure JavaScript,
no dependencies, no build step)**. The relay is a dumb byte pipe that knows
nothing about EC.

```
 browser  ──WebSocket──▶  relay.py  ──TCP──▶  aMule EC port (4712)
  ec/*.js (the library)    (byte pipe)
```

This is the inverse of the sibling [`ec-mobile`](../ec-mobile) prototype,
where the EC client was in Python and the proxy did the work. Here the
**library is the deliverable** and the proxy is as small as possible.

## The library (`ec/`)

| File | Role |
|------|------|
| `codes.js` | EC enums (opcodes, tag names, tag types, flags) |
| `encoding.js` | integer encoding incl. the UTF-8 "header number" quirk; BigInt for u64 |
| `md5.js` | MD5 + the EC password hash (Web Crypto has no MD5) |
| `tag.js` | the tag system: types, encoder, recursive parser, accessors |
| `packet.js` | `Flags`, `Packet`, `writePacket`, framing + `decodePayload` (zlib via the native `DecompressionStream`) |
| `transport.js` | `WebSocketTransport` — packet framing over a WebSocket |
| `requests.js` | request builders |
| `responses.js` | response parsers + domain models |
| `client.js` | `AmuleClient` — high-level async API |
| `index.js` | barrel |

It is a faithful port of the pure-stdlib Python EC client (`jamule`) from
[atallo/amarr](https://github.com/atallo/amarr), and like it targets aMule
**2.3.1–2.3.3** (`EC_CURRENT_PROTOCOL_VERSION = 0x0204`).

### Usage

```js
import { AmuleClient, SearchType } from './ec/index.js';

const client = await AmuleClient.connect('ws://localhost:8092/ec', 'ECPassword');
const stats = await client.getStats();          // connection, speeds, server, kad
const queue = await client.getDownloadQueue();   // [{ name, sizeDone, speed, ... }]
await client.addEd2kLink('ed2k://|file|...|/');
await client.sendDownloadCommand(hashHex, 'pause');  // pause/resume/cancel
const results = await client.searchSync('ubuntu', SearchType.GLOBAL);
await client.downloadSearchResult(results[0].hash);
```

The codec is also usable standalone (`writePacket` / `frame` / `decodePayload`)
and the transport is swappable — in Node a direct TCP transport could replace
the WebSocket one (the relay exists only for the browser's TCP limitation).

## The relay (`relay.py`)

Standard library only (`http.server`). It:

* serves the demo (`/` → `demo/index.html`) and the library modules (`/ec/*`), and
* on a WebSocket upgrade at `/ec`, opens a TCP connection to aMule and pipes
  bytes both ways. It never parses EC.

```sh
export AMULE_HOST=127.0.0.1   # aMule EC host
export AMULE_PORT=4712        # aMule EC port
export BIND_PORT=8092         # relay / web port
python relay.py
# open http://127.0.0.1:8092 and enter your aMule EC password
```

Enable EC in aMule (`amule.conf` `[ExternalConnect] AcceptExternalConnections=1`,
set `ECPassword`). The EC password is separate from the amuleweb password.

## Demo (`demo/`)

A mobile-first, framework-free UI driven entirely by the JS client: connection
status, the download queue (pause / resume / cancel, paste an ed2k link), and
search (with one-tap download of a result). Dark theme, bottom tab bar.

## Tests

`test/parity.mjs` checks the JS codec **byte-for-byte against the Python
jamule reference** (request encodings, the MD5 password vector, round-trip
parsing, zlib, and a STATS response). `test/e2e.mjs` + `test/mock_ec_server.py`
exercise the **whole stack** (JS client → WebSocket → relay → a mock EC server
built with jamule).

```sh
node test/parity.mjs          # offline codec parity (needs node 20+)
sh test/run-e2e.sh            # full stack against the mock (needs python + node)
```

## Status

* ✅ Codec verified byte-for-byte against the Python `jamule` reference
  (encode, MD5 auth hash, parse, zlib, STATS response).
* ✅ Full stack (client ↔ WebSocket ↔ relay ↔ mock EC) verified in Node and
  in a real browser.
* ⬜ Not yet run against a **real** aMule core — and `jamule` targets aMule
  2.3.1–2.3.3, so a newer core may need protocol-version tweaks.

Out of scope (the high-level client mirrors what `jamule` exposes — server
list/connect, Kad management and full preferences would need extra EC opcodes).

## License

GPL-3.0-or-later, except the protocol design which is ported from
[atallo/amarr](https://github.com/atallo/amarr) (MIT).
