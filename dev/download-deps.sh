#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
#
# Fetch the front-end runtime dependency (Preact + HTM, a single pre-bundled
# ES module). It is intentionally NOT committed. The module is stored in
# ./vendor and mirrored into every template directory, because deployable
# amuleweb templates must be flat (amuleweb cannot serve sub-folders).
#
# Requires curl or wget. Re-run any time to refresh.
set -eu

HTM_VERSION="3.1.1"
URL="https://unpkg.com/htm@${HTM_VERSION}/preact/standalone.module.js"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/vendor/preact-htm-standalone.module.js"
mkdir -p "${ROOT}/vendor"

echo "Downloading Preact + HTM ${HTM_VERSION}"
echo "  from ${URL}"

if command -v curl >/dev/null 2>&1; then
	curl -fSL "${URL}" -o "${OUT}"
elif command -v wget >/dev/null 2>&1; then
	wget -q -O "${OUT}" "${URL}"
else
	echo "Error: neither curl nor wget is available." >&2
	exit 1
fi

if [ ! -s "${OUT}" ]; then
	echo "Error: download produced an empty file." >&2
	exit 1
fi

for t in "${ROOT}"/templates/*/; do
	cp "${OUT}" "${t}preact-htm-standalone.module.js"
	echo "  -> ${t}preact-htm-standalone.module.js"
done

echo "Done."
