<#
    SPDX-License-Identifier: GPL-3.0-or-later
    Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)

    Assemble distributable template directories under ..\dist (Windows
    counterpart of build.sh). Each dist\<name> bundles the template's files,
    the shared common\api.php and the Preact+HTM runtime, as a flat directory
    ready to be copied into amuleweb's template path.

    Run dev\download-deps.ps1 once before building.
#>

$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent
$Module = Join-Path $Root 'vendor\preact-htm-standalone.module.js'

if (-not (Test-Path $Module) -or (Get-Item $Module).Length -eq 0) {
    throw "vendor module missing - run dev\download-deps.ps1 first."
}

$Dist = Join-Path $Root 'dist'
if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }

Get-ChildItem (Join-Path $Root 'templates') -Directory | ForEach-Object {
    $out = Join-Path $Dist $_.Name
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    Copy-Item (Join-Path $_.FullName '*') $out -Force
    Copy-Item (Join-Path $Root 'common\api.php') $out -Force
    Copy-Item $Module $out -Force
    Write-Host "dist\$($_.Name) ready"
}
