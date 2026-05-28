"""Pixel ↔ lat/lng for Web Mercator tiles. Mirror of apps/web/lib/geo/tiles.ts."""
from __future__ import annotations

import math

TILE_SIZE = 256


def lat_lng_to_pixel(lat: float, lng: float, zoom: int) -> tuple[float, float]:
    scale = TILE_SIZE * (2 ** zoom)
    sin_lat = math.sin(lat * math.pi / 180.0)
    x = scale * (lng / 360.0 + 0.5)
    y = scale * (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi))
    return x, y


def pixel_to_lat_lng(px: float, py: float, zoom: int) -> tuple[float, float]:
    scale = TILE_SIZE * (2 ** zoom)
    lng = (px / scale - 0.5) * 360.0
    n = math.pi - 2 * math.pi * (py / scale)
    lat = (180.0 / math.pi) * math.atan(0.5 * (math.exp(n) - math.exp(-n)))
    return lat, lng


def pixel_bbox_to_lat_lng(
    cx: float, cy: float,
    tile_w_px: int, tile_h_px: int,
    center_lat: float, center_lng: float,
    zoom: int,
) -> tuple[float, float]:
    """Convert a (cx, cy) inside a tile to (lat, lng)."""
    c_world_x, c_world_y = lat_lng_to_pixel(center_lat, center_lng, zoom)
    world_x = c_world_x + (cx - tile_w_px / 2)
    world_y = c_world_y + (cy - tile_h_px / 2)
    return pixel_to_lat_lng(world_x, world_y, zoom)
