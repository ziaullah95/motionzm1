@echo off
setlocal
cd /d "%~dp0"

echo Restarting MotionAM...
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"127\.0\.0\.1:4173 .*LISTENING"') do (
  echo Stopping old MotionAM server on port 4173...
  taskkill /PID %%P /F >nul 2>nul
)

echo Starting updated MotionAM server...
echo.
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo MP4 conversion needs FFmpeg. Browser MP4 may still work.
  echo If MP4 export says FFmpeg is needed, install FFmpeg and restart MotionAM.
  echo.
)
echo Open this address in your browser:
echo http://127.0.0.1:4173/
echo.
echo Keep this window open while using MotionAM.
echo Press Ctrl+C here when you want to stop it.
echo.

"C:\Users\786\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%~dp0server.mjs"

echo.
echo MotionAM stopped.
pause
