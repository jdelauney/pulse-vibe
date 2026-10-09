@echo off
rem Relais des outils Pulse pour l'invite de commandes (cmd) : lance le script bash du meme nom, dans ce dossier,
rem par le bash de Git for Windows. PowerShell prend le relais .ps1, qui transmet les arguments sans les relire.
setlocal
set "PULSE_BASH="
for /f "delims=" %%G in ('where git.exe 2^>nul') do (
  if not defined PULSE_BASH if exist "%%~dpG..\bin\bash.exe" set "PULSE_BASH=%%~dpG..\bin\bash.exe"
  if not defined PULSE_BASH if exist "%%~dpG..\..\bin\bash.exe" set "PULSE_BASH=%%~dpG..\..\bin\bash.exe"
)
if not defined PULSE_BASH if defined ProgramW6432 if exist "%ProgramW6432%\Git\bin\bash.exe" set "PULSE_BASH=%ProgramW6432%\Git\bin\bash.exe"
if not defined PULSE_BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "PULSE_BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined PULSE_BASH if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "PULSE_BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined PULSE_BASH 1>&2 echo %~n0 : le bash de Git for Windows est introuvable. Installez Git for Windows, https://git-scm.com/download/win, puis fermez et relancez Claude Code.
if not defined PULSE_BASH exit /b 127
"%PULSE_BASH%" "%~dpn0" %*
exit /b %ERRORLEVEL%
