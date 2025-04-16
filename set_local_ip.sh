#!/bin/bash

ENV_FILE=".env"

# Check if the .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found."
  exit 1
fi

# Detect the local IP address
LOCAL_IP=$(ip -o -4 addr show scope global | awk '{print $4}' | cut -d'/' -f1 | head -n1)

if [ -z "$LOCAL_IP" ]; then
  echo "❌ Unable to detect the local IP address."
  exit 1
fi

# Replace the placeholders in .env
sed -i "s|{api_url}|https://api.app.${LOCAL_IP}.nip.io:8443|g" "$ENV_FILE"
sed -i "s|{base_url}|https://app.${LOCAL_IP}.nip.io:8443|g" "$ENV_FILE"

echo "✅ .env successfully updated with local IP: $LOCAL_IP"
