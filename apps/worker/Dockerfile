# Detection worker — runs YOLOv8 inference behind a FastAPI HTTP shim.
# The PyTorch image is large (~3.5GB) but ready out of the box for CPU
# inference. For GPU, swap to nvidia/cuda + install torch from index.

FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app

# Download pretrained YOLOv8n at build time so the worker boots fast and
# the repo doesn't need a committed weights file. Drop a fine-tuned
# best.pt into weights/ later to override.
RUN mkdir -p weights && \
    curl -fSL https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt \
      -o weights/best.pt

RUN pip install --upgrade pip && pip install .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
