# dev/ — development tools (not distributed)

Nothing in this folder ships with the templates.

## Fetch the front-end dependency

The UI uses Preact + HTM as a single pre-bundled ES module that is **not**
committed. Fetch it once after checkout (re-run to update):

```sh
sh dev/download-deps.sh          # Linux / macOS (curl or wget)
```
```powershell
dev\download-deps.ps1            # Windows
```

It is stored in `vendor/` and mirrored into every `templates/<name>/`
directory (deployable templates must be flat).

## Preview a template without aMule (mock mode)

`mock.js` provides canned data so the whole interface is browsable offline.
Serve the **repository root** with any static file server and open this
folder:

```sh
python3 -m http.server 8080
# → http://localhost:8080/dev/
# → http://localhost:8080/dev/?template=<name>   (default: simple)
# → add #stats, #search, ... to open a specific view
```

Everything works against the mock — tabs, sorting, filtering, settings —
except the server-rendered images (chunk bars fall back to CSS bars, graphs
show a placeholder).

## Building

`scripts/build.sh` (or `scripts\build.ps1`) assembles each template plus
`common/api.php` plus the JS runtime into a flat, installable directory
under `dist/`.
