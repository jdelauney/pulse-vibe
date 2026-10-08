@echo off
rem pulse-aidd depuis PowerShell ou cmd : relaie vers le script bash du meme dossier, par le bash de Git for Windows.
setlocal
set "PULSE_BASH="
for /f "delims=" %%G in ('where git 2^>nul') do if not defined PULSE_BASH if exist "%%~dpG..\bin\bash.exe" set "PULSE_BASH=%%~dpG..\bin\bash.exe"
if not defined PULSE_BASH set "PULSE_BASH=bash"
"%PULSE_BASH%" "%~dp0pulse-aidd" %*
exit /b %ERRORLEVEL%
