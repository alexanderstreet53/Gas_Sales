# Worker

FastAPI service that runs YOLOv8 inference on cached tiles.

## Endpoints

| Method | Path             | What it does                                              |
| ------ | ---------------- | --------------------------------------------------------- |
| GET    | `/healthz`       | Liveness + reports loaded `model_version`.                |
| POST   | `/detect`        | Inference on one tile by URL; returns georef'd boxes.     |
| POST   | `/detect/batch`  | Inference on many tiles in one request.                   |

All non-health routes require an `X-API-Key` header matching `WORKER_API_KEY`.

## Local

```bash
cd apps/worker
cp .env.example .env
pip install -e .                # uses pyproject.toml
uvicorn app.main:app --reload
```

## Fine-tune

1. Label crops via the web app (`/label`).
2. Export the dataset:
   ```bash
   python -m app.training.dataset --out datasets/v1
   ```
3. Train:
   ```bash
   python -m app.training.train --data datasets/v1/data.yaml --epochs 50
   ```
4. Drop the resulting `best.pt` into `weights/` and bounce the worker.

## Deploy to Fly.io

```bash
fly launch --no-deploy --copy-config           # uses fly.toml in this dir
fly secrets set WORKER_API_KEY=...
fly deploy
```

On Hobby plans set `min_machines_running = 0` (already configured) so the
worker scales to zero between sweeps.
