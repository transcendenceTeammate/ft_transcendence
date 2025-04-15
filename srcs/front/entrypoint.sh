#!/bin/sh
set -e

# Replace environment variables in the template
envsubst < /usr/share/nginx/html/js/config.js.template > /usr/share/nginx/html/js/config.js

# If arguments are passed, execute them; otherwise, start nginx
if [[ "$#" -gt 0 ]]; then
  exec "$@"
else
  nginx -g "daemon off;"
fi