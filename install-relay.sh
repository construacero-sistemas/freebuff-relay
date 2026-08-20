#!/usr/bin/env bash
set -euo pipefail

echo "=== Instalador Freebuff Relay para Linux ==="

ARCH=$(uname -m)
INSTALL_DIR="/opt/freebuff-relay"
mkdir -p "$INSTALL_DIR"

if [ "$ARCH" = "x86_64" ]; then
    echo "[+] Arquitectura detectada: x86_64"
    if [ -f "relay-linux-x64" ]; then
        cp relay-linux-x64 "$INSTALL_DIR/relay-linux"
    else
        echo "[!] relay-linux-x64 no encontrado en el directorio actual. Asegurese de copiarlo."
    fi
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    echo "[+] Arquitectura detectada: ARM64"
    if [ -f "relay-linux-arm64" ]; then
        cp relay-linux-arm64 "$INSTALL_DIR/relay-linux"
    else
        echo "[!] relay-linux-arm64 no encontrado en el directorio actual. Asegurese de copiarlo."
    fi
else
    echo "[-] Arquitectura no soportada: $ARCH"
    exit 1
fi

chmod +x "$INSTALL_DIR/relay-linux"

echo "[+] Instalando servicio systemd..."
cp freebuff-relay.service /etc/systemd/system/freebuff-relay.service
systemctl daemon-reload
systemctl enable freebuff-relay
systemctl restart freebuff-relay

echo "[+] Abriendo puerto 8787 en firewall (si ufw esta activo)..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 8787/tcp || true
fi

sleep 2
echo "[+] Verificando healthcheck local..."
curl -s http://127.0.0.1:8787/healthz || true
echo ""
echo "=== Relay instalado y activo exitosamente en puerto 8787 ==="
