# Ouvre VoxFlow Dialer dans une fenetre Chrome popup 320x650
# Double-cliquer pour lancer le dialer

$url    = "http://localhost:3001/dialer"
$width  = 320
$height = 650

# Trouver Chrome
$chrome = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
    Write-Host "Chrome non trouve !" -ForegroundColor Red
    exit
}

# Ouvrir en mode app (pas d onglets, pas de barre d adresse)
Start-Process $chrome @(
    "--app=$url",
    "--window-size=$width,$height",
    "--window-position=50,50",
    "--no-default-browser-check",
    "--disable-extensions"
)

Write-Host "Dialer VoxFlow ouvert !" -ForegroundColor Green
