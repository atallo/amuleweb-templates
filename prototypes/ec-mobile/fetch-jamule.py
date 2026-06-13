#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
"""Re-vendor the ``jamule`` EC client from the amarr repository.

``jamule/`` in this folder is a vendored copy of the pure-stdlib aMule EC
client from https://github.com/atallo/amarr (MIT). It is committed so the
prototype runs with just ``python server.py`` (no pip install). Run this
script to refresh that copy from upstream:

    python fetch-jamule.py
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/atallo/amarr/main/amarr/jamule"
FILES = [
    "__init__.py", "client.py", "connection.py", "exceptions.py", "model.py",
    "password.py", "request.py", "response.py",
    "ec/__init__.py", "ec/codes.py", "ec/encoding.py", "ec/packet.py", "ec/tag.py",
]

dest = Path(__file__).parent / "jamule"


def main() -> None:
    for rel in FILES:
        url = f"{BASE}/{rel}"
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as resp:  # noqa: S310 - fixed trusted URL
            out.write_bytes(resp.read())
        print(f"  {rel}")
    print(f"Vendored {len(FILES)} files into {dest}/")


if __name__ == "__main__":
    main()
