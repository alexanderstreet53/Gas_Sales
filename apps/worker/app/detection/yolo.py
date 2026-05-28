"""YOLOv8 inference wrapper.

Loads `settings.model_weights` once at import time, then exposes `detector.run`
for the FastAPI handler. If the weights file is missing, we fall back to the
pretrained `yolov8n.pt` so /detect still returns sensible (if generic) boxes
before the user has fine-tuned anything — the goal is end-to-end smoke before
training quality.
"""
from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import httpx
from PIL import Image
from ultralytics import YOLO

from app.config import settings

log = logging.getLogger("worker.detection")


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]   # x1, y1, x2, y2 in tile pixel coords


class Detector:
    def __init__(self, weights_path: str) -> None:
        path = Path(weights_path)
        if not path.exists():
            log.warning("Weights %s missing — falling back to yolov8n.pt", weights_path)
            self.model = YOLO("yolov8n.pt")
            self.is_finetuned = False
        else:
            self.model = YOLO(weights_path)
            self.is_finetuned = True
        log.info("Loaded model %s (fine-tuned=%s)", weights_path, self.is_finetuned)

    def _load_image(self, url: str) -> Image.Image:
        if url.startswith("http"):
            resp = httpx.get(url, timeout=30.0, follow_redirects=True)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
        return Image.open(url).convert("RGB")

    def run(self, image_url: str, conf: float | None = None) -> list[Detection]:
        img = self._load_image(image_url)
        conf = conf if conf is not None else settings.conf_threshold
        results = self.model.predict(
            img,
            conf=conf,
            iou=settings.iou_threshold,
            max_det=settings.max_detections,
            verbose=False,
        )
        out: list[Detection] = []
        names = results[0].names if results else {}
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            cls_idx = boxes.cls.cpu().numpy().astype(int)
            for i in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[i].tolist()
                label = names.get(int(cls_idx[i]), str(cls_idx[i]))
                if not self.is_finetuned:
                    # Map a few COCO classes onto our schema as a coarse smoke test.
                    label = _coco_alias(label)
                out.append(Detection(
                    label=label,
                    confidence=float(confs[i]),
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                ))
        return out


def _coco_alias(label: str) -> str:
    # Until we fine-tune, surface anything tank-shaped to the reviewer.
    return {
        "bottle": "cylinder",
        "barrel": "bulk_tank",
        "vase":   "cylinder",
    }.get(label, label)


detector = Detector(os.environ.get("MODEL_WEIGHTS", settings.model_weights))
