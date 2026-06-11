#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
#
# Assemble distributable template directories under ./dist.
#
# A deployable amuleweb template must be a FLAT directory, so each
# dist/<name> bundles:
#   * the template's own files (templates/<name>/*)
#   * the shared service layer (common/api.php)
#   * the front-end runtime (vendor/preact-htm-standalone.module.js)
#
# Run dev/download-deps.sh once before building.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODULE="${ROOT}/vendor/preact-htm-standalone.module.js"

if [ ! -s "${MODULE}" ]; then
	echo "Error: ${MODULE} is missing - run dev/download-deps.sh first." >&2
	exit 1
fi

rm -rf "${ROOT}/dist"

for t in "${ROOT}"/templates/*/; do
	name="$(basename "${t}")"
	out="${ROOT}/dist/${name}"
	mkdir -p "${out}"
	cp "${t}"* "${out}/"
	cp "${ROOT}/common/api.php" "${out}/"
	cp "${MODULE}" "${out}/"
	echo "dist/${name} ready"
done
