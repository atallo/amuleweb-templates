<#
    SPDX-License-Identifier: GPL-3.0-or-later
    Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

    Fetch the front-end runtime dependency (Preact + HTM, a single pre-bundled
    ES module). It is intentionally NOT committed. The module is stored in
    ..\vendor and mirrored into every template directory, because deployable
    amuleweb templates must be flat (amuleweb cannot serve sub-folders).

    Usage:
        powershell -ExecutionPolicy Bypass -File .\download-deps.ps1
#>

$ErrorActionPreference = 'Stop'

$HtmVersion = '3.1.1'
$Url = "https://unpkg.com/htm@$HtmVersion/preact/standalone.module.js"

$Root = Split-Path $PSScriptRoot -Parent
$VendorDir = Join-Path $Root 'vendor'
$Out = Join-Path $VendorDir 'preact-htm-standalone.module.js'

New-Item -ItemType Directory -Force -Path $VendorDir | Out-Null

Write-Host "Downloading Preact + HTM $HtmVersion"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing

if (-not (Test-Path $Out) -or (Get-Item $Out).Length -eq 0) {
    throw "Download produced an empty file."
}

Get-ChildItem (Join-Path $Root 'templates') -Directory | ForEach-Object {
    Copy-Item $Out (Join-Path $_.FullName 'preact-htm-standalone.module.js') -Force
    Write-Host "  -> templates\$($_.Name)\preact-htm-standalone.module.js"
}

Write-Host "Done."
