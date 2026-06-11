# amuleweb-templates

Modern, minimalist web templates (skins) for [aMule](https://www.amule.org)'s
built-in web server, **amuleweb**.

Instead of the classic server-side-rendered pages, these templates use a
decoupled architecture:

* **[`common/api.php`](common/api.php)** — a thin **JSON service layer** that
  runs inside amuleweb's embedded PHP interpreter and only emits data. It is
  shared by every template in this repository.
* **One single-page app per template** (Preact + HTM, no build step) that
  consumes the API over `fetch` and renders everything client-side.
* **No bundled images** beyond the aMule logo — icons are inline SVG, and the
  chunk progress bars / statistics graphs are PNGs rendered by amuleweb
  itself, exactly like the stock template.

| Template | Description |
|----------|-------------|
| [`simple`](templates/simple) | Clean, minimalist UI. Light + dark theme, responsive (desktop → phone), live polling. |
| [`amule-default`](templates/amule-default) | Faithful reproduction of aMule's stock web template look, rebuilt on the same API; light mobile support. |

![simple](docs/screenshots/simple-transfers.png)

![amule-default](docs/screenshots/amule-default-transfers.png)

More screenshots in [docs/screenshots](docs/screenshots).

## Features (template `simple`)

* Transfers: chunk-level progress bars, pause / resume / cancel / priority,
  status & category filters, add ed2k links, totals.
* Search (local / global / Kad) with size & availability filters; queue
  results into any category.
* Shared files: reload, priorities, transfer statistics.
* Servers: connect / remove / add, live user & file counts.
* Kad: connect / disconnect / bootstrap, nodes.dat update, nodes graph.
* Statistics: aMule's own speed & connection graphs plus the full collapsible
  statistics tree.
* Settings: bandwidth limits, connection, ports, files, web server.
* Log & server info, with reset.
* Auto-refresh with a single serialized request queue (amuleweb is
  single-threaded), mobile navigation, automatic dark mode.

## Compatibility

Tested with **aMule 3.0** running in ngosang's fantastic
[docker-amule](https://github.com/ngosang/docker-amule) container. Any
reasonably recent amuleweb build should work the same way.

## Installation

### From a release zip

1. Download `amuleweb-template-<name>-vX.Y.Z.zip` from the
   [releases page](https://github.com/atallo/amuleweb-templates/releases)
   and unzip it. You get one flat directory, e.g. `simple/`.
2. Copy that directory into one of amuleweb's template search paths:
   * `~/.aMule/webserver/<name>` (per-user), or
   * `<prefix>/share/amule/webserver/<name>` (system-wide, often
     `/usr/share/amule/webserver/<name>`).
3. Select it, either with `amuleweb --template=<name>` or in `amule.conf`:

   ```ini
   [WebServer]
   Template=simple
   ```

   and restart amuleweb (or the aMule daemon that spawns it).

Docker users can mount the directory instead, e.g.:

```yaml
volumes:
  - ./simple:/usr/share/amule/webserver/simple:ro
```

### From source

```sh
git clone https://github.com/atallo/amuleweb-templates.git
cd amuleweb-templates
sh dev/download-deps.sh      # fetches the Preact+HTM runtime (not committed)
sh scripts/build.sh          # assembles flat template dirs under ./dist
```

(Windows: `dev\download-deps.ps1` and `scripts\build.ps1`.)

Then install `dist/<name>` as in the previous section.

## HTTPS and PWA (recommended)

amuleweb only speaks plain HTTP. Putting it behind a reverse proxy that
terminates **HTTPS** (Caddy, nginx, Traefik, …) is recommended: you get
TLS for your password, and — since both templates ship a web manifest —
a secure origin lets you **install the interface as a PWA** on your phone
or desktop (add to home screen) for an app-like, full-screen experience.

Minimal Caddy example:

```caddyfile
amule.example.com {
    reverse_proxy 192.168.1.10:4711
}
```

## How it works

amuleweb's embedded PHP dialect is tiny (no `json_encode`, no `include`, only
a handful of builtins with several sharp edges — they are documented in the
comments of [`common/api.php`](common/api.php)). The API builds JSON by hand
and exposes:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `status` | connection/speed summary, categories, guest flag |
| GET | `transfers` | downloads + uploads |
| GET | `shared` / `servers` / `search` | list data |
| GET | `options` | preferences (flattened) |
| GET | `statstree` | statistics tree (nested JSON) |
| GET | `statsgraph` | registers the server-rendered graph PNGs |
| GET | `log` / `serverinfo` | plain text (`&reset=1` to clear) |
| POST | `dload_cmd` / `shared_cmd` | pause/resume/cancel/priority, reload |
| POST | `ed2k` / `search_start` / `search_download` | add downloads, search |
| POST | `server_cmd` / `server_add` / `server_disconnect` | ed2k servers |
| POST | `kad` / `set_options` | Kad network, preferences |

Two visuals are rendered by amuleweb itself: per-download chunk bars
(`dyn_<HASH>.png`) and the statistics/Kad graphs (`amule_stats_*.png`).

## Development

Preview any template in a browser with canned data — no aMule needed:

```sh
python3 -m http.server 8080        # from the repository root
# → http://localhost:8080/dev/                  (template "simple")
# → http://localhost:8080/dev/?template=NAME    (any other template)
# → append #search, #stats, ... to open a specific view
```

Run `dev/download-deps.*` first so each template has its JS runtime.

## Adding a new template

1. Copy `templates/simple` to `templates/<newname>` and restyle/rewrite the
   front end at will — `app.js`, `app.css`, `index.html`, `login.php`.
2. Keep the directory **flat** (amuleweb cannot serve sub-folders) and keep
   talking to the shared [`common/api.php`](common/api.php); extend the API
   there if a new view needs more data, so every template benefits.
3. `login.php` must be fully self-contained (inline CSS): amuleweb only
   serves images to a not-yet-authenticated client.
4. The build and release scripts pick up any directory under `templates/`
   automatically.

## Releases

Pushing a tag like `v1.2.0` triggers the
[release workflow](.github/workflows/release.yml), which builds every
template and attaches to the GitHub release:

* `amuleweb-template-<name>-vX.Y.Z.zip` — one zip per template, if you are
  only interested in a single skin;
* `amuleweb-templates-bundle-vX.Y.Z.zip` — every template in one file.

```sh
git tag v1.2.0
git push origin v1.2.0
```

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
The aMule logo belongs to the [aMule project](https://www.amule.org) (GPL).
