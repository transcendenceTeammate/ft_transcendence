#!/bin/bash

ENV_FILE=".env"

# Check if the .env file exists
if [ -f "$ENV_FILE" ]; then
  exit 1
fi
cp .env.template .env
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found. Please create a .env.template file first."
  exit 1
fi

# Detect the local IP address
LOCAL_IP=$(ip -o -4 addr show scope global | awk '{print $4}' | cut -d'/' -f1 | head -n1)

if [ -z "$LOCAL_IP" ]; then
  echo "❌ Unable to detect the local IP address."
  exit 1
fi

# Generate a secure JWT secret
NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Replace the placeholders in .env using Perl
perl -pi -e "s/{api_url}/https:\/\/api.app.${LOCAL_IP}.nip.io:8443/g" "$ENV_FILE"
perl -pi -e "s/{base_url}/https:\/\/app.${LOCAL_IP}.nip.io:8443/g" "$ENV_FILE"
perl -pi -e "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$NEW_SECRET|" "$ENV_FILE"

echo "✅ .env successfully updated with local IP: $LOCAL_IP and secure JWT secret"
