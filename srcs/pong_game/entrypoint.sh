#!/bin/sh
set +e

echo "Cleaning up migrations..."
find ./app/migrations -name "0*.py" -delete
rm -f db.sqlite3

echo "Creating fresh migrations..."
python manage.py makemigrations app

echo "Applying migrations..."
python manage.py migrate

# Execute the main container command
exec "$@"