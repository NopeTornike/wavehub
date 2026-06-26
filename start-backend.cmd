@echo off
setlocal
cd /d "%~dp0backend"

if not exist node_modules (
  npm.cmd install
)

npm.cmd run build
if errorlevel 1 exit /b 1

node dist\main.js
