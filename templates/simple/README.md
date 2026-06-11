# Template: simple

**Origin:** original design.

A clean, minimalist control panel for amuleweb. Single-page app (Preact +
HTM, no build step) talking to the shared JSON layer
([`common/api.php`](../../common/api.php)).

![Transfers](../../docs/screenshots/simple-transfers.png)

* Light + dark theme (follows the system), responsive down to phones.
* Chunk-level progress bars and statistics graphs rendered by amuleweb
  itself (`dyn_<hash>.png`, `amule_stats_*.png`) with CSS fallbacks.
* Single serialized request queue — amuleweb is single-threaded and is never
  given more than one request at a time.
* Deep-linkable views: `#transfers`, `#search`, `#shared`, `#servers`,
  `#kad`, `#stats`, `#settings`, `#log`.

## Files

```
index.html                       SPA shell (served after login)
login.php                        Password page (self-contained, inline CSS)
app.js                           The whole UI (ES module)
app.css                          Theme (light + dark)
logo.png, favicon.ico            The only bundled images
```

The deployable form of this template also contains `api.php` (copied from
`common/`) and `preact-htm-standalone.module.js` (fetched by
`dev/download-deps.*`); `scripts/build.*` assembles it under `dist/simple`.

## Notes

* Names that the interpreter cannot escape are emitted raw, and rows with an
  empty name fall back to `(unnamed) · <hash>` — see the comments in
  `common/api.php` for the gory details of amuleweb's PHP dialect.
* Guest logins disable every command; the UI reflects it.
