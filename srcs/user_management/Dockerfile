FROM python:3.9-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//g' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

COPY . .

RUN mkdir -p /app/media

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["daphne", "project.asgi:application", "--port", "8000", "--bind", "0.0.0.0"]
