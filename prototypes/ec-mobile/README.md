# Prototype: ec-mobile

A **tiny, mobile-first** aMule web UI that talks to aMule over its native
binary **EC (External Connection)** protocol — *not* through amuleweb. It is
an experiment, separate from the flat amuleweb templates in this repository
(it needs a small server process, so it is **not** built into the release
zips).

> ⚠️ **Prototype, not yet tested against a live aMule.** The UI and proxy
> are verified end-to-end in **mock mode**; the EC path itself still needs a
> real-core smoke test (see *Status* below).

## Why a proxy?

Browsers cannot open a raw TCP socket and speak aMule's binary EC protocol.
So the prototype keeps as much as possible in **plain HTML + JavaScript**
and adds the smallest possible bridge: a **Python proxy** (`server.py`,
standard library only — `http.server`) that

* serves the static front end (`static/`), and
* exposes a small JSON API under `/api/*` that translates to EC calls.

```
 phone browser  ──HTTP/JSON──▶  server.py (proxy)  ──EC/TCP──▶  aMule core
  static/app.js                 jamule client
```

## The EC client (`jamule/`)

`jamule/` is a **vendored copy** of the pure-standard-library aMule EC
client from [**atallo/amarr**](https://github.com/atallo/amarr) (MIT). It
is committed here so the prototype runs with nothing but Python — no
`pip install`. Refresh it from upstream any time with:

```sh
python fetch-jamule.py
```

Because jamule derives from [jaMule](https://github.com/vexdev/jaMule), it
targets aMule **2.3.1–2.3.3**. Against a newer core the EC protocol version
may need adjusting.

## Run it

```sh
# 1. (optional) point it at your aMule's EC interface
export AMULE_HOST=127.0.0.1     # aMule EC host
export AMULE_PORT=4712          # aMule EC port
export AMULE_PASSWORD=secret    # aMule EC password

# 2. start the proxy (Python 3.10+, no dependencies)
python server.py
#   -> http://127.0.0.1:8089
```

Open `http://127.0.0.1:8089` on your phone (same network) or desktop.

**Mock mode** — explore the UI with canned data, no aMule needed:

```sh
AMULE_MOCK=1 python server.py
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `AMULE_HOST` | `127.0.0.1` | aMule EC host |
| `AMULE_PORT` | `4712` | aMule EC port |
| `AMULE_PASSWORD` | *(empty)* | aMule EC password |
| `BIND_HOST` | `127.0.0.1` | proxy bind address |
| `BIND_PORT` | `8089` | proxy port |
| `AMULE_MOCK` | — | `1` to serve canned data |

> Enable the EC interface in aMule (amule.conf `[ExternalConnect]`
> `AcceptExternalConnections=1`, set `ECPassword`). The EC password is a
> separate setting from the amuleweb password.

## Front end

`static/index.html` + `app.js` + `app.css` — **vanilla JS, no framework,
no build step**. Mobile-first: a bottom tab bar, dark theme, cards. Every
API call goes through a single-flight serialized queue (aMule's EC core is
a single connection) and the active view polls every few seconds.

Views (what jamule's high-level client exposes):

* **Status** — eD2k / Kad connection, the connected server, speeds and
  limits, network counters.
* **Transfers** — the download queue with progress, speed, status, sources
  and category; pause / resume / cancel per file; paste an `ed2k://` link.
* **Shared** — shared files with request / accept / transfer counters.
* **Search** — global / Kad / local search; results mark files already in
  the queue; one-tap download of a result.

## Scope / what's missing

The vendored `AmuleClient` covers status, the download queue (+ commands),
shared files, search and categories. The following are **not** exposed by
that high-level client and would require extending `jamule` with extra EC
opcodes (they are out of scope for this prototype):

* server **list** / connect / add / remove (only the *currently connected*
  server is shown, from stats);
* Kad **connect / disconnect / bootstrap** (only Kad status is shown);
* full **preferences** read/write (only categories are available);
* the **uploads** list and statistics **graphs**.

## Status

* ✅ Proxy, EC-client vendoring and all four views verified in **mock mode**
  (`AMULE_MOCK=1`); layout checked at 375 px (no horizontal overflow).
* ⬜ **Live EC smoke test** against a real aMule core — pending.
* ⬜ Confirm EC protocol compatibility with the target aMule version.

## License

GPL-3.0-or-later, except `jamule/` which is the vendored MIT client from
[atallo/amarr](https://github.com/atallo/amarr).
