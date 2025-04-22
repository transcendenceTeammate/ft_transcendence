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

BASE_DOMAIN="${LOCAL_IP}.nip.io"
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
INTERNAL_API_TOKEN=$(openssl rand -base64 64 | tr -d '\n')

perl -pi -e "s/{base_domain}/$BASE_DOMAIN/g" "$ENV_FILE"
perl -pi -e "s;{jwt_secret_key};$JWT_SECRET;g" "$ENV_FILE"
perl -pi -e "s;{internal_api_token};$INTERNAL_API_TOKEN;g" "$ENV_FILE"

echo "✅ .env successfully updated"
