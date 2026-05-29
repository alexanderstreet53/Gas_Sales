# Root-level Dockerfile for the Fly.io GitHub deploy.
# Fly builds from the repo root, so this points into apps/worker/ to build
# the Python YOLO detection worker (NOT the Next.js web app — that's on Vercel).

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build context is the repo root; pull the worker's files out of apps/worker.
COPY apps/worker/pyproject.toml ./
COPY apps/worker/app ./app

# Download an aerial-trained model at build time so the repo needs no
# weights file. yolov8n-obb is trained on DOTA (satellite/aerial imagery)
# and includes storage-tank / large-vehicle / small-vehicle classes —
# far better for top-down tiles than COCO yolov8n. Drop a fine-tuned
# best.pt into apps/worker/weights/ later to override.
RUN mkdir -p weights && \
    curl -fSL https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n-obb.pt \
      -o weights/best.pt

RUN pip install --upgrade pip && pip install .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
