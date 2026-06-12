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
#   * Bootstrap CSS (MIT; the version the upstream template shipped)
#     -> templates/bootstrap only
#
# Requires curl or wget. Re-run any time to refresh.
set -eu

HTM_VERSION="3.1.1"
ONSEN_VERSION="2.12.8"
BOOTSTRAP_VERSION="4.5.0"

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

# --- Bootstrap CSS (bootstrap) ---------------------------------------
BS_CSS="${ROOT}/vendor/bootstrap.min.css"
BS_REBOOT="${ROOT}/vendor/bootstrap-reboot.min.css"
fetch "https://unpkg.com/bootstrap@${BOOTSTRAP_VERSION}/dist/css/bootstrap.min.css" "${BS_CSS}"
fetch "https://unpkg.com/bootstrap@${BOOTSTRAP_VERSION}/dist/css/bootstrap-reboot.min.css" "${BS_REBOOT}"

if [ -d "${ROOT}/templates/bootstrap" ]; then
	cp "${BS_CSS}" "${ROOT}/templates/bootstrap/"
	cp "${BS_REBOOT}" "${ROOT}/templates/bootstrap/"
	echo "  -> templates/bootstrap/{bootstrap.min.css, bootstrap-reboot.min.css}"
fi

# --- eMuleModernUI's own Bootswatch build (emodernui) -----------------
# The upstream repository ships the exact Bootswatch "Flatly" 3.1.1 build
# and Glyphicons fonts the template was designed against; fetch those very
# files. The font path is rewritten because deployed templates are flat.
EMUI_RAW="https://raw.githubusercontent.com/vincenzo-petronio/eMuleModernUI/master"
EMUI_CSS="${ROOT}/vendor/emodernui-bootstrap.min.css"
fetch "${EMUI_RAW}/css/bootswatch/bootstrap.min.css" "${EMUI_CSS}"
for f in eot svg ttf woff; do
	fetch "${EMUI_RAW}/fonts/glyphicons-halflings-regular.${f}" \
		"${ROOT}/vendor/glyphicons-halflings-regular.${f}"
done

if [ -d "${ROOT}/templates/emodernui" ]; then
	# flatten the font path and drop the Google-Fonts @import (no CDN at
	# runtime; Lato falls back to the Helvetica/Arial stack of the same rule)
	sed -e 's|\.\./fonts/||g' \
		-e 's|@import url("//fonts.googleapis.com[^"]*");||' \
		"${EMUI_CSS}" > "${ROOT}/templates/emodernui/bootstrap.min.css"
	for f in eot svg ttf woff; do
		cp "${ROOT}/vendor/glyphicons-halflings-regular.${f}" "${ROOT}/templates/emodernui/"
	done
	echo "  -> templates/emodernui/{bootstrap.min.css, glyphicons fonts}"
fi

echo "Done."
