@echo off
cd /d "%~dp0"
echo.
echo Iniciando San Pedro Territorio 3D en http://localhost:8080
echo Mantenga esta ventana abierta mientras usa el visor.
echo.
start "" http://localhost:8080
py -m http.server 8080
if errorlevel 1 python -m http.server 8080
pause
