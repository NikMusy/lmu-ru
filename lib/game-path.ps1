# Поиск папки Le Mans Ultimate.
#
# Раньше путь был вписан в каждый скрипт строкой с диском C, и всем, у кого игра
# на другом диске, приходилось править скрипты в блокноте. Теперь порядок такой:
# явный -GamePath -> переменная окружения LMU_PATH -> библиотеки Steam -> обычные места.
#
# Подключается так:  . (Join-Path $ROOT "lib\game-path.ps1")

function Test-LmuPath([string]$dir) {
  if ([string]::IsNullOrWhiteSpace($dir)) { return $false }
  # [IO.Path]::Combine, а не Join-Path: последний ругается на несуществующий диск
  $probe = [IO.Path]::Combine($dir, "Bin", "UI.zip")
  return (Test-Path -LiteralPath $probe -ErrorAction SilentlyContinue)
}

function Get-SteamLibraries {
  $libs = New-Object System.Collections.Generic.List[string]
  $roots = @(${env:ProgramFiles(x86)}, $env:ProgramFiles) |
             Where-Object { $_ } |
             ForEach-Object { [IO.Path]::Combine($_, "Steam") }
  $roots += "C:\Steam"

  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r -ErrorAction SilentlyContinue)) { continue }
    $libs.Add($r)
    $vdf = [IO.Path]::Combine($r, "steamapps", "libraryfolders.vdf")
    if (-not (Test-Path -LiteralPath $vdf -ErrorAction SilentlyContinue)) { continue }
    foreach ($m in [regex]::Matches([IO.File]::ReadAllText($vdf), '"path"\s+"([^"]+)"')) {
      # в vdf слэши удвоены
      $path = $m.Groups[1].Value -replace '\\\\', '\'
      $libs.Add($path)
    }
  }
  return ($libs | Select-Object -Unique)
}

function Find-LmuPath([string]$Explicit) {
  if (Test-LmuPath $Explicit) { return $Explicit }

  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:LMU_PATH) { $candidates.Add($env:LMU_PATH) }
  foreach ($lib in Get-SteamLibraries) {
    $candidates.Add([IO.Path]::Combine($lib, "steamapps", "common", "Le Mans Ultimate"))
  }
  $candidates.Add("C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate")

  foreach ($c in $candidates) { if (Test-LmuPath $c) { return $c } }

  # Ничего не нашли: возвращаем то, что просили, — вызывающий сам покажет ошибку с путём
  if ($Explicit) { return $Explicit }
  return "C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate"
}
