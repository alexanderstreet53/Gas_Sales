"""FastAPI shim around the YOLOv8 detector.

Routes
------
GET  /healthz         liveness
POST /detect          run inference on a tile by URL
POST /detect/batch    inference over many tiles
"""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.detection.geo import pixel_bbox_to_lat_lng
from app.detection.yolo import detector

logging.basicConfig(level=settings.log_level.upper())
log = logging.getLogger("worker")

app = FastAPI(title="Gas Tank Detection Worker", version="0.1.0")


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not x_api_key or x_api_key != settings.worker_api_key:
        raise HTTPException(status_code=401, detail="invalid api key")


class DetectRequest(BaseModel):
    tileId: str
    imageUrl: str
    centerLat: float
    centerLng: float
    zoom: int = 19
    widthPx: int
    heightPx: int
    confThreshold: float | None = None


class DetectionOut(BaseModel):
    class_: str = Field(alias="class")
    confidence: float
    bbox_pixels: tuple[int, int, int, int]
    lat: float
    lng: float

    model_config = {"populate_by_name": True}


class DetectResponse(BaseModel):
    model_version: str
    detections: list[DetectionOut]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "model_version": settings.model_version}


@app.post("/detect", response_model=DetectResponse, dependencies=[Depends(require_api_key)])
def detect(req: DetectRequest) -> DetectResponse:
    conf = req.confThreshold if req.confThreshold is not None else settings.conf_threshold
    results = detector.run(req.imageUrl, conf=conf)
    out: list[DetectionOut] = []
    for r in results:
        cx = (r.bbox[0] + r.bbox[2]) / 2
        cy = (r.bbox[1] + r.bbox[3]) / 2
        lat, lng = pixel_bbox_to_lat_lng(
            cx, cy, req.widthPx, req.heightPx,
            req.centerLat, req.centerLng, req.zoom,
        )
        out.append(DetectionOut.model_validate({
            "class": r.label,
            "confidence": r.confidence,
            "bbox_pixels": r.bbox,
            "lat": lat,
            "lng": lng,
        }))
    return DetectResponse(model_version=settings.model_version, detections=out)


class BatchRequest(BaseModel):
    tiles: list[DetectRequest]


class BatchResponse(BaseModel):
    model_version: str
    results: list[DetectResponse]


@app.post("/detect/batch", response_model=BatchResponse, dependencies=[Depends(require_api_key)])
def detect_batch(req: BatchRequest) -> BatchResponse:
    return BatchResponse(
        model_version=settings.model_version,
        results=[detect(t) for t in req.tiles],
    )
