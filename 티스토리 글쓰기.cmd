@echo off
rem Double-click to open the Tistory posting menu (scripts/tistory-wizard.mjs). Nothing is posted automatically.
chcp 65001 >nul
cd /d "%~dp0"
node scripts\tistory-wizard.mjs
echo.
pause
