#!/bin/bash
set -e

CERT_PATH="/etc/nginx/ssl/localhost.crt"
KEY_PATH="/etc/nginx/ssl/localhost.key"

LOCAL_IP=${LOCAL_IP:-"127.0.0.1"}
export LOCAL_IP

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "Generating SSL certificate..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -subj "/C=AT/ST=W/L=W/O=42/OU=42k/CN=${LOCAL_IP}"
fi

echo "Processing nginx configuration files with IP: $LOCAL_IP"
for CONFIG_FILE in /etc/nginx/conf/default.conf /etc/nginx/conf/snippets/cors.conf; do
    if [ -f "$CONFIG_FILE" ]; then
        envsubst '${LOCAL_IP}' < "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
        mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    fi
done

echo "Ready! Open: https://app.${LOCAL_IP}.nip.io:8443/"
nginx -g "daemon off;"