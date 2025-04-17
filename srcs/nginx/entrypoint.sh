#!/bin/bash
set -e

if [ -z "$BASE_URL" ]; then
    echo "ERROR: BASE_URL environment variable not set"
    exit 1
fi

DOMAIN=$(echo "$BASE_URL" | sed -E 's|^https?://||' | sed -E 's|:[0-9]+$||')
DOMAIN_ROOT=$(echo "$DOMAIN" | sed -E 's|^app\.||')

CERT_PATH="/etc/nginx/ssl/localhost.crt"
KEY_PATH="/etc/nginx/ssl/localhost.key"

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "Generating SSL certificate..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -subj "/C=AT/ST=W/L=W/O=42/OU=42k/CN=$DOMAIN_ROOT"
fi

export DOMAIN_ROOT
envsubst '${BASE_URL} ${API_URL} ${DOMAIN_ROOT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
envsubst '${BASE_URL}' < /etc/nginx/snippets/cors.conf.template > /etc/nginx/snippets/cors.conf

echo "NGINX configuration ready with domain: $DOMAIN_ROOT"
echo "Access your application at: $BASE_URL"
nginx -g "daemon off;"