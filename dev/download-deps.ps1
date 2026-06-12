<#
    SPDX-License-Identifier: GPL-3.0-or-later
    Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

    Fetch the front-end runtime dependencies (Windows / PowerShell). They are
    intentionally NOT committed; everything lands in ..\vendor and is then
    mirrored into the template directories that need it (deployable amuleweb
    templates must be flat).

      * Preact + HTM (htm/preact/standalone, single pre-bundled ES module)
        -> every template
      * Onsen UI CSS components (Apache-2.0; themable with the official
        Theme Roller at https://onsen.io/theme-roller/)
        -> templates\mobilemule only
      * Bootstrap CSS (MIT; the version the upstream template shipped)
        -> templates\bootstrap only

    Usage:
        powershell -ExecutionPolicy Bypass -File .\download-deps.ps1
#>

$ErrorActionPreference = 'Stop'

$HtmVersion = '3.1.1'
$OnsenVersion = '2.12.8'
$BootstrapVersion = '4.5.0'

$Root = Split-Path $PSScriptRoot -Parent
$VendorDir = Join-Path $Root 'vendor'
New-Item -ItemType Directory -Force -Path $VendorDir | Out-Null

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Fetch($Url, $Out) {
    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing
    if (-not (Test-Path $Out) -or (Get-Item $Out).Length -eq 0) {
        throw "Download produced an empty file: $Out"
    }
}

# --- Preact + HTM (all templates) -----------------------------------
$Module = Join-Path $VendorDir 'preact-htm-standalone.module.js'
Fetch "https://unpkg.com/htm@$HtmVersion/preact/standalone.module.js" $Module

Get-ChildItem (Join-Path $Root 'templates') -Directory | ForEach-Object {
    Copy-Item $Module (Join-Path $_.FullName 'preact-htm-standalone.module.js') -Force
    Write-Host "  -> templates\$($_.Name)\preact-htm-standalone.module.js"
}

# --- Onsen UI CSS components (mobilemule) ---------------------------
$OnsenLight = Join-Path $VendorDir 'onsen-css-components.min.css'
$OnsenDark = Join-Path $VendorDir 'dark-onsen-css-components.min.css'
Fetch "https://unpkg.com/onsenui@$OnsenVersion/css/onsen-css-components.min.css" $OnsenLight
Fetch "https://unpkg.com/onsenui@$OnsenVersion/css/dark-onsen-css-components.min.css" $OnsenDark

$MobileMule = Join-Path $Root 'templates\mobilemule'
if (Test-Path $MobileMule) {
    Copy-Item $OnsenLight $MobileMule -Force
    Copy-Item $OnsenDark $MobileMule -Force
    Write-Host "  -> templates\mobilemule\{onsen-css-components.min.css, dark-onsen-css-components.min.css}"
}

# --- Bootstrap CSS (bootstrap) ---------------------------------------
$BsCss = Join-Path $VendorDir 'bootstrap.min.css'
$BsReboot = Join-Path $VendorDir 'bootstrap-reboot.min.css'
Fetch "https://unpkg.com/bootstrap@$BootstrapVersion/dist/css/bootstrap.min.css" $BsCss
Fetch "https://unpkg.com/bootstrap@$BootstrapVersion/dist/css/bootstrap-reboot.min.css" $BsReboot

$BootstrapTpl = Join-Path $Root 'templates\bootstrap'
if (Test-Path $BootstrapTpl) {
    Copy-Item $BsCss $BootstrapTpl -Force
    Copy-Item $BsReboot $BootstrapTpl -Force
    Write-Host "  -> templates\bootstrap\{bootstrap.min.css, bootstrap-reboot.min.css}"
}

# --- eMuleModernUI's own Bootswatch build (emodernui) -----------------
# The upstream repository ships the exact Bootswatch "Flatly" 3.1.1 build
# and Glyphicons fonts the template was designed against; fetch those very
# files. The font path is rewritten because deployed templates are flat.
$EmuiRaw = 'https://raw.githubusercontent.com/vincenzo-petronio/eMuleModernUI/master'
$EmuiCss = Join-Path $VendorDir 'emodernui-bootstrap.min.css'
Fetch "$EmuiRaw/css/bootswatch/bootstrap.min.css" $EmuiCss
foreach ($f in @('eot', 'svg', 'ttf', 'woff')) {
    Fetch "$EmuiRaw/fonts/glyphicons-halflings-regular.$f" (Join-Path $VendorDir "glyphicons-halflings-regular.$f")
}

$EmuiTpl = Join-Path $Root 'templates\emodernui'
if (Test-Path $EmuiTpl) {
    # flatten the font path and drop the Google-Fonts @import (no CDN at
    # runtime; Lato falls back to the Helvetica/Arial stack of the same rule)
    $css = (Get-Content $EmuiCss -Raw).Replace('../fonts/', '')
    $css = $css -replace '@import url\("//fonts\.googleapis\.com[^"]*"\);', ''
    $css | Set-Content (Join-Path $EmuiTpl 'bootstrap.min.css') -Encoding UTF8 -NoNewline
    foreach ($f in @('eot', 'svg', 'ttf', 'woff')) {
        Copy-Item (Join-Path $VendorDir "glyphicons-halflings-regular.$f") $EmuiTpl -Force
    }
    Write-Host "  -> templates\emodernui\{bootstrap.min.css, glyphicons fonts}"
}

Write-Host "Done."
