// Normalise a Postgres/PostGIS Point that may arrive over the wire either
// as GeoJSON (when the project has "Use GeoJSON for geometry" enabled, or
// when reading from a view that calls ST_AsGeoJSON) or as the raw EWKB hex
// string (the PostgREST default for geometry/geography columns).
//
// EWKB-hex layout for a 2-D Point with SRID:
//   01                     — little-endian byte order
//   01000020               — type (Point) with SRID flag
//   E6100000               — SRID 4326, little-endian
//   <16 hex chars>         — X (longitude) as IEEE 754 float64 LE
//   <16 hex chars>         — Y (latitude)  as IEEE 754 float64 LE
// Total: 50 hex chars (25 bytes).

export interface LngLat { lng: number; lat: number }

export function parseEwkbPoint(hex: string): LngLat | null {
  if (typeof hex !== "string" || hex.length < 50) return null;
  try {
    const buf = new ArrayBuffer(16);
    const view = new DataView(buf);
    // X starts at hex offset 18 (1+4+4 bytes of header = 9 bytes = 18 hex chars).
    for (let i = 0; i < 16; i++) {
      view.setUint8(i, parseInt(hex.substr(18 + i * 2, 2), 16));
    }
    const lng = view.getFloat64(0, true);
    const lat = view.getFloat64(8, true);
    if (!isFinite(lng) || !isFinite(lat)) return null;
    return { lng, lat };
  } catch { return null; }
}

export function normalizePoint(value: unknown): LngLat | null {
  if (value == null) return null;
  // Already GeoJSON?
  if (typeof value === "object" && value !== null && "coordinates" in value) {
    const c = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (isFinite(lng) && isFinite(lat)) return { lng, lat };
    }
  }
  // Raw hex EWKB.
  if (typeof value === "string") return parseEwkbPoint(value);
  return null;
}
