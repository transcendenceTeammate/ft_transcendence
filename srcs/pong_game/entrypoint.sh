#!/bin/sh
set -e

echo "Making migrations..."
python manage.py makemigrations

echo "Applying database migrations..."
python manage.py migrate --noinput

# Execute the main container command (e.g., starting Daphne)
exec "$@"