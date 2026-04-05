@echo off
title VoxFlow Dialer

:: ─── Chemin vers le fichier HTML ───────────────────────────────────────────
:: Modifie ce chemin si tu as déplacé le fichier HTML
set "DIALER_PATH=%~dp0VoxFlow-Dialer-App.html"

:: ─── Cherche Chrome automatiquement ────────────────────────────────────────
set "CHROME="

:: Chemin 1 : Installation standard
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    goto :launch
)

:: Chemin 2 : Installation 32-bit sur 64-bit
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    goto :launch
)

:: Chemin 3 : Installation utilisateur (sans droits admin)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
    goto :launch
)

:: Chrome introuvable
echo [ERREUR] Google Chrome n'a pas ete trouve.
echo Installe Chrome ou modifie le chemin dans ce fichier .bat
pause
exit /b 1

:launch
:: ─── Lancer Chrome en mode app (fenêtre standalone sans barre d'adresse) ───
echo Lancement VoxFlow Dialer...
start "" "%CHROME%" ^
    --app="file:///%DIALER_PATH:\=/%"  ^
    --window-size=380,720              ^
    --window-position=9999,9999        ^
    --no-first-run                     ^
    --no-default-browser-check         ^
    --disable-extensions-except=       ^
    --user-data-dir="%TEMP%\VoxFlow-Profile"

:: La fenêtre se positionnera en bas à droite grâce à l'extension
:: ou manuellement. Position 9999,9999 la pousse dans le coin.
exit /b 0
