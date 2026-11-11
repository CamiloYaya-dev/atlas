@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js 22 o superior desde https://nodejs.org/
  pause
  exit /b 1
)
echo ========================================
echo    ATLAS V3 - Aplicacion React
 echo ========================================
echo.
echo Instalando dependencias (requiere internet)...
call npm install
if errorlevel 1 (
  echo Error al instalar dependencias. Revisa la conexion y vuelve a ejecutar.
  pause
  exit /b 1
)
echo.
echo ATLAS se abrira en http://localhost:5173
call npm run dev
pause
