#!/usr/bin/env bash
# Inicia o romaneio localmente em http://localhost:3000
cd "$(dirname "$0")"
echo ""
echo "  Romaneio Taldo Studio 3D"
echo "  Abra no navegador: http://localhost:3000"
echo "  Pressione Ctrl+C para encerrar"
echo ""
python3 -m http.server 3000
