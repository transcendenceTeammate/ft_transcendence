FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cli_pong.py .

CMD ["python", "cli_pong.py"]