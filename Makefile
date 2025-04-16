.PHONY: all build run stop clean rebuild logs test frontend-logs backend-logs cli-game setup-env

# Default target
all: setup-env build run

# Update .env with local IP
setup-env:
	@chmod +x setup_env.sh
	@./setup_env.sh


# Build all services
build:
	docker compose build

# Run the application
run:
	mkdir -p ./data/postgres
	mkdir -p ./data/media
	mkdir -p ./data/ssl
	docker compose up -d

# Stop the application
stop:
	docker compose down

# Clean up containers, images, and volumes
clean:
	docker compose down -v --rmi all

# Rebuild from scratch
re: clean build run

# Show all logs
logs:
	docker compose logs -f

# Show frontend logs
frontend-logs:
	docker compose logs -f frontend

# Show backend logs
backend-logs:
	docker compose logs -f user_management pong_game

# Run tests
test:
	docker compose run --rm user_management python manage.py test
	docker compose run --rm pong_game python manage.py test

# Development shortcuts
dev: build run logs

# CLI Game specific commands
cli-game:
	docker compose run --rm cli_game