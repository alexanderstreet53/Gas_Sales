"""YOLOv8 inference wrapper.

Loads `settings.model_weights` once at import time, then exposes `detector.run`
for the FastAPI handler.

The default weights shipped in the image are `yolov8n-obb.pt` — Ultralytics'
model trained on DOTA, an aerial/satellite imagery dataset. Unlike the COCO
`yolov8n.pt`, it actually detects things from a top-down view, and its class
list includes `storage-tank`, `large-vehicle` and `small-vehicle` — directly
useful for spotting gas infrastructure and the vehicles in a yard.

Handles both:
  * OBB models (DOTA) — results carry `.obb`, oriented boxes; we use the
    axis-aligned enclosing box for storage in the existing [x1,y1,x2,y2] schema.
  * Regular models (COCO, or a user's fine-tuned best.pt) — results carry
    `.boxes`.
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

DEFAULT_FALLBACK = "yolov8n-obb.pt"


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]   # x1, y1, x2, y2 in tile pixel coords


class Detector:
    def __init__(self, weights_path: str) -> None:
        path = Path(weights_path)
        if not path.exists():
            log.warning("Weights %s missing — falling back to %s", weights_path, DEFAULT_FALLBACK)
            self.model = YOLO(DEFAULT_FALLBACK)
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
        for r in results:
            names = r.names
            # OBB (DOTA) results expose .obb; regular detection results expose .boxes.
            obb = getattr(r, "obb", None)
            if obb is not None and len(obb) > 0:
                xyxy = obb.xyxy.cpu().numpy()      # axis-aligned enclosing box
                confs = obb.conf.cpu().numpy()
                cls_idx = obb.cls.cpu().numpy().astype(int)
            elif r.boxes is not None and len(r.boxes) > 0:
                xyxy = r.boxes.xyxy.cpu().numpy()
                confs = r.boxes.conf.cpu().numpy()
                cls_idx = r.boxes.cls.cpu().numpy().astype(int)
            else:
                continue

            for i in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[i].tolist()
                raw = names.get(int(cls_idx[i]), str(cls_idx[i]))
                out.append(Detection(
                    label=_alias(raw),
                    confidence=float(confs[i]),
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                ))
        return out


def _alias(label: str) -> str:
    """Normalise model class names onto our schema.

    Maps DOTA's aerial classes (and a couple of COCO ones) onto the labels the
    rest of the app uses. Unknown labels (e.g. from a fine-tuned model that
    already outputs `bulk_tank`) pass through unchanged.
    """
    key = label.lower().replace("_", "-").strip()
    return {
        # DOTA (aerial) classes
        "storage-tank":  "bulk_tank",
        "small-vehicle": "car",
        "large-vehicle": "truck",
        "ship":          "ship",
        "plane":         "plane",
        # COCO fallbacks (if a COCO model is ever loaded)
        "bottle": "cylinder",
        "barrel": "bulk_tank",
        "vase":   "cylinder",
        "truck":  "truck",
        "car":    "car",
    }.get(key, label)


detector = Detector(os.environ.get("MODEL_WEIGHTS", settings.model_weights))
