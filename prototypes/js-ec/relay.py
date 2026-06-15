#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
"""Minimal WebSocket <-> TCP relay for the js-ec prototype.

The whole point of this prototype is that the **EC protocol is implemented in
JavaScript** (see ./ec). The only thing a browser cannot do is open a raw TCP
socket to aMule's EC port, so this tiny relay bridges that one gap and nothing
else: it is a dumb byte pipe that knows *nothing* about EC.

* It serves the demo static files (./demo).
* On a WebSocket upgrade at ``/ec`` it opens a TCP connection to aMule's EC
  port and shovels bytes both ways. The JS client does all framing, tags,
  opcodes, password hashing and zlib itself.

Standard library only (no pip, no framework). Configuration via environment:

    AMULE_HOST   aMule EC host   (default 127.0.0.1)
    AMULE_PORT   aMule EC port   (default 4712)
    BIND_HOST    relay address   (default 127.0.0.1)
    BIND_PORT    relay port      (default 8092)
"""
from __future__ import annotations

import base64
import hashlib
import os
import socket
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AMULE_HOST = os.environ.get("AMULE_HOST", "127.0.0.1")
AMULE_PORT = int(os.environ.get("AMULE_PORT", "4712"))
BIND_HOST = os.environ.get("BIND_HOST", "127.0.0.1")
BIND_PORT = int(os.environ.get("BIND_PORT", "8092"))
# served at the prototype root so the demo (/demo/*) can import the library
# modules (/ec/*); "/" maps to the demo's index.html.
STATIC_DIR = Path(__file__).parent

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".ico": "image/x-icon",
    ".json": "application/json",
}


# ---------------------------------------------------------------------------
# WebSocket frame helpers (RFC 6455, the subset we need)
# ---------------------------------------------------------------------------

def _read_exact(rfile, n):
    data = bytearray()
    while len(data) < n:
        chunk = rfile.read(n - len(data))
        if not chunk:
            raise ConnectionError("client closed")
        data.extend(chunk)
    return bytes(data)


def ws_read_message(rfile):
    """Read one (possibly fragmented) message. Returns (opcode, payload)."""
    first_opcode = None
    payload = bytearray()
    while True:
        b1 = _read_exact(rfile, 1)[0]
        b2 = _read_exact(rfile, 1)[0]
        fin = b1 & 0x80
        opcode = b1 & 0x0F
        masked = b2 & 0x80
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack(">H", _read_exact(rfile, 2))[0]
        elif length == 127:
            length = struct.unpack(">Q", _read_exact(rfile, 8))[0]
        mask = _read_exact(rfile, 4) if masked else b"\x00\x00\x00\x00"
        chunk = bytearray(_read_exact(rfile, length))
        if masked:
            for i in range(length):
                chunk[i] ^= mask[i & 3]
        if opcode != 0x0:
            first_opcode = opcode
        payload.extend(chunk)
        if fin:
            return first_opcode, bytes(payload)


def ws_write_frame(wfile, lock, opcode, data):
    header = bytearray([0x80 | opcode])
    n = len(data)
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header.extend(struct.pack(">H", n))
    else:
        header.append(127)
        header.extend(struct.pack(">Q", n))
    with lock:
        wfile.write(header)
        wfile.write(data)
        wfile.flush()


# ---------------------------------------------------------------------------
# HTTP + WebSocket handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path.split("?")[0] == "/ec" and self.headers.get("Upgrade", "").lower() == "websocket":
            self._handle_ws()
        else:
            self._serve_static()

    # --- WebSocket bridge ------------------------------------------------
    def _handle_ws(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.wfile.write(
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            b"Sec-WebSocket-Accept: " + accept.encode() + b"\r\n\r\n"
        )
        self.wfile.flush()
        self.close_connection = True

        try:
            amule = socket.create_connection((AMULE_HOST, AMULE_PORT), timeout=10)
        except OSError as exc:
            ws_write_frame(self.wfile, threading.Lock(), 0x8, b"")  # close
            self.log_error("cannot reach aMule EC at %s:%s (%s)", AMULE_HOST, AMULE_PORT, exc)
            return

        wlock = threading.Lock()
        stop = threading.Event()

        def tcp_to_ws():
            try:
                while not stop.is_set():
                    data = amule.recv(65536)
                    if not data:
                        break
                    ws_write_frame(self.wfile, wlock, 0x2, data)  # binary
            except OSError:
                pass
            finally:
                stop.set()
                try:
                    ws_write_frame(self.wfile, wlock, 0x8, b"")
                except OSError:
                    pass

        t = threading.Thread(target=tcp_to_ws, daemon=True)
        t.start()
        try:
            while not stop.is_set():
                opcode, payload = ws_read_message(self.rfile)
                if opcode == 0x8:  # close
                    break
                if opcode == 0x9:  # ping -> pong
                    ws_write_frame(self.wfile, wlock, 0xA, payload)
                    continue
                if opcode in (0x1, 0x2):  # text/binary -> forward raw bytes to aMule
                    amule.sendall(payload)
        except (OSError, ConnectionError):
            pass
        finally:
            stop.set()
            try:
                amule.close()
            except OSError:
                pass

    # --- static files ----------------------------------------------------
    def _serve_static(self):
        path = self.path.split("?")[0]
        rel = "demo/index.html" if path in ("/", "") else path.lstrip("/")
        target = (STATIC_DIR / rel).resolve()
        if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


def main():
    print(f"js-ec relay on http://{BIND_HOST}:{BIND_PORT}  ->  aMule EC {AMULE_HOST}:{AMULE_PORT}", flush=True)
    print(f"   WebSocket bridge at ws://{BIND_HOST}:{BIND_PORT}/ec", flush=True)
    ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
