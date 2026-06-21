@echo off
echo ================================================
echo  MindLog — Starting Local Server
echo ================================================
echo.

REM Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Server running at: http://localhost:8080
    echo  Open this link in your browser ^^^
    echo.
    echo  Press Ctrl+C to stop the server.
    echo.
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

REM Try py launcher
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Server running at: http://localhost:8080
    start "" "http://localhost:8080"
    py -m http.server 8080
    goto :end
)

REM Try Python 2
python2 --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Server running at: http://localhost:8080
    start "" "http://localhost:8080"
    python2 -m SimpleHTTPServer 8080
    goto :end
)

REM No Python found — check for Node
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Server running at: http://localhost:8080
    start "" "http://localhost:8080"
    npx serve -p 8080 .
    goto :end
)

echo  ERROR: Could not find Python or Node.js.
echo.
echo  Please install Python from https://python.org
echo  Then run this file again.
echo.
pause

:end
