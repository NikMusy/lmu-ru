# Русификатор Le Mans Ultimate
# Правит только Bin\UI.zip: подменяет файлы перевода и четыре шрифта.
# Исполняемые файлы, DLL и любые данные, которые проверяет античит, не трогаются.
#
#   .\install.ps1              собрать и установить
#   .\install.ps1 -BuildOnly   только собрать (можно с запущенной игрой)
#   .\install.ps1 -DeployOnly  только установить готовую сборку
#   .\uninstall.ps1            откатить

[CmdletBinding()]
param(
  [string]$GamePath = "C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate",
  # Шрифт заголовков. bahnschrift = узкий технический (ближе всего к оригинальному Antonio),
  # seguisb = обычный Segoe UI SemiBold, impact = очень узкий и жирный.
  [ValidateSet("bahnschrift", "seguisb", "impact")]
  [string]$HeadingFont = "bahnschrift",
  # Во сколько раз сжать шрифт заголовков по горизонтали. 0.70 приводит ширину
  # Bahnschrift к ширине оригинального Antonio (0.459 против 0.445 em).
  [double]$HeadingScale = 0.70,
  [switch]$BuildOnly,
  [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"
$ROOT   = Split-Path -Parent $MyInvocation.MyCommand.Path
$UIZIP  = Join-Path $GamePath "Bin\UI.zip"
$BACKUP = Join-Path $ROOT "backup\UI.zip.original"
$OUT    = Join-Path $ROOT "build\UI.zip"

function Fail($msg) { Write-Host "`n  ОШИБКА: $msg`n" -ForegroundColor Red; exit 1 }
function Ok($msg)   { Write-Host "  [ок] $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "  $msg" -ForegroundColor Gray }
function GameRunning { [bool](Get-Process -Name "Le Mans Ultimate" -ErrorAction SilentlyContinue) }

Write-Host "`n=== Русификатор Le Mans Ultimate ===`n" -ForegroundColor Cyan
if (-not (Test-Path $UIZIP)) { Fail "не найден $UIZIP`n  Укажите путь: .\install.ps1 -GamePath 'D:\...\Le Mans Ultimate'" }

# ============================ СБОРКА ============================
if (-not $DeployOnly) {

  $need = @("translation.json", "translation.en.json", "setting_descriptions.json", "banners.json", "dlc-widget.json")
  foreach ($f in $need) {
    if (-not (Test-Path (Join-Path $ROOT "build\$f"))) { Fail "нет build\$f — сначала соберите переводы (node merge.js ... ; node build-en.js)" }
  }

  $fontMap = [ordered]@{
    "Heebo-Regular-MSG.ttf"            = "segoeui.ttf"
    "Heebo-SemiBold-MSG.ttf"           = "seguisb.ttf"
    "Antonio-SemiBold-MSG.ttf"         = "$HeadingFont.ttf"
    "Lexend-Black-removed-overlap.ttf" = "seguibl.ttf"
  }
  foreach ($src in $fontMap.Values) {
    if (-not (Test-Path "C:\Windows\Fonts\$src")) { Fail "в системе нет шрифта C:\Windows\Fonts\$src" }
  }

  # Шрифт заголовков сжимаем по горизонтали до ширины оригинального Antonio,
  # иначе заголовки и имена не помещаются в отведённые места. Результат кладём
  # в build\fonts и берём оттуда — сам файл шрифта остаётся на машине пользователя.
  $condensed = Join-Path $ROOT "build\fonts\Antonio-RU.ttf"
  $condenser = Join-Path $ROOT "tools\condense.js"
  if (Test-Path $condenser) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
      New-Item -ItemType Directory -Force -Path (Split-Path $condensed) | Out-Null
      & node $condenser "C:\Windows\Fonts\$($fontMap['Antonio-SemiBold-MSG.ttf'])" $condensed $HeadingScale | Out-Null
      if ($LASTEXITCODE -eq 0 -and (Test-Path $condensed)) {
        Ok "шрифт заголовков сжат по X в $HeadingScale (ширина как у оригинального Antonio)"
      } else { Info "! сжать шрифт не удалось — ставится обычный, заголовки будут шире" }
    } else {
      Write-Host "  ! Node.js не найден." -ForegroundColor Yellow
      Write-Host "    Русификатор поставится, но шрифт заголовков останется широким," -ForegroundColor Yellow
      Write-Host "    и длинные названия местами будут обрезаться." -ForegroundColor Yellow
      Write-Host "    Чтобы этого не было, поставьте Node.js (nodejs.org) и запустите установку заново." -ForegroundColor Yellow
    }
  }

  # Бэкап оригинала. Копировать можно и при запущенной игре — файл открыт только на чтение.
  New-Item -ItemType Directory -Force -Path (Join-Path $ROOT "backup") | Out-Null
  if (-not (Test-Path $BACKUP)) {
    Info "создаю резервную копию оригинального UI.zip (~1 ГБ)..."
    Copy-Item $UIZIP $BACKUP -Force
    Ok "бэкап: backup\UI.zip.original"
  } else {
    Ok "бэкап уже есть"
  }

  # Всегда собираем из оригинала, чтобы повторный запуск не накапливал изменения
  Info "готовлю рабочую копию..."
  Copy-Item $BACKUP $OUT -Force

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::Open($OUT, [System.IO.Compression.ZipArchiveMode]::Update)
  try {
    $index = @{}
    foreach ($e in $zip.Entries) { $index[$e.FullName.Replace('\', '/').ToLower()] = $e }

    function Write-Entry([string]$entryPath, [byte[]]$bytes) {
      $key = $entryPath.Replace('\', '/').ToLower()
      $entry = $index[$key]
      $created = $false
      if ($null -eq $entry) {
        # в этом архиве разделитель каталогов — обратный слэш, повторяем его для новых записей
        $entry = $zip.CreateEntry($entryPath.Replace('/', '\'), [System.IO.Compression.CompressionLevel]::Optimal)
        $index[$key] = $entry
        $created = $true
      }
      $s = $entry.Open()
      try { $s.SetLength(0); $s.Write($bytes, 0, $bytes.Length) } finally { $s.Dispose() }
      return $created
    }

    # 1. Тексты.
    #    en  — рабочий вариант по умолчанию, язык в Steam менять не нужно.
    #    pl, ru — с полными формами множественного числа (один/два/пять), для тех, кто сменит язык.
    $plan = @(
      @{ locale = "en"; file = "translation.json"; source = "translation.en.json" }
      @{ locale = "pl"; file = "translation.json"; source = "translation.json"    }
      @{ locale = "ru"; file = "translation.json"; source = "translation.json"    }
    )
    foreach ($loc in @("en", "pl", "ru")) {
      foreach ($f in @("setting_descriptions.json", "banners.json", "dlc-widget.json")) {
        $plan += @{ locale = $loc; file = $f; source = $f }
      }
    }

    $nText = 0; $nNew = 0
    foreach ($p in $plan) {
      $bytes = [System.IO.File]::ReadAllBytes((Join-Path $ROOT "build\$($p.source)"))
      if (Write-Entry "start/locales/$($p.locale)/$($p.file)" $bytes) { $nNew++ }
      $nText++
    }
    Ok "перевод записан: $nText файлов (локали en, pl, ru; новых записей: $nNew)"

    # 2. Шрифты — в оригинальных нет кириллицы, подменяем системными
    foreach ($target in $fontMap.Keys) {
      # для заголовков берём сжатую версию, если она собралась
      if ($target -eq "Antonio-SemiBold-MSG.ttf" -and (Test-Path $condensed)) {
        $bytes = [System.IO.File]::ReadAllBytes($condensed)
        Info "$target  <-  $($fontMap[$target]) (сжат в $HeadingScale)"
      } else {
        $bytes = [System.IO.File]::ReadAllBytes("C:\Windows\Fonts\$($fontMap[$target])")
        Info "$target  <-  $($fontMap[$target])"
      }
      Write-Entry "start/fonts/$target" $bytes | Out-Null
    }
    Ok "шрифты заменены: $($fontMap.Count)"

    # 3. Правки вёрстки. Русский текст длиннее английского, а замена узкого Antonio
    #    ещё шире — без этого заголовки и вкладки наезжают друг на друга.
    #    Имена css собраны с хешами и меняются между версиями игры, поэтому ищем по маске.
    function Append-Css([string]$pattern, [string]$patchFile, [string]$what) {
      $entry = $zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -match $pattern } | Select-Object -First 1
      if ($null -eq $entry) { Info "! не найден $what ($pattern) — правка вёрстки пропущена"; return }

      $sr = New-Object System.IO.StreamReader($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
      $css = $sr.ReadToEnd(); $sr.Dispose()

      $marker = 'Русская локализация'
      if ($css.Contains($marker)) { Info "$what уже пропатчен"; return }

      $patch = [System.IO.File]::ReadAllText((Join-Path $ROOT $patchFile), [System.Text.Encoding]::UTF8)
      $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($css + "`n`n" + $patch)
      $s = $entry.Open()
      try { $s.SetLength(0); $s.Write($bytes, 0, $bytes.Length) } finally { $s.Dispose() }
      Info "$what пропатчен ($($entry.FullName.Split('\')[-1]))"
    }

    Append-Css 'start/assets/app-.*\.css$'   'src\ui-fixes.css'    'css интерфейса'
    Append-Css 'start/assets/fonts-.*\.css$' 'src\fonts-fixes.css' 'css шрифтов'
    Ok "правки вёрстки применены"

    # 4. Часть надписей выводится в бандле литералом, мимо системы перевода
    #    (children: "Race History"). Через локаль их не достать — правим бандл.
    $patchedJs = Join-Path $ROOT "build\js\app.js"
    $patcher   = Join-Path $ROOT "patch-js.js"

    # если готового пропатченного бандла нет — достаём оригинал из архива и правим
    if (-not (Test-Path $patchedJs) -and (Test-Path $patcher) -and (Get-Command node -ErrorAction SilentlyContinue)) {
      $jsEntry = $zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -match 'start/assets/app-.*\.js$' } | Select-Object -First 1
      if ($jsEntry) {
        New-Item -ItemType Directory -Force -Path (Split-Path $patchedJs) | Out-Null
        $rawJs = Join-Path $ROOT "build\js\app-original.js"
        $sr = New-Object System.IO.StreamReader($jsEntry.Open(), (New-Object System.Text.UTF8Encoding($false)))
        [System.IO.File]::WriteAllText($rawJs, $sr.ReadToEnd(), (New-Object System.Text.UTF8Encoding($false)))
        $sr.Dispose()
        & node $patcher $rawJs $patchedJs | Out-Null
        Remove-Item $rawJs -Force -ErrorAction SilentlyContinue
      }
    }

    if (Test-Path $patchedJs) {
      $entry = $zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -match 'start/assets/app-.*\.js$' } | Select-Object -First 1
      if ($null -eq $entry) {
        Info "! бандл интерфейса не найден — перевод зашитых строк пропущен"
      } else {
        $bytes = [System.IO.File]::ReadAllBytes($patchedJs)
        $s = $entry.Open()
        try { $s.SetLength(0); $s.Write($bytes, 0, $bytes.Length) } finally { $s.Dispose() }
        Ok "зашитые в код надписи переведены ($($entry.FullName.Split('\')[-1]))"
      }
    } else {
      Info "! нет build\js\app.js — зашитые в код надписи останутся английскими"
    }
  }
  finally { $zip.Dispose() }

  $size = [math]::Round((Get-Item $OUT).Length / 1MB, 1)
  Ok "сборка готова: build\UI.zip ($size МБ)"
}

# ============================ УСТАНОВКА ============================
if ($BuildOnly) {
  Write-Host "`n  Сборка лежит в build\UI.zip. Установить: .\install.ps1 -DeployOnly`n" -ForegroundColor White
  exit 0
}

if (-not (Test-Path $OUT)) { Fail "нет готовой сборки build\UI.zip — запустите .\install.ps1 -BuildOnly" }

if (GameRunning) {
  Write-Host "`n  Игра сейчас запущена — подменить файл нельзя." -ForegroundColor Yellow
  Write-Host "  Закройте Le Mans Ultimate и выполните:`n" -ForegroundColor Yellow
  Write-Host "      .\install.ps1 -DeployOnly`n" -ForegroundColor White
  exit 2
}

Info "записываю UI.zip в папку игры..."
Copy-Item $OUT $UIZIP -Force

Write-Host "`n  ГОТОВО — русификатор установлен.`n" -ForegroundColor Green
Write-Host "  Запускайте игру: меню, гараж, настройки, лобби и описания настроек — на русском." -ForegroundColor White
Write-Host "  Язык в Steam менять НЕ нужно.`n" -ForegroundColor White
Write-Host "  Откат:  .\uninstall.ps1" -ForegroundColor DarkGray
Write-Host "  ВАЖНО: Steam при обновлении игры перезапишет UI.zip — тогда просто запустите" -ForegroundColor Yellow
Write-Host "  .\install.ps1 заново.`n" -ForegroundColor Yellow
