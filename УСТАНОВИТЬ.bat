@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Русификатор Le Mans Ultimate

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

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 goto :error

echo.
echo   Шаг 2 из 2: шрифты движка. Это долго, не закрывайте окно.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-hud.ps1"
if errorlevel 1 goto :error

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
echo   Если игра стоит не на диске C, откройте install.ps1 в блокноте
echo   и поправьте путь в строке GamePath — либо запустите вручную:
echo     powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "D:\...\Le Mans Ultimate"
echo.
pause
exit /b 1
