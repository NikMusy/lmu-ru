# Русификатор Le Mans Ultimate — откат слоя движка (HUD, MFD, словарь)

[CmdletBinding()]
param(
  [string]$GamePath = "C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate"
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$LANGDIR = Join-Path $GamePath "Support\Languages"
$SFDIR   = Join-Path $GamePath "Core\Shared\SpriteFonts"
$BK      = Join-Path $ROOT "backup"

Write-Host "`n=== Откат слоя движка ===`n" -ForegroundColor Cyan

if (Get-Process -Name "Le Mans Ultimate" -ErrorAction SilentlyContinue) {
  Write-Host "  ОШИБКА: игра запущена — закройте её и повторите`n" -ForegroundColor Red; exit 1
}

$dicBk = Join-Path $BK "english.dic.original"
if (Test-Path $dicBk) {
  Copy-Item $dicBk (Join-Path $LANGDIR "english.dic") -Force
  Write-Host "  [ок] english.dic восстановлен" -ForegroundColor Green
} else {
  Write-Host "  ! нет backup\english.dic.original" -ForegroundColor Yellow
}

$ruDic = Join-Path $LANGDIR "russian.dic"
if (Test-Path $ruDic) { Remove-Item $ruDic -Force; Write-Host "  [ок] russian.dic удалён" -ForegroundColor Green }

$sfBk = Join-Path $BK "SpriteFonts.original"
if (Test-Path $sfBk) {
  $n = 0
  Get-ChildItem $sfBk -Filter *.spritefont | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $SFDIR $_.Name) -Force; $n++
  }
  Write-Host "  [ок] шрифты движка восстановлены ($n файлов)" -ForegroundColor Green
} else {
  Write-Host "  ! нет backup\SpriteFonts.original — восстановите через проверку целостности в Steam" -ForegroundColor Yellow
}

Write-Host ""
