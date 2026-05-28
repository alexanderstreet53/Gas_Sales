// Web Mercator / Google tile math.
//
// Notes
//   * Google Maps Static API returns an image of arbitrary size, not a slippy
//     tile — but it's helpful to plan a grid in tile space, then render each
//     cell at a fixed 640×640 (the free Static Maps tier max).
//   * Functions here intentionally avoid any deps; pure math.

import * as turf from "@turf/turf";

const TILE_SIZE = 256;

/** Project lat/lng → world pixel coords at zoom `z`. */
export function latLngToPixel(lat: number, lng: number, z: number): [number, number] {
  const scale = TILE_SIZE * 2 ** z;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const x = scale * (lng / 360 + 0.5);
  const y = scale * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI));
  return [x, y];
}

/** Inverse of latLngToPixel. */
export function pixelToLatLng(px: number, py: number, z: number): [number, number] {
  const scale = TILE_SIZE * 2 ** z;
  const lng = (px / scale - 0.5) * 360;
  const n = Math.PI - 2 * Math.PI * (py / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lat, lng];
}

/** Metres per pixel at the given latitude / zoom. */
export function metresPerPixel(lat: number, z: number): number {
  return (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * 6378137) / (TILE_SIZE * 2 ** z);
}

export interface TileCell {
  z: number;
  /** Cell index within the zone's bounding box. */
  ix: number;
  iy: number;
  /** Centre lat/lng — what we pass to the Static Maps API. */
  centerLat: number;
  centerLng: number;
  /** Bounds polygon as a GeoJSON ring (lng, lat). */
  bounds: GeoJSON.Polygon;
}

/**
 * Tile a zone polygon into a grid of fixed-pixel cells at zoom `z`.
 * Only cells whose centre intersects the zone are returned, so we never
 * fetch imagery outside the user-defined area.
 */
export function tileZone(
  zone: GeoJSON.Polygon,
  z: number,
  cellPx = 640,
): TileCell[] {
  const bbox = turf.bbox(zone);                  // [minLng, minLat, maxLng, maxLat]
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const [minPx, minPy] = latLngToPixel(maxLat, minLng, z);   // top-left
  const [maxPx, maxPy] = latLngToPixel(minLat, maxLng, z);   // bottom-right

  const cells: TileCell[] = [];
  const cols = Math.ceil((maxPx - minPx) / cellPx);
  const rows = Math.ceil((maxPy - minPy) / cellPx);

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const cx = minPx + (ix + 0.5) * cellPx;
      const cy = minPy + (iy + 0.5) * cellPx;
      const [centerLat, centerLng] = pixelToLatLng(cx, cy, z);

      const [nwLat, nwLng] = pixelToLatLng(minPx + ix * cellPx,       minPy + iy * cellPx,       z);
      const [seLat, seLng] = pixelToLatLng(minPx + (ix + 1) * cellPx, minPy + (iy + 1) * cellPx, z);

      const cellPoly: GeoJSON.Polygon = {
        type: "Polygon",
        coordinates: [[
          [nwLng, nwLat], [seLng, nwLat], [seLng, seLat], [nwLng, seLat], [nwLng, nwLat],
        ]],
      };

      const centerPt = turf.point([centerLng, centerLat]);
      if (turf.booleanPointInPolygon(centerPt, zone)) {
        cells.push({ z, ix, iy, centerLat, centerLng, bounds: cellPoly });
      }
    }
  }
  return cells;
}

/** Pixel (x,y) within a tile centered at (centerLat, centerLng) → world (lat,lng). */
export function tilePixelToLatLng(
  px: number, py: number,
  tileWidthPx: number, tileHeightPx: number,
  centerLat: number, centerLng: number,
  z: number,
): [number, number] {
  const [cxPx, cyPx] = latLngToPixel(centerLat, centerLng, z);
  const worldPx = cxPx + (px - tileWidthPx / 2);
  const worldPy = cyPx + (py - tileHeightPx / 2);
  return pixelToLatLng(worldPx, worldPy, z);
}
