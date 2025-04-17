#!/bin/bash

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
  echo "❌ .env file already exists. No modifications will be made."
  exit 0
fi

cp .env.template .env
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found. Please create a .env.template file first."
  exit 1
fi

LOCAL_IP=$(ip -o -4 addr show scope global | awk '{print $4}' | cut -d'/' -f1 | head -n1)

if [ -z "$LOCAL_IP" ]; then
  echo "❌ Unable to detect the local IP address."
  exit 1
fi

NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Update .env file
perl -pi -e "s/{api_url}/https:\/\/api.app.${LOCAL_IP}.nip.io:8443/g" "$ENV_FILE"
perl -pi -e "s/{base_url}/https:\/\/app.${LOCAL_IP}.nip.io:8443/g" "$ENV_FILE"
perl -pi -e "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$NEW_SECRET|" "$ENV_FILE"

# Export the LOCAL_IP to .env file for other containers
perl -pi -e "s|^LOCAL_IP=.*|LOCAL_IP=$LOCAL_IP|" "$ENV_FILE" || echo "LOCAL_IP=$LOCAL_IP" >> "$ENV_FILE"

# Update nginx configuration files
echo "Updating nginx configuration files with IP: $LOCAL_IP"

# Update entrypoint.sh
ENTRYPOINT_FILE="srcs/nginx/entrypoint.sh"
if [ -f "$ENTRYPOINT_FILE" ]; then
  perl -pi -e "s/CN=10\\.18\\.185\\.214/CN=$LOCAL_IP/g" "$ENTRYPOINT_FILE"
fi

# Update default.conf
DEFAULT_CONF="srcs/nginx/conf/default.conf"
if [ -f "$DEFAULT_CONF" ]; then
  perl -pi -e "s/10\\.18\\.185\\.214/$LOCAL_IP/g" "$DEFAULT_CONF"
fi

# Update cors.conf
CORS_CONF="srcs/nginx/conf/snippets/cors.conf"
if [ -f "$CORS_CONF" ]; then
  perl -pi -e "s/10\\.18\\.185\\.214/$LOCAL_IP/g" "$CORS_CONF"
fi

echo "✅ Environment successfully updated with local IP: $LOCAL_IP and secure JWT secret"
