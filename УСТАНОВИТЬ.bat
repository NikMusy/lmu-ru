@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Русификатор Le Mans Ultimate

rem Если запустить .bat прямо из архива, WinRAR/проводник распакуют во временную
rem папку только его самого, без скриптов рядом.
if not exist "%~dp0install.ps1" goto :unpacked
if not exist "%~dp0install-hud.ps1" goto :unpacked

echo.
echo   ================================================
echo    Русификатор Le Mans Ultimate
echo   ================================================
echo.
echo   Будет установлено:
echo     1) интерфейс — меню, гараж, настройки, лобби
echo     2) движок — HUD, MFD, флаги, штрафы, споттер
echo.
echo   Игра должна быть ЗАКРЫТА.
echo   Оригиналы сохранятся в папку backup — откат в любой момент.
echo.
echo   Второй шаг пересобирает шрифты игры и занимает ~20 минут.
echo.
pause

rem Код ошибки PowerShell бывает отрицательным, а "if errorlevel 1" его не ловит
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorlevel% neq 0 goto :error

echo.
echo   Шаг 2 из 2: шрифты движка. Это долго, не закрывайте окно.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-hud.ps1"
if %errorlevel% neq 0 goto :error

echo.
echo   ================================================
echo    ГОТОВО. Запускайте игру.
echo   ================================================
echo.
pause
exit /b 0

:error
echo.
echo   Установка прервана. Текст ошибки выше.
echo.
echo   Папку игры скрипт ищет сам — по библиотекам Steam. Если не нашёл,
echo   укажите путь вручную:
echo     powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "D:\...\Le Mans Ultimate"
echo.
pause
exit /b 1

:unpacked
echo.
echo   Похоже, установщик запущен прямо из архива — рядом нет остальных файлов.
echo.
echo   Распакуйте архив целиком в любую папку (правый клик - "Извлечь всё"
echo   или "Извлечь в LMU-RU-...") и запустите УСТАНОВИТЬ.bat оттуда.
echo.
pause
exit /b 1
