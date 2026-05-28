"""Export Supabase-stored labels into a YOLO-format dataset on disk.

Layout produced
---------------
datasets/<run>/
  data.yaml
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt
  labels/val/*.txt
"""
from __future__ import annotations

import argparse
import io
import json
import random
from pathlib import Path

import httpx
from PIL import Image
from supabase import create_client

from app.config import settings

CLASSES = ["cylinder", "bulk_tank", "bottle_bank", "lng_tank"]
CLASS_INDEX = {c: i for i, c in enumerate(CLASSES)}


def export(out_dir: Path, val_frac: float = 0.15, seed: int = 7) -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SystemExit("Supabase env not configured.")

    sb = create_client(settings.supabase_url, settings.supabase_service_role_key)
    labels = sb.table("training_labels").select(
        "id, class, bbox_pixels, is_negative, "
        "imagery_tiles(storage_path, width_px, height_px)"
    ).execute().data or []

    if not labels:
        raise SystemExit("No training_labels rows found.")

    random.Random(seed).shuffle(labels)
    split = int(len(labels) * (1 - val_frac))
    train, val = labels[:split], labels[split:]

    for sub in ("images/train", "images/val", "labels/train", "labels/val"):
        (out_dir / sub).mkdir(parents=True, exist_ok=True)

    for rows, split_name in ((train, "train"), (val, "val")):
        _write_split(sb, rows, out_dir, split_name)

    (out_dir / "data.yaml").write_text(
        "path: .\n"
        "train: images/train\n"
        "val: images/val\n"
        f"nc: {len(CLASSES)}\n"
        f"names: {json.dumps(CLASSES)}\n",
    )
    print(f"Wrote dataset to {out_dir} ({len(train)} train / {len(val)} val).")


def _write_split(sb, rows, out_dir: Path, split: str) -> None:
    for row in rows:
        tile = row.get("imagery_tiles")
        if not tile or row.get("is_negative"):
            continue
        signed = sb.storage.from_("imagery").create_signed_url(tile["storage_path"], 3600)
        url = signed.get("signedURL") or signed.get("signed_url")
        if not url:
            continue
        img_bytes = httpx.get(url, timeout=30, follow_redirects=True).content
        Image.open(io.BytesIO(img_bytes)).convert("RGB").save(out_dir / f"images/{split}/{row['id']}.jpg")

        x1, y1, x2, y2 = row["bbox_pixels"]
        w, h = tile["width_px"], tile["height_px"]
        cx = (x1 + x2) / 2 / w
        cy = (y1 + y2) / 2 / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        cls_idx = CLASS_INDEX.get(row["class"], 0)
        (out_dir / f"labels/{split}/{row['id']}.txt").write_text(
            f"{cls_idx} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="datasets/latest")
    args = parser.parse_args()
    export(Path(args.out))
