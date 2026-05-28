"""Fine-tune YOLOv8n on the exported gas-tank dataset.

Usage:
  python -m app.training.dataset --out datasets/v1
  python -m app.training.train   --data datasets/v1/data.yaml --epochs 50
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def train(data: str, epochs: int, imgsz: int, project: str, name: str) -> Path:
    model = YOLO("yolov8n.pt")
    results = model.train(
        data=data,
        epochs=epochs,
        imgsz=imgsz,
        project=project,
        name=name,
        patience=10,
    )
    best = Path(results.save_dir) / "weights" / "best.pt"
    print(f"Best weights: {best}")
    return best


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--project", default="runs")
    parser.add_argument("--name", default="finetune")
    args = parser.parse_args()
    train(args.data, args.epochs, args.imgsz, args.project, args.name)
