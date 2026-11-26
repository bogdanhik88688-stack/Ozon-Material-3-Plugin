<#
.SYNOPSIS
  Builds ready-to-install browser extension packages for Chromium browsers
  (Chrome, Edge, Yandex, Opera, Brave, Vivaldi, Arc) and Mozilla Firefox.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root 'dist'
$chromiumDir = Join-Path $dist 'chromium'
$firefoxDir = Join-Path $dist 'firefox'

if (Test-Path $dist) {
  Remove-Item -Recurse -Force $dist
}
New-Item -ItemType Directory -Force -Path $chromiumDir, $firefoxDir | Out-Null

$folders = @('icons', 'popup', 'rules', 'src')
foreach ($target in @($chromiumDir, $firefoxDir)) {
  foreach ($f in $folders) {
    Copy-Item -Recurse -Force (Join-Path $root $f) (Join-Path $target $f)
  }
}

Copy-Item -Force (Join-Path $root 'manifest.json') (Join-Path $chromiumDir 'manifest.json')
Copy-Item -Force (Join-Path $root 'manifest.firefox.json') (Join-Path $firefoxDir 'manifest.json')

$chromiumZip = Join-Path $dist 'ozon-md3-expressive-chromium.zip'
$firefoxZip  = Join-Path $dist 'ozon-md3-expressive-firefox.zip'

Compress-Archive -Path "$chromiumDir\*" -DestinationPath $chromiumZip -Force
Compress-Archive -Path "$firefoxDir\*"  -DestinationPath $firefoxZip  -Force

Write-Host "Built:"
Write-Host "  Chromium (unpacked): $chromiumDir"
Write-Host "  Chromium (.zip):     $chromiumZip"
Write-Host "  Firefox  (unpacked): $firefoxDir"
Write-Host "  Firefox  (.zip):     $firefoxZip"
