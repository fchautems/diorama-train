@echo off
setlocal
cd /d "%~dp0"

echo.
echo   Le Muids - controle visuel automatique
echo   --------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe ou n'est pas dans le PATH.
  echo Le controle CI GitHub continuera quand meme a s'executer a chaque push.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installation de Playwright...
  call npm install
  if errorlevel 1 goto :fail
)

echo Verification de Chromium...
call npx playwright install chromium
if errorlevel 1 goto :fail

echo.
echo Lancement du controle + screenshot...
call npm run visual:check
if errorlevel 1 goto :fail

echo.
echo OK. Screenshot: test-results\le-muids-qa.png
start "" "test-results\le-muids-qa.png"
pause
exit /b 0

:fail
echo.
echo ECHEC du controle visuel.
echo Regarde test-results\le-muids-qa.json et le screenshot s'il existe.
pause
exit /b 1
