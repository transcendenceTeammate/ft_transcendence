#!/bin/bash
set -e

CERT_PATH="/etc/nginx/ssl/localhost.crt"
KEY_PATH="/etc/nginx/ssl/localhost.key"

# Extract IP from BASE_URL environment variable
IP=$(echo $BASE_URL | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "Generating SSL certificate..."
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -subj "/C=AT/ST=W/L=W/O=42/OU=42k/CN=$IP"
fi

# Replace environment variables in configuration files
echo "Configuring NGINX with environment variables..."
export IP
envsubst '${IP} ${BASE_URL} ${API_URL}' < /etc/nginx/conf/default.conf > /etc/nginx/conf/default.conf.tmp
mv /etc/nginx/conf/default.conf.tmp /etc/nginx/conf/default.conf
envsubst '${BASE_URL}' < /etc/nginx/conf/snippets/cors.conf > /etc/nginx/conf/snippets/cors.conf.tmp
mv /etc/nginx/conf/snippets/cors.conf.tmp /etc/nginx/conf/snippets/cors.conf

echo "Ready! Open: $BASE_URL"
nginx -g "daemon off;"
