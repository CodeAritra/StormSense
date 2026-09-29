FROM python:3.11-slim

WORKDIR /app

# Only install libgomp1 (required for onnxruntime OpenMP threading) without heavy compilers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./apps/api/
COPY models/ ./models/

ENV PYTHONPATH=/app
EXPOSE 8000

CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
