# Detection worker — runs YOLOv8 inference behind a FastAPI HTTP shim.
# The PyTorch image is large (~3.5GB) but ready out of the box for CPU
# inference. For GPU, swap to nvidia/cuda + install torch from index.

FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY weights ./weights

RUN pip install --upgrade pip && pip install .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
