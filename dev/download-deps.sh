#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
#
# Fetch the front-end runtime dependencies. They are intentionally NOT
# committed; everything lands in ./vendor and is then mirrored into the
# template directories that need it (deployable amuleweb templates must be
# flat, amuleweb cannot serve sub-folders).
#
#   * Preact + HTM (htm/preact/standalone, a single pre-bundled ES module)
#     -> every template
#   * Onsen UI CSS components (Apache-2.0; themable with the official
#     Theme Roller at https://onsen.io/theme-roller/)
#     -> templates/mobilemule only
#
# Requires curl or wget. Re-run any time to refresh.
set -eu

HTM_VERSION="3.1.1"
ONSEN_VERSION="2.12.8"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "${ROOT}/vendor"

fetch() {
	# fetch <url> <outfile>
	echo "Downloading $1"
	if command -v curl >/dev/null 2>&1; then
		curl -fSL "$1" -o "$2"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$2" "$1"
	else
		echo "Error: neither curl nor wget is available." >&2
		exit 1
	fi
	if [ ! -s "$2" ]; then
		echo "Error: $2 is empty." >&2
		exit 1
	fi
}

# --- Preact + HTM (all templates) -----------------------------------
MODULE="${ROOT}/vendor/preact-htm-standalone.module.js"
fetch "https://unpkg.com/htm@${HTM_VERSION}/preact/standalone.module.js" "${MODULE}"

for t in "${ROOT}"/templates/*/; do
	cp "${MODULE}" "${t}preact-htm-standalone.module.js"
	echo "  -> ${t}preact-htm-standalone.module.js"
done

# --- Onsen UI CSS components (mobilemule) ---------------------------
ONSEN_LIGHT="${ROOT}/vendor/onsen-css-components.min.css"
ONSEN_DARK="${ROOT}/vendor/dark-onsen-css-components.min.css"
fetch "https://unpkg.com/onsenui@${ONSEN_VERSION}/css/onsen-css-components.min.css" "${ONSEN_LIGHT}"
fetch "https://unpkg.com/onsenui@${ONSEN_VERSION}/css/dark-onsen-css-components.min.css" "${ONSEN_DARK}"

if [ -d "${ROOT}/templates/mobilemule" ]; then
	cp "${ONSEN_LIGHT}" "${ROOT}/templates/mobilemule/"
	cp "${ONSEN_DARK}" "${ROOT}/templates/mobilemule/"
	echo "  -> templates/mobilemule/{onsen-css-components.min.css, dark-onsen-css-components.min.css}"
fi

echo "Done."
