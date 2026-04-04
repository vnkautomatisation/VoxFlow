# VoxFlow — Démarrer l'environnement de développement
# Usage : .\scripts\dev\start.ps1

Write-Host "Démarrage des services VoxFlow..." -ForegroundColor Cyan

# Docker
docker-compose up -d
Write-Host "✓ Postgres et Redis démarrés" -ForegroundColor Green

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -WindowStyle Normal
Write-Host "✓ Backend démarré sur http://localhost:4000" -ForegroundColor Green

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
Write-Host "✓ Frontend démarré sur http://localhost:3000" -ForegroundColor Green

Write-Host ""
Write-Host "VoxFlow est prêt !" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend  : http://localhost:4000" -ForegroundColor White
Write-Host "  Redis UI : http://localhost:8081" -ForegroundColor White
