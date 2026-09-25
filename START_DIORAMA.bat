@echo off
setlocal
cd /d "%~dp0"

echo.
echo   diorama-train
echo   -------------
echo   Demarrage du serveur local sur http://localhost:8000
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "diorama-train server" cmd /k "py -3 -m http.server 8000"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python n'est pas trouve dans le PATH.
    echo Installe Python ou lance manuellement un serveur HTTP local.
    pause
    exit /b 1
  )
  start "diorama-train server" cmd /k "python -m http.server 8000"
)

timeout /t 1 /nobreak >nul
start "" "http://localhost:8000"
endlocal
