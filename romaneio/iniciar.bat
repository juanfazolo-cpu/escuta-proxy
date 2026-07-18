@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Romaneio Taldo Studio 3D

echo.
echo   Romaneio Taldo Studio 3D
echo   Abrindo em http://localhost:3000
echo   Para encerrar, feche esta janela ou pressione Ctrl+C
echo.

start "" "http://localhost:3000"

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 -m http.server 3000
  goto :fim
)

where python >nul 2>&1
if %errorlevel%==0 (
  python -m http.server 3000
  goto :fim
)

echo Python nao encontrado.
echo.
echo Opcao 1: instale Python em https://www.python.org/downloads/
echo          (marque "Add python.exe to PATH" na instalacao)
echo.
echo Opcao 2: abra o arquivo index.html direto no navegador
echo          (clique duas vezes em index.html)
echo.
pause
start "" "%~dp0index.html"

:fim
