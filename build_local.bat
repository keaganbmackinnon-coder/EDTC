@echo off
setlocal

set "ROOT=%~dp0"
set "EXE=%ROOT%dist\EDTC.exe"

echo [1/3] Building frontend...
cd /d "%ROOT%frontend"
call npm install
call npm run build
if errorlevel 1 ( echo Frontend build failed & pause & exit /b 1 )

echo [2/3] Building EDTC.exe with PyInstaller...
cd /d "%ROOT%"
call .venv\Scripts\activate.bat
pyinstaller --onefile --windowed --name EDTC ^
  --icon "frontend/public/icon.ico" ^
  --add-data "frontend/dist;frontend/dist" ^
  --add-data "data;data" ^
  main.py
if errorlevel 1 ( echo PyInstaller build failed & pause & exit /b 1 )

echo [3/3] Creating desktop shortcut...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\EDTC.lnk'); ^
   $sc.TargetPath = '%EXE:\=\\%'; ^
   $sc.WorkingDirectory = '%ROOT:\=\\%'; ^
   $sc.Description = 'Elite Dangerous Tools & Companion'; ^
   $sc.Save()"

echo Done! EDTC shortcut created on your desktop.
pause
