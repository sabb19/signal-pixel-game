#!/bin/sh
# Pubblica il gioco su GitHub Pages: costruisce dist/ e lo carica sul ramo gh-pages.
# Link pubblico: https://sabb19.github.io/signal-pixel-game/
set -e
npm test
npm run build
TMP=$(mktemp -d)
cp -R dist/. "$TMP"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -qm "Pubblicazione del gioco"
git push -q -f https://github.com/sabb19/signal-pixel-game.git gh-pages
echo "Pubblicato: https://sabb19.github.io/signal-pixel-game/"
