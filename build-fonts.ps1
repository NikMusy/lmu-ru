# Пересобирает растровые шрифты движка (Core\Shared\SpriteFonts) с кириллицей.
#
# Используется MakeSpriteFont.exe — штатная утилита DirectX Tool Kit, которую Studio 397
# оставила в самой игре вместе с BuildAll.bat. Параметры оригинальных файлов восстановлены
# точно: пересборка без кириллицы даёт файлы, побайтово идентичные оригиналам.
#
# ARIAL / CONSOLAS / TAHOMA собираются из тех же системных шрифтов, что и в оригинале.
# Шрифта "LMU" (основной шрифт HUD) в системе нет, поэтому берётся ближайший по метрикам —
# Franklin Gothic Medium (расхождение пропорций 3%, определено скриптом tools\idfont.js).

[CmdletBinding()]
param(
  # Пусто — путь ищется сам: LMU_PATH, библиотеки Steam, обычные места
  [string]$GamePath = "",
  [string]$OutDir   = "$PSScriptRoot\build\SpriteFonts",
  # Чем заменить недоступный шрифт HUD
  [string]$HudFont  = "Franklin Gothic Medium",
  # Диапазон кириллицы: базовая + Ё/ё + украинские/белорусские буквы
  [string]$CyrRange = "0x400-0x45f"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\game-path.ps1")
$GamePath = Find-LmuPath $GamePath
$MK = Join-Path $GamePath "Core\Shared\SpriteFonts\MakeSpriteFont.exe"
if (-not (Test-Path $MK)) { throw "не найден MakeSpriteFont.exe: $MK" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Push-Location $OutDir

# семейство -> исходный шрифт, диапазон символов, формат текстуры, символ-заглушка
$families = @(
  @{ prefix = "ARIAL";    font = "Arial";    region = "0x20-0x7e"; fmt = $null;    def = $null; plain = 1..100; bold = 1..130 }
  @{ prefix = "CONSOLAS"; font = "Consolas"; region = "0x20-0x7e"; fmt = $null;    def = $null; plain = 1..100; bold = 1..100 }
  @{ prefix = "TAHOMA";   font = "Tahoma";   region = "0x20-0x7e"; fmt = $null;    def = $null; plain = 1..100; bold = 1..100 }
  @{ prefix = "LMU";      font = $HudFont;   region = "0x20-0xff"; fmt = "Rgba32"; def = 63;
     plain = @(12, 14, 15, 17, 25, 28); bold = @(22, 24, 38, 80, 85) }
)

$total = ($families | ForEach-Object { $_.plain.Count + $_.bold.Count } | Measure-Object -Sum).Sum
Write-Host "Пересборка $total файлов шрифтов с кириллицей ($CyrRange)..." -ForegroundColor Cyan
Write-Host "Шрифт HUD: $HudFont`n" -ForegroundColor Gray

$done = 0; $failed = @(); $sw = [Diagnostics.Stopwatch]::StartNew()

foreach ($fam in $families) {
  foreach ($isBold in @($false, $true)) {
    $sizes = if ($isBold) { $fam.bold } else { $fam.plain }
    foreach ($size in $sizes) {
      $name = "$($fam.prefix)_$size" + $(if ($isBold) { "_b" }) + ".spritefont"

      $args = @($fam.font, $name, "/FontSize:$size",
                "/CharacterRegion:$($fam.region)", "/CharacterRegion:$CyrRange")
      if ($isBold)    { $args += "/FontStyle:Bold" }
      if ($fam.fmt)   { $args += "/TextureFormat:$($fam.fmt)" }
      if ($null -ne $fam.def) { $args += "/DefaultCharacter:$($fam.def)" }

      $null = & $MK @args 2>&1
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path $name)) { $failed += $name }

      $done++
      if ($done % 25 -eq 0) {
        $pct = [math]::Round($done * 100 / $total)
        Write-Host ("  {0,3}%  {1}/{2}  ({3:mm\:ss})" -f $pct, $done, $total, $sw.Elapsed) -ForegroundColor DarkGray
      }
    }
  }
}

Pop-Location
$sw.Stop()

$size = [math]::Round((Get-ChildItem $OutDir -Filter *.spritefont | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "`nГотово за $($sw.Elapsed.ToString('mm\:ss')). Файлов: $((Get-ChildItem $OutDir -Filter *.spritefont).Count), объём: $size МБ" -ForegroundColor Green
if ($failed.Count) {
  Write-Host "НЕ СОБРАЛИСЬ ($($failed.Count)):" -ForegroundColor Red
  $failed | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}
