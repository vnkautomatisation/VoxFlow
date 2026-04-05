#!/bin/bash
# ─── VoxFlow Dialer — Lanceur macOS ─────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIALER_PATH="$SCRIPT_DIR/VoxFlow-Dialer-App.html"

# Chercher Chrome
CHROME_PATHS=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

CHROME=""
for p in "${CHROME_PATHS[@]}"; do
    if [ -f "$p" ]; then
        CHROME="$p"
        break
    fi
done

if [ -z "$CHROME" ]; then
    echo "❌ Google Chrome introuvable."
    echo "Installe Chrome depuis https://www.google.com/chrome/"
    exit 1
fi

echo "🚀 Lancement VoxFlow Dialer..."
"$CHROME" \
    --app="file://$DIALER_PATH" \
    --window-size=380,720 \
    --no-first-run \
    --no-default-browser-check \
    --user-data-dir="/tmp/VoxFlow-Profile" \
    &

echo "✅ VoxFlow Dialer lancé"
