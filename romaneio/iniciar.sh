#!/usr/bin/env bash
# Inicia o romaneio localmente em http://localhost:3000
cd "$(dirname "$0")"

echo ""
echo "  Romaneio Taldo Studio 3D"
echo "  Abra no navegador: http://localhost:3000"
echo "  Pressione Ctrl+C para encerrar"
echo ""

# Abre o navegador (quando disponível)
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "http://localhost:3000") >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  (sleep 1 && open "http://localhost:3000") >/dev/null 2>&1 &
fi

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 3000
elif command -v python >/dev/null 2>&1; then
  python -m http.server 3000
else
  echo "Python não encontrado. Abrindo index.html direto no navegador..."
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "index.html"
  elif command -v open >/dev/null 2>&1; then
    open "index.html"
  fi
fi
