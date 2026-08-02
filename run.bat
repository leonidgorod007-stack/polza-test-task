@echo off
chcp 65001 >nul
title Polza test task - setup and run
echo.
echo   Polza Agency test task - universal launcher
echo   (Node + PostgreSQL + data load + web)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
echo.
pause
