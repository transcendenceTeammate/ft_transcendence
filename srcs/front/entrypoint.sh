#!/bin/sh
set -e

envsubst < /usr/share/nginx/html/js/config.js.template > /usr/share/nginx/html/js/config.js

if [[ "$#" -gt 0 ]]; then
  exec "$@"
else
  nginx -g "daemon off;"
fi