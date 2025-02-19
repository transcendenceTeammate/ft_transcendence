#!/bin/sh

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Ensure required environment variables are set
: "${DB_HOST:?DB_HOST is not set}"
: "${DB_PORT:?DB_PORT is not set}"
: "${DB_USER:?DB_USER is not set}"

# Run makemigrations and migrate
echo "Running makemigrations..."
python manage.py makemigrations

echo "Running migrate..."
python manage.py migrate

# Create superuser if it doesn't exist
if ! python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print(User.objects.filter(username='$ADMIN_USERNAME').exists())" | grep 'True'; then
  echo "Creating superuser..."
  python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('$ADMIN_USERNAME', '$ADMIN_EMAIL', '$ADMIN_PASSWORD')"
else
  echo "Superuser already exists, skipping creation."
fi


# Start the server
exec "$@"