#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
"""Tiny static-file + EC-proxy server for the ec-mobile prototype.

Browsers cannot speak aMule's binary EC protocol over a raw TCP socket, so
this minimal proxy bridges the gap:

* it serves the static front end (``static/index.html`` + ``app.js`` +
  ``app.css``), and
* it exposes a small JSON API under ``/api/*`` that talks to aMule through
  the vendored, pure-stdlib ``jamule`` EC client (a copy of the client from
  https://github.com/atallo/amarr).

Only the Python standard library is used (``http.server``), so it runs with
just ``python server.py`` — no pip install, no framework.

Configuration (environment variables):

    AMULE_HOST       aMule EC host           (default 127.0.0.1)
    AMULE_PORT       aMule EC port           (default 4712)
    AMULE_PASSWORD   aMule EC password       (default empty)
    BIND_HOST        proxy bind address      (default 127.0.0.1)
    BIND_PORT        proxy port              (default 8089)
    AMULE_MOCK       1/true -> serve canned data without touching aMule

aMule's EC core is single-connection; every EC call is serialized behind a
lock so the threaded HTTP server can serve static files concurrently while
EC requests queue up one at a time. The jamule client targets aMule
2.3.1-2.3.3 (see README).
"""
from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from jamule.client import AmuleClient
from jamule.model import DownloadCommand
from jamule.request import SearchFilters, SearchType

STATIC_DIR = Path(__file__).parent / "static"

AMULE_HOST = os.environ.get("AMULE_HOST", "127.0.0.1")
AMULE_PORT = int(os.environ.get("AMULE_PORT", "4712"))
AMULE_PASSWORD = os.environ.get("AMULE_PASSWORD", "")
BIND_HOST = os.environ.get("BIND_HOST", "127.0.0.1")
BIND_PORT = int(os.environ.get("BIND_PORT", "8089"))
MOCK = os.environ.get("AMULE_MOCK", "").lower() in ("1", "true", "yes")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".json": "application/json",
}

# ---------------------------------------------------------------------------
# EC client (lazy, single-flight)
# ---------------------------------------------------------------------------

_client: AmuleClient | None = None
_lock = threading.Lock()


def get_client() -> AmuleClient:
    """Return the shared client, connecting (and reconnecting) on demand."""
    global _client
    if _client is None:
        _client = AmuleClient.connect(
            AMULE_HOST, AMULE_PORT, AMULE_PASSWORD, timeout=10
        )
    return _client


SEARCH_TYPES = {
    "global": SearchType.GLOBAL,
    "kad": SearchType.KAD,
    "local": SearchType.LOCAL,
}
DOWNLOAD_COMMANDS = {
    "pause": DownloadCommand.PAUSE,
    "resume": DownloadCommand.RESUME,
    "stop": DownloadCommand.STOP,
    "cancel": DownloadCommand.DELETE,
    "delete": DownloadCommand.DELETE,
}

STATUS_NAMES = {
    0: "Ready", 1: "Empty", 2: "Waiting for hash", 3: "Hashing", 4: "Error",
    5: "Insufficient", 6: "Unknown", 7: "Paused", 8: "Completing",
    9: "Complete", 10: "Allocating",
}

# ---------------------------------------------------------------------------
# Serializers (domain objects -> plain dicts for JSON)
# ---------------------------------------------------------------------------


def part_file_to_dict(f) -> dict:
    done = f.size_done or 0
    size = f.size_full or 0
    return {
        "hash": f.file_hash_hex_string,
        "name": f.file_name,
        "size": size,
        "size_done": done,
        "size_xfer": f.size_xfer or 0,
        "progress": round(done * 100.0 / size, 2) if size else 0,
        "speed": f.speed or 0,
        "status": f.file_status.value,
        "status_name": "Paused" if f.stopped else STATUS_NAMES.get(f.file_status.value, "Unknown"),
        "stopped": f.stopped,
        "src_count": f.source_count,
        "src_xfer": f.source_xfer_count,
        "src_a4af": f.source_count_a4af,
        "prio": f.down_prio,
        "category": f.file_cat,
        "ed2k_link": f.file_ed2k_link,
    }


def shared_file_to_dict(f) -> dict:
    return {
        "hash": f.file_hash_hex_string,
        "name": f.file_name,
        "size": f.size_full or 0,
        "prio": f.up_prio,
        "requests": f.get_requests,
        "requests_all": f.get_all_requests,
        "accepts": f.get_accepts,
        "accepts_all": f.get_all_accepts,
        "xferred": f.get_xferred,
        "xferred_all": f.get_all_xferred,
        "complete_sources": f.get_complete_sources,
        "ed2k_link": f.file_ed2k_link,
    }


def search_file_to_dict(f) -> dict:
    return {
        "hash": f.hash.hex(),
        "name": f.file_name,
        "size": f.size_full,
        "sources": f.source_count,
        "complete_sources": f.complete_source_count,
        "status": f.download_status.name,
    }


def stats_to_dict(s) -> dict:
    cs = s.connection_state
    server = None
    if cs is not None and cs.server_ipv4 is not None:
        server = {
            "addr": f"{cs.server_ipv4.address}:{cs.server_ipv4.port}",
            "name": cs.server_description,
            "users": cs.server_users,
            "files": cs.server_files,
            "version": cs.server_version,
            "ping": cs.server_ping,
        }
    return {
        "ed2k": {
            "connected": bool(cs and cs.ed2k_connected),
            "connecting": bool(cs and cs.ed2k_connecting),
            "id": cs.ed2k_id if cs else None,
            "lowid": bool(cs and cs.ed2k_id is not None and cs.ed2k_id < 16777216),
            "server": server,
        },
        "kad": {
            "connected": bool(cs and cs.kad_connected),
            "firewalled": bool(cs and cs.kad_firewalled),
            "running": bool(cs and cs.kad_running),
            "nodes": s.kad_nodes,
        },
        "speed": {
            "down": s.download_speed,
            "up": s.upload_speed,
            "down_limit": s.download_speed_limit,
            "up_limit": s.upload_speed_limit,
        },
        "ed2k_users": s.ed2k_users,
        "kad_users": s.kad_users,
        "shared_count": s.shared_file_count,
        "total_down": s.total_received_bytes,
        "total_up": s.total_sent_bytes,
    }


def category_to_dict(c) -> dict:
    return {"id": c.id, "name": c.name, "path": c.path}


# ---------------------------------------------------------------------------
# Mock data (AMULE_MOCK=1) -- lets the UI be exercised without aMule
# ---------------------------------------------------------------------------

MOCK_DOWNLOADS = [
    {"hash": "a" * 32, "name": "Ubuntu 26.04 LTS Desktop amd64.iso", "size": 4900000000,
     "size_done": 3650000000, "size_xfer": 3650000000, "progress": 74.49, "speed": 1280000,
     "status": 0, "status_name": "Downloading", "stopped": False, "src_count": 312,
     "src_xfer": 24, "src_a4af": 8, "prio": 1, "category": 1,
     "ed2k_link": "ed2k://|file|Ubuntu 26.04 LTS Desktop amd64.iso|4900000000|" + "A" * 32 + "|/"},
    {"hash": "b" * 32, "name": "Big Buck Bunny (2008) 1080p.mkv", "size": 1280000000,
     "size_done": 1280000000, "size_xfer": 0, "progress": 100, "speed": 0, "status": 9,
     "status_name": "Complete", "stopped": False, "src_count": 95, "src_xfer": 0,
     "src_a4af": 0, "prio": 2, "category": 2, "ed2k_link": ""},
    {"hash": "c" * 32, "name": "Some.Linux.Distro.netinst.iso", "size": 780000000,
     "size_done": 120000000, "size_xfer": 120000000, "progress": 15.38, "speed": 0,
     "status": 7, "status_name": "Paused", "stopped": True, "src_count": 4, "src_xfer": 0,
     "src_a4af": 0, "prio": 0, "category": 0, "ed2k_link": ""},
]
MOCK_SHARED = [
    {"hash": "e" * 32, "name": "public-domain-album-FLAC.zip", "size": 305180000, "prio": 1,
     "requests": 3, "requests_all": 41, "accepts": 2, "accepts_all": 38, "xferred": 51000000,
     "xferred_all": 920000000, "complete_sources": 12, "ed2k_link": ""},
]
MOCK_RESULTS = [
    {"hash": "1" * 32, "name": "Cosmos.Laundromat.2015.1080p.mkv", "size": 1600000000,
     "sources": 540, "complete_sources": 210, "status": "NEW"},
    {"hash": "2" * 32, "name": "Sintel.2010.1080p.BluRay.mkv", "size": 1100000000,
     "sources": 320, "complete_sources": 95, "status": "QUEUED"},
]
MOCK_CATS = [{"id": 0, "name": "all", "path": ""}, {"id": 1, "name": "ISOs", "path": ""},
             {"id": 2, "name": "Video", "path": ""}]
MOCK_STATUS = {
    "ed2k": {"connected": True, "connecting": False, "id": 81258542, "lowid": False,
             "server": {"addr": "1.2.3.4:4242", "name": "eMule Security No1", "users": 84210,
                        "files": 23400000, "version": "lugdunum", "ping": 42}},
    "kad": {"connected": True, "firewalled": False, "running": True, "nodes": 1024},
    "speed": {"down": 1530000, "up": 48800, "down_limit": 0, "up_limit": 50000},
    "ed2k_users": 84210, "kad_users": 4100000, "shared_count": 1, "total_down": 9_900_000_000,
    "total_up": 1_200_000_000,
}

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


def api_get(path: str, query: dict):
    """Handle a GET /api/<path>. Returns a JSON-serializable object."""
    if path == "status":
        if MOCK:
            return MOCK_STATUS
        with _lock:
            return stats_to_dict(get_client().get_stats())
    if path == "transfers":
        if MOCK:
            return {"downloads": MOCK_DOWNLOADS}
        with _lock:
            return {"downloads": [part_file_to_dict(f) for f in get_client().get_download_queue()]}
    if path == "shared":
        if MOCK:
            return {"shared": MOCK_SHARED}
        with _lock:
            return {"shared": [shared_file_to_dict(f) for f in get_client().get_shared_files()]}
    if path == "categories":
        if MOCK:
            return {"categories": MOCK_CATS}
        with _lock:
            return {"categories": [category_to_dict(c) for c in get_client().get_categories()]}
    if path == "search":
        q = (query.get("q") or [""])[0].strip()
        if not q:
            return {"results": []}
        if MOCK:
            return {"results": MOCK_RESULTS}
        stype = SEARCH_TYPES.get((query.get("type") or ["global"])[0], SearchType.GLOBAL)
        filters = SearchFilters(
            min_size=_int_or_none((query.get("min") or [""])[0]),
            max_size=_int_or_none((query.get("max") or [""])[0]),
        )
        with _lock:
            res = get_client().search_sync(q, stype, filters, timeout=8.0)
        return {"results": [search_file_to_dict(f) for f in res.files]}
    raise KeyError(path)


def api_post(path: str, body: dict):
    """Handle a POST /api/<path>. Returns a JSON-serializable object."""
    if MOCK:
        return {"ok": True, "mock": True}
    if path == "dload":
        cmd = DOWNLOAD_COMMANDS.get(body.get("command", ""))
        if cmd is None:
            return {"ok": False, "error": "unknown command"}
        with _lock:
            get_client().send_download_command(bytes.fromhex(body["hash"]), cmd)
        return {"ok": True}
    if path == "ed2k":
        link = (body.get("link") or "").strip()
        if not link:
            return {"ok": False, "error": "empty link"}
        with _lock:
            get_client().download_ed2k_link(link)
        return {"ok": True}
    if path == "search_download":
        with _lock:
            get_client().download_search_result(bytes.fromhex(body["hash"]))
        return {"ok": True}
    if path == "setcat":
        with _lock:
            get_client().set_file_category(bytes.fromhex(body["hash"]), int(body["cat"]))
        return {"ok": True}
    raise KeyError(path)


def _int_or_none(value: str):
    value = (value or "").strip()
    return int(value) if value.isdigit() else None


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------


class Handler(BaseHTTPRequestHandler):
    server_version = "ec-mobile-proxy/0.1"

    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error_json(self, message, status=502):
        self._send_json({"ok": False, "error": message}, status)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            try:
                self._send_json(api_get(path[len("/api/"):], parse_qs(parsed.query)))
            except KeyError:
                self._send_error_json("unknown endpoint", 404)
            except Exception as exc:  # noqa: BLE001 - report any EC failure to the UI
                self._send_error_json(f"{type(exc).__name__}: {exc}")
            return
        self._serve_static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b""
            body = json.loads(raw or b"{}")
            self._send_json(api_post(path[len("/api/"):], body))
        except KeyError:
            self._send_error_json("unknown endpoint", 404)
        except Exception as exc:  # noqa: BLE001
            self._send_error_json(f"{type(exc).__name__}: {exc}")

    def _serve_static(self, path):
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (STATIC_DIR / rel).resolve()
        # prevent path traversal outside STATIC_DIR
        if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # quieter logging
        pass


def main() -> None:
    mode = "MOCK (no aMule)" if MOCK else f"EC {AMULE_HOST}:{AMULE_PORT}"
    print(f"ec-mobile proxy on http://{BIND_HOST}:{BIND_PORT}  ->  {mode}")
    ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
