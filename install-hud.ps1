# Русификатор Le Mans Ultimate — слой движка (HUD, MFD, сообщения гонки)
#
# Ставит два набора файлов, оба лежат в игре обычными файлами и не входят
# в подписанные .mas-архивы (см. Core\Shared\shared.mft — там перечислены только .mas):
#   1. Support\Languages\english.dic  — словарь строк движка
#   2. Core\Shared\SpriteFonts\*      — растровые шрифты с кириллицей
#
#   .\install-hud.ps1              установить
#   .\install-hud.ps1 -DeployOnly  установить, не пересобирая шрифты
#   .\uninstall-hud.ps1            откатить

[CmdletBinding()]
param(
  # Пусто — путь ищется сам: LMU_PATH, библиотеки Steam, обычные места
  [string]$GamePath = "",
  [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ROOT "lib\game-path.ps1")
$GamePath = Find-LmuPath $GamePath
$LANGDIR = Join-Path $GamePath "Support\Languages"
$SFDIR   = Join-Path $GamePath "Core\Shared\SpriteFonts"
$BK      = Join-Path $ROOT "backup"

function Fail($m) { Write-Host "`n  ОШИБКА: $m`n" -ForegroundColor Red; exit 1 }
function Ok($m)   { Write-Host "  [ок] $m" -ForegroundColor Green }
function Info($m) { Write-Host "  $m" -ForegroundColor Gray }

Write-Host "`n=== Русификатор LMU: HUD и сообщения движка ===`n" -ForegroundColor Cyan

Info "игра: $GamePath"
if (-not (Test-Path $LANGDIR)) { Fail "не найдено $LANGDIR" }
if (-not (Test-Path $SFDIR))   { Fail "не найдено $SFDIR" }
if (Get-Process -Name "Le Mans Ultimate" -ErrorAction SilentlyContinue) { Fail "игра запущена — закройте её и повторите" }
if (-not (Test-Path (Join-Path $ROOT "build\russian.dic"))) { Fail "нет build\russian.dic — запустите: node merge-dic.js" }

# --- пересборка шрифтов ---
$sfBuild = Join-Path $ROOT "build\SpriteFonts"
if (-not $DeployOnly) {
  $expected = 641
  $have = if (Test-Path $sfBuild) { (Get-ChildItem $sfBuild -Filter *.spritefont).Count } else { 0 }
  if ($have -lt $expected) {
    Info "шрифты ещё не собраны ($have из $expected) — запускаю сборку, это несколько минут..."
    & (Join-Path $ROOT "build-fonts.ps1") -GamePath $GamePath
    if ($LASTEXITCODE -ne 0) { Fail "сборка шрифтов не удалась" }
  } else {
    Ok "шрифты уже собраны ($have файлов)"
  }
}
if (-not (Test-Path $sfBuild)) { Fail "нет собранных шрифтов — запустите .\build-fonts.ps1" }

# --- бэкапы ---
New-Item -ItemType Directory -Force -Path $BK | Out-Null

$dicBk = Join-Path $BK "english.dic.original"
if (-not (Test-Path $dicBk)) {
  Copy-Item (Join-Path $LANGDIR "english.dic") $dicBk -Force
  Ok "бэкап: backup\english.dic.original"
} else { Ok "бэкап словаря уже есть" }

$sfBk = Join-Path $BK "SpriteFonts.original"
if (-not (Test-Path $sfBk)) {
  Info "создаю резервную копию папки SpriteFonts..."
  New-Item -ItemType Directory -Force -Path $sfBk | Out-Null
  Copy-Item "$SFDIR\*.spritefont" $sfBk -Force
  Ok "бэкап: backup\SpriteFonts.original ($((Get-ChildItem $sfBk).Count) файлов)"
} else { Ok "бэкап шрифтов уже есть ($((Get-ChildItem $sfBk).Count) файлов)" }

# --- установка ---
# Язык игры в Steam — английский, поэтому движок читает english.dic.
# russian.dic кладём тоже: он подхватится, если язык переключат на русский.
Copy-Item (Join-Path $ROOT "build\russian.dic") (Join-Path $LANGDIR "english.dic") -Force
Copy-Item (Join-Path $ROOT "build\russian.dic") (Join-Path $LANGDIR "russian.dic") -Force
$lines = (Get-Content (Join-Path $LANGDIR "english.dic") | Where-Object { $_ -match '^"' }).Count
Ok "словарь движка установлен ($lines строк)"

$n = 0
Get-ChildItem $sfBuild -Filter *.spritefont | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $SFDIR $_.Name) -Force
  $n++
}
$mb = [math]::Round((Get-ChildItem $SFDIR -Filter *.spritefont | Measure-Object Length -Sum).Sum / 1MB)
Ok "шрифты с кириллицей установлены ($n файлов, $mb МБ)"

Write-Host "`n  ГОТОВО.`n" -ForegroundColor Green
Write-Host "  Теперь на русском и внутриигровой слой: HUD, MFD (меню боксов)," -ForegroundColor White
Write-Host "  сообщения о флагах и штрафах, подсказки споттера.`n" -ForegroundColor White
Write-Host "  Откат:  .\uninstall-hud.ps1" -ForegroundColor DarkGray
