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
      -subj "/C=AT/ST=W/L=W/O=42/OU=42k/CN=localhost"
fi

# Check if the user_management service on port 8000 is up.
while true; do
    if nc -z -w 2 user_management 8000; then
        echo "User Management service is up!"
        sleep 1
        break
    else
        echo "User Management service isn't up...waiting..."
        sleep 4
    fi
done

echo "Ready! Open: https://localhost:8443/"
nginx -g "daemon off;"
#nginx