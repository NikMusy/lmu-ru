@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Откат русификатора Le Mans Ultimate

echo.
echo   Возврат оригинальных файлов игры. Игра должна быть закрыта.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-hud.ps1"

echo.
echo   Готово. Если что-то осталось не на месте — в Steam:
echo   Свойства игры - Установленные файлы - Проверить целостность.
echo.
pause
