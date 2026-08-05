# Переводит строки, захардкоженные в бандле интерфейса мимо системы перевода.
#
# Часть надписей в LMU выводится литералом:  jsx("span", { children: "Race History" }),
# и через файл локали их не достать ни при каком языке. Здесь они заменяются прямо
# в app-*.js — точечно, только внутри children/title/placeholder/heading, то есть там,
# где строка заведомо является текстом на экране, а не кодом.
#
# Словарей два:
#   src/hardcoded-ru.json  — отдельные надписи интерфейса
#   src/rules-ru.json      — регламент онлайн-соревнований и кодекс поведения
#
# Раньше этот шаг делал node patch-js.js, и без Node.js установка его молча пропускала.
# Здесь Node не нужен.
#
#   .\patch-js.ps1 -In app-original.js -Out app.js

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Convert-FromJsonString([string]$s) {
  # Разэкранирование строки JSON. ConvertFrom-Json здесь не годится: в этих файлах
  # есть ключи, различающиеся только регистром, а PSCustomObject их путает.
  $b = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $s.Length; $i++) {
    if ($s[$i] -ne '\') { [void]$b.Append($s[$i]); continue }
    $i++
    switch ($s[$i]) {
      '"'  { [void]$b.Append('"') }
      '\'  { [void]$b.Append('\') }
      '/'  { [void]$b.Append('/') }
      'b'  { [void]$b.Append([char]8) }
      'f'  { [void]$b.Append([char]12) }
      'n'  { [void]$b.Append([char]10) }
      'r'  { [void]$b.Append([char]13) }
      't'  { [void]$b.Append([char]9) }
      'u'  { [void]$b.Append([char][Convert]::ToInt32($s.Substring($i + 1, 4), 16)); $i += 4 }
      default { [void]$b.Append($s[$i]) }
    }
  }
  $b.ToString()
}

function Convert-ToJsonString([string]$s) {
  $b = New-Object System.Text.StringBuilder
  [void]$b.Append('"')
  foreach ($c in $s.ToCharArray()) {
    switch ([int]$c) {
      34 { [void]$b.Append('\"') }
      92 { [void]$b.Append('\\') }
      10 { [void]$b.Append('\n') }
      13 { [void]$b.Append('\r') }
      9  { [void]$b.Append('\t') }
      default { if ([int]$c -lt 32) { [void]$b.Append(('\u{0:x4}' -f [int]$c)) } else { [void]$b.Append($c) } }
    }
  }
  [void]$b.Append('"')
  $b.ToString()
}

# ---- словари ----
# Файлы отформатированы по одной паре на строку, поэтому читаются построчно:
# так сохраняется и порядок, и различие ключей по регистру.
$dict = New-Object System.Collections.Specialized.OrderedDictionary
$dupes = New-Object System.Collections.Generic.List[string]

foreach ($name in @("hardcoded-ru.json", "rules-ru.json")) {
  $file = Join-Path $Root "src\$name"
  if (-not (Test-Path $file)) { Write-Host "  ! нет src\$name — пропущено" -ForegroundColor Yellow; continue }
  $text = [IO.File]::ReadAllText($file)
  $n = 0
  foreach ($m in [regex]::Matches($text, '(?m)^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$')) {
    $k = Convert-FromJsonString $m.Groups[1].Value
    if ($k -eq '_comment') { continue }
    $v = Convert-FromJsonString $m.Groups[2].Value
    if ($dict.Contains($k)) { $dupes.Add($k) }
    $dict[$k] = $v
    $n++
  }
  if (-not $Quiet) { Write-Host "  $name`: $n строк" -ForegroundColor Gray }
}

if ($dict.Count -eq 0) { Write-Host "  ! словари пусты — патчить нечего" -ForegroundColor Yellow; exit 1 }
if ($dupes.Count -gt 0) {
  Write-Host "  ОШИБКА: ключ есть сразу в двух словарях ($($dupes.Count)):" -ForegroundColor Red
  $dupes | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
  exit 1
}

# Фигурные скобки в надписях не встречаются (круглые — сплошь и рядом), и на этом
# держится проверка целостности ниже.
$braced = @($dict.Keys | Where-Object { $_ -match '[{}]' }) + @($dict.Values | Where-Object { $_ -match '[{}]' })
if ($braced.Count -gt 0) {
  Write-Host "  ОШИБКА: в словаре есть строки с фигурными скобками — проверка баланса станет бессмысленной" -ForegroundColor Red
  exit 1
}

# ---- замена ----
$src = [IO.File]::ReadAllText($In, [Text.UTF8Encoding]::new($false))
$before = $src.Length
$replacedKeys = 0; $totalHits = 0
$missed = New-Object System.Collections.Generic.List[string]

foreach ($k in @($dict.Keys)) {
  $pattern = '((?:children|title|placeholder|heading)\s*:\s*)"' + [regex]::Escape($k) + '"'
  $replacement = '${1}' + (Convert-ToJsonString $dict[$k]).Replace('$', '$$')
  # один проход на ключ: счётчик ведёт сам обработчик замены
  $hits = 0
  $src = [regex]::Replace($src, $pattern, { param($m) $script:hits++; $m.Result($replacement) })
  if ($hits -eq 0) { $missed.Add($k); continue }
  $replacedKeys++; $totalHits += $hits
}

# ---- проверки ----
$delta = $src.Length - $before
$limit = [Math]::Max($before * 0.05, 4096)
if ([Math]::Abs($delta) -gt $limit) {
  Write-Host "  ОТМЕНА: размер изменился на $delta символов при пределе $([int]$limit) — замена подозрительна" -ForegroundColor Red
  exit 1
}

$orig = [IO.File]::ReadAllText($In, [Text.UTF8Encoding]::new($false))
foreach ($ch in @('{', '}')) {
  $a = ($orig.ToCharArray() | Where-Object { $_ -eq $ch }).Count
  $b = ($src.ToCharArray()  | Where-Object { $_ -eq $ch }).Count
  if ($a -ne $b) {
    Write-Host "  ОТМЕНА: изменилось число символов '$ch' — замена задела код, а не текст" -ForegroundColor Red
    exit 1
  }
}

[IO.File]::WriteAllText($Out, $src, [Text.UTF8Encoding]::new($false))

if (-not $Quiet) {
  Write-Host "  заменено строк: $replacedKeys, всего вхождений: $totalHits" -ForegroundColor Gray
  if ($missed.Count -gt 0) {
    Write-Host "  не найдено в бандле: $($missed.Count)" -ForegroundColor Gray
    $missed | Select-Object -First 10 | ForEach-Object {
      $s = $_; if ($s.Length -gt 70) { $s = $s.Substring(0, 70) + '...' }
      Write-Host "     -  $s" -ForegroundColor DarkGray
    }
  }
  Write-Host "  размер: $before -> $($src.Length) символов ($(if ($delta -ge 0) {'+'})$delta)" -ForegroundColor Gray
}
exit 0
