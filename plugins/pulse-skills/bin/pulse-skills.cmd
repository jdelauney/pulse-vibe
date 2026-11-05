@echo off
rem Relais des outils Pulse pour l'invite de commandes (cmd) : lance le script bash du meme nom, dans ce dossier,
rem par le bash de Git for Windows. PowerShell prend le relais .ps1, qui transmet les arguments sans les relire.
rem Depuis PowerShell, appelez l'outil par son nom seul, sans .cmd (il prend alors le .ps1) : un appel a ce fichier passe
rem par cmd.exe, qui relit encore & | > < ^ dans les arguments.
rem Meme recherche que le relais .ps1 : a cote de chaque git.exe, puis dans les dossiers d'installation de Git for Windows.
setlocal
set "PULSE_BASH="
for /f "delims=" %%G in ('where git.exe 2^>nul') do (
  if not defined PULSE_BASH if exist "%%~dpG..\bin\bash.exe" set "PULSE_BASH=%%~dpG..\bin\bash.exe"
  if not defined PULSE_BASH if exist "%%~dpG..\..\bin\bash.exe" set "PULSE_BASH=%%~dpG..\..\bin\bash.exe"
  if not defined PULSE_BASH if exist "%%~dpGbash.exe" set "PULSE_BASH=%%~dpGbash.exe"
)
if not defined PULSE_BASH if defined ProgramW6432 if exist "%ProgramW6432%\Git\bin\bash.exe" set "PULSE_BASH=%ProgramW6432%\Git\bin\bash.exe"
if not defined PULSE_BASH if defined ProgramFiles if exist "%ProgramFiles%\Git\bin\bash.exe" set "PULSE_BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined PULSE_BASH if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "PULSE_BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined PULSE_BASH if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "PULSE_BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined PULSE_BASH 1>&2 echo %~n0 : le bash de Git for Windows est introuvable. Installez Git for Windows, https://git-scm.com/download/win, puis fermez et relancez Claude Code.
if not defined PULSE_BASH exit /b 127
"%PULSE_BASH%" "%~dpn0" %*
exit /b %ERRORLEVEL%
