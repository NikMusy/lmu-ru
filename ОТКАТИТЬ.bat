@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Откат русификатора Le Mans Ultimate

if not exist "%~dp0uninstall.ps1" goto :unpacked

echo.
echo   Возврат оригинальных файлов игры. Игра должна быть закрыта.
echo.
pause

set FAILED=0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
if %errorlevel% neq 0 set FAILED=1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-hud.ps1"
if %errorlevel% neq 0 set FAILED=1

echo.
if %FAILED%==1 (
  echo   Откат прошёл с ошибками — текст выше. Верните файлы через Steam:
) else (
  echo   Готово. Если что-то осталось не на месте — в Steam:
)
echo   Свойства игры - Установленные файлы - Проверить целостность.
echo.
pause
exit /b %FAILED%

:unpacked
echo.
echo   Похоже, откат запущен прямо из архива — рядом нет остальных файлов.
echo   Запустите ОТКАТИТЬ.bat из папки, куда распаковывали русификатор.
echo.
pause
exit /b 1
