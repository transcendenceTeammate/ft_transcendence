FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
# Ensure the script has Unix-style line endings and is executable
RUN sed -i 's/\r$//g' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

# Copy application code
COPY . .

# Set the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]