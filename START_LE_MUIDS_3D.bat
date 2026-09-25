@echo off
setlocal
cd /d "%~dp0"

echo.
echo   Le Muids - prototype 3D georeference
echo   -------------------------------------
echo   Demarrage sur http://localhost:8000/le-muids-3d.html
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "Le Muids 3D server" cmd /k "py -3 -m http.server 8000"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python n'est pas trouve dans le PATH.
    pause
    exit /b 1
  )
  start "Le Muids 3D server" cmd /k "python -m http.server 8000"
)

timeout /t 1 /nobreak >nul
start "" "http://localhost:8000/le-muids-3d.html"
endlocal
