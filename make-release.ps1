# Собирает готовый к раздаче архив: скрипты + уже собранные тексты.
# Node.js конечному пользователю не нужен — только Windows PowerShell.
# Шрифты в архив не кладутся: системные берутся из Windows пользователя,
# растровые шрифты движка генерируются утилитой из самой игры.

[CmdletBinding()]
param([string]$Version = "1.0")

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$NAME = "LMU-RU-v$Version"
$STAGE = Join-Path $env:TEMP $NAME
$OUT = Join-Path $ROOT "dist\$NAME.zip"

if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Force -Path $STAGE, "$STAGE\build", "$STAGE\src", "$STAGE\lib", (Join-Path $ROOT "dist") | Out-Null

# поиск папки игры — общий для всех скриптов
Copy-Item (Join-Path $ROOT "lib\game-path.ps1") "$STAGE\lib" -Force

# скрипты установки
foreach ($f in @("install.ps1", "uninstall.ps1", "install-hud.ps1", "uninstall-hud.ps1",
                 "build-fonts.ps1", "УСТАНОВИТЬ.bat", "ОТКАТИТЬ.bat", "LICENSE")) {
  Copy-Item (Join-Path $ROOT $f) $STAGE -Force
}

# Шрифт заголовков идёт в комплекте: Oswald под лицензией OFL распространять можно,
# и он узкий по своему рисунку, поэтому ни сжатия, ни Node.js для него не нужно.
New-Item -ItemType Directory -Force -Path "$STAGE\tools", "$STAGE\src\fonts" | Out-Null
Copy-Item (Join-Path $ROOT "src\fonts\Oswald-SemiBold.ttf") "$STAGE\src\fonts" -Force
Copy-Item (Join-Path $ROOT "src\fonts\Oswald-OFL.txt")      "$STAGE\src\fonts" -Force

# перевод зашитых в бандл надписей и текста регламента — на PowerShell, Node не нужен
Copy-Item (Join-Path $ROOT "patch-js.ps1") $STAGE -Force
Copy-Item (Join-Path $ROOT "src\hardcoded-ru.json") "$STAGE\src" -Force
Copy-Item (Join-Path $ROOT "src\rules-ru.json") "$STAGE\src" -Force

# запасной путь для шрифта заголовков: если Oswald почему-то недоступен, install.ps1
# сожмёт системный шрифт — вот для этого шага Node.js и нужен, но он необязателен
Copy-Item (Join-Path $ROOT "tools\condense.js") "$STAGE\tools" -Force

# готовые тексты — установщику нужны именно они
foreach ($f in @("translation.json", "translation.en.json", "setting_descriptions.json",
                 "banners.json", "dlc-widget.json", "russian.dic")) {
  $p = Join-Path $ROOT "build\$f"
  if (-not (Test-Path $p)) { throw "нет build\$f — сначала соберите тексты (см. README)" }
  Copy-Item $p "$STAGE\build" -Force
}

# правки вёрстки, их дописывает install.ps1
Copy-Item (Join-Path $ROOT "src\ui-fixes.css")    "$STAGE\src" -Force
Copy-Item (Join-Path $ROOT "src\fonts-fixes.css") "$STAGE\src" -Force

# короткая инструкция
@"
РУСИФИКАТОР LE MANS ULTIMATE v$Version

БЫСТРАЯ УСТАНОВКА
  1. Закройте игру.
  2. Запустите УСТАНОВИТЬ.bat
  3. Дождитесь конца (второй шаг, шрифты движка, идёт ~20 минут).
  4. Запускайте игру. Язык в Steam менять не нужно.

ЧТО ПЕРЕВЕДЕНО
  Интерфейс: меню, гараж, лобби, все настройки и их описания (1941 строка).
  Регламент: правила онлайн-соревнований и кодекс поведения (178 строк).
  Движок:    HUD, MFD (меню боксов), флаги, штрафы, подсказки споттера (1040 строк).

  Не переведена политика конфиденциальности: это юридический документ
  Motorsport Games, официальной остаётся английская редакция.

ОТКАТ
  Запустите ОТКАТИТЬ.bat — вернутся оригинальные файлы из папки backup.
  Либо в Steam: Свойства игры - Установленные файлы - Проверить целостность.

ЕСЛИ ИГРА НЕ НА ДИСКЕ C
  Обычно ничего делать не надо: скрипты сами читают библиотеки Steam и находят игру.
  Если всё же не нашлась - запустите вручную, указав свой путь:
    powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "D:\SteamLibrary\steamapps\common\Le Mans Ultimate"
    powershell -ExecutionPolicy Bypass -File install-hud.ps1 -GamePath "D:\SteamLibrary\steamapps\common\Le Mans Ultimate"

ПОСЛЕ ОБНОВЛЕНИЯ ИГРЫ
  Steam перезаписывает изменённые файлы, перевод слетает.
  Просто запустите УСТАНОВИТЬ.bat заново.

ЧТО ИМЕННО МЕНЯЕТСЯ
  Bin\UI.zip                        тексты интерфейса и четыре шрифта
  Support\Languages\english.dic     словарь строк движка
  Core\Shared\SpriteFonts\*         растровые шрифты с кириллицей

  Ни .exe, ни .dll, ни подписанные архивы .mas не изменяются. Инъекций в процесс
  игры нет. Гарантий по поводу Easy Anti-Cheat при этом никто дать не может —
  перед первым онлайн-заездом стоит проверить работу в офлайне.

ШРИФТЫ
  В шрифтах игры нет кириллицы, поэтому их приходится подменять.
  Шрифт заголовков (Oswald) лежит в архиве — у него открытая лицензия OFL,
  и он узкий по своему рисунку, как и оригинальный шрифт игры.
  Шрифты основного текста берутся из вашей папки C:\Windows\Fonts.
  Растровые шрифты движка генерируются штатной утилитой MakeSpriteFont.exe
  из самой игры.

Исходники и подробности: https://github.com/NikMusy/lmu-ru
"@ | Set-Content "$STAGE\ПРОЧТИ МЕНЯ.txt" -Encoding UTF8

if (Test-Path $OUT) { Remove-Item $OUT -Force }
Compress-Archive -Path "$STAGE\*" -DestinationPath $OUT -CompressionLevel Optimal
Remove-Item $STAGE -Recurse -Force

$kb = [math]::Round((Get-Item $OUT).Length / 1KB)
Write-Host "`n  собран: dist\$NAME.zip ($kb КБ)`n" -ForegroundColor Green
