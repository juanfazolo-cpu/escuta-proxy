#!/bin/bash
set -e

echo "→ Build Taldo Studio (landing + gestão)"
rm -rf deploy
mkdir -p deploy

echo "→ Copiando landing page"
cp -r landing/index.html landing/styles.css landing/script.js landing/assets deploy/
rm -f deploy/CNAME 2>/dev/null || true

echo "→ Build viewer /gestao"
cd viewer
npm ci --silent
npm run build
mkdir -p ../deploy/gestao
cp -r dist/* ../deploy/gestao/
cp public/taldo_gestao_v7.3.xlsx ../deploy/gestao/

echo "→ Pronto: deploy/"
ls -la ../deploy/
ls -la ../deploy/gestao/
