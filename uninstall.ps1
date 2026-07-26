# Русификатор Le Mans Ultimate — откат к оригинальному UI.zip

[CmdletBinding()]
param(
  [string]$GamePath = "C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate"
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$UIZIP = Join-Path $GamePath "Bin\UI.zip"
$BACKUP = Join-Path $ROOT "backup\UI.zip.original"

Write-Host "`n=== Откат русификатора ===`n" -ForegroundColor Cyan

if (-not (Test-Path $BACKUP)) {
  Write-Host "  Резервной копии нет: $BACKUP" -ForegroundColor Red
  Write-Host "  Восстановить оригинал можно через Steam: Свойства игры -> Установленные файлы -> Проверить целостность.`n" -ForegroundColor Yellow
  exit 1
}
if (Get-Process -Name "Le Mans Ultimate" -ErrorAction SilentlyContinue) {
  Write-Host "  ОШИБКА: игра запущена — закройте её и повторите`n" -ForegroundColor Red
  exit 1
}

Copy-Item $BACKUP $UIZIP -Force
Write-Host "  [ок] оригинальный UI.zip восстановлен`n" -ForegroundColor Green
