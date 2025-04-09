#!/bin/bash
set -e

CERT_PATH="/etc/nginx/ssl/localhost.crt"
KEY_PATH="/etc/nginx/ssl/localhost.key"

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "Generating SSL certificate..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -subj "/C=AT/ST=W/L=W/O=42/OU=42k/CN=10.24.108.2"
fi

echo "Ready! Open: https://localhost:8443/"
nginx -g "daemon off;"
#nginx