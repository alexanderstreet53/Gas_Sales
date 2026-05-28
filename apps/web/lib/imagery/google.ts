// Cached fetchers for Google Maps Static + Street View Static.
//
// Cache rules (see also lib/imagery/cache.ts):
//   * Every fetch is keyed by a sha256 of the canonical params, so identical
//     requests share a single Storage object.
//   * Within IMAGERY_TTL_DAYS the cached blob is returned and ZERO API call
//     is made. A `cache_hit:true` row is still logged for analytics.
//   * We enforce a 24h spend cap (IMAGERY_DAILY_CAP_USD); over it, fetches
//     fail fast.

import { env } from "@/lib/env";
import { cacheKey, findFreshTile, storeTile, type CachedTile } from "@/lib/imagery/cache";
import { logSpend, spendLast24hUsd } from "@/lib/imagery/cost";

const STATIC_MAPS_URL = "https://maps.googleapis.com/maps/api/staticmap";
const STREETVIEW_URL  = "https://maps.googleapis.com/maps/api/streetview";

async function assertWithinBudget(): Promise<void> {
  const spent = await spendLast24hUsd();
  if (spent >= env.imageryDailyCapUsd) {
    throw new Error(
      `Daily imagery spend cap reached: $${spent.toFixed(2)} ≥ $${env.imageryDailyCapUsd}. ` +
      `Raise IMAGERY_DAILY_CAP_USD if intentional.`,
    );
  }
}

export interface FetchSatelliteArgs {
  zoneId: string | null;
  centerLat: number;
  centerLng: number;
  zoom: number;
  size?: { w: number; h: number };
  scale?: 1 | 2;
}

export async function fetchSatelliteTile(a: FetchSatelliteArgs): Promise<CachedTile> {
  const w = a.size?.w ?? 640;
  const h = a.size?.h ?? 640;
  const scale = a.scale ?? 1;
  const key = cacheKey({
    provider: "google", kind: "satellite",
    lat: a.centerLat.toFixed(7), lng: a.centerLng.toFixed(7),
    z: a.zoom, w, h, scale,
  });

  const hit = await findFreshTile(key);
  if (hit) {
    await logSpend({
      provider: "google_static", endpoint: "staticmap",
      zoneId: a.zoneId, cacheHit: true, meta: { key },
    });
    return hit;
  }

  await assertWithinBudget();
  if (!env.googleKey) throw new Error("GOOGLE_MAPS_API_KEY is not set.");

  const url = new URL(STATIC_MAPS_URL);
  url.searchParams.set("center", `${a.centerLat},${a.centerLng}`);
  url.searchParams.set("zoom", String(a.zoom));
  url.searchParams.set("size", `${w}x${h}`);
  url.searchParams.set("scale", String(scale));
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("format", "jpg");
  url.searchParams.set("key", env.googleKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Static Maps fetch failed: ${res.status} ${await res.text()}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const tile = await storeTile({
    key, zoneId: a.zoneId, kind: "satellite",
    centerLat: a.centerLat, centerLng: a.centerLng,
    widthPx: w * scale, heightPx: h * scale, bytes,
    contentType: "image/jpeg",
    meta: { zoom: a.zoom, scale },
  });
  await logSpend({
    provider: "google_static", endpoint: "staticmap",
    zoneId: a.zoneId, cacheHit: false, meta: { key, zoom: a.zoom, scale },
  });
  return tile;
}

export interface FetchStreetViewArgs {
  zoneId: string | null;
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  fov?: number;
  size?: { w: number; h: number };
}

export async function fetchStreetViewTile(a: FetchStreetViewArgs): Promise<CachedTile> {
  const heading = a.heading ?? 0;
  const pitch   = a.pitch ?? 0;
  const fov     = a.fov ?? 90;
  const w       = a.size?.w ?? 640;
  const h       = a.size?.h ?? 640;
  const key = cacheKey({
    provider: "google", kind: "streetview",
    lat: a.lat.toFixed(7), lng: a.lng.toFixed(7),
    heading, pitch, fov, w, h,
  });

  const hit = await findFreshTile(key);
  if (hit) {
    await logSpend({
      provider: "google_streetview", endpoint: "streetview",
      zoneId: a.zoneId, cacheHit: true, meta: { key },
    });
    return hit;
  }

  await assertWithinBudget();
  if (!env.googleKey) throw new Error("GOOGLE_MAPS_API_KEY is not set.");

  const url = new URL(STREETVIEW_URL);
  url.searchParams.set("location", `${a.lat},${a.lng}`);
  url.searchParams.set("size", `${w}x${h}`);
  url.searchParams.set("heading", String(heading));
  url.searchParams.set("pitch",   String(pitch));
  url.searchParams.set("fov",     String(fov));
  url.searchParams.set("key", env.googleKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Street View fetch failed: ${res.status} ${await res.text()}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const tile = await storeTile({
    key, zoneId: a.zoneId, kind: "streetview",
    centerLat: a.lat, centerLng: a.lng,
    heading, pitch,
    widthPx: w, heightPx: h, bytes,
    contentType: "image/jpeg",
    meta: { heading, pitch, fov },
  });
  await logSpend({
    provider: "google_streetview", endpoint: "streetview",
    zoneId: a.zoneId, cacheHit: false, meta: { key, heading, pitch, fov },
  });
  return tile;
}

// ---- Geocoding (light enrichment) -----------------------------------------
export async function reverseGeocode(lat: number, lng: number): Promise<{
  formatted: string | null;
  placeId: string | null;
} | null> {
  if (!env.googleKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", env.googleKey);

  const res = await fetch(url.toString());
  await logSpend({
    provider: "google_geocoding", endpoint: "geocode/json",
    zoneId: null, meta: { lat, lng },
  });
  if (!res.ok) return null;
  const payload = await res.json() as { results?: Array<{ formatted_address?: string; place_id?: string }> };
  const first = payload.results?.[0];
  return first ? { formatted: first.formatted_address ?? null, placeId: first.place_id ?? null } : null;
}
