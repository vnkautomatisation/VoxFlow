# Build l extension Chrome VoxFlow
Write-Host "Build extension..." -ForegroundColor Yellow

# Copier le popup.js dans le dossier popup
Copy-Item "popup\popup.js" "popup\popup.js" -Force

Write-Host "Extension prete a charger dans Chrome !" -ForegroundColor Green
Write-Host ""
Write-Host "Pour installer :"
Write-Host "1. Ouvrir chrome://extensions"
Write-Host "2. Activer le mode developpeur (toggle en haut a droite)"
Write-Host "3. Cliquer 'Charger l extension non empaquetee'"
Write-Host "4. Selectionner le dossier: $PSScriptRoot"
