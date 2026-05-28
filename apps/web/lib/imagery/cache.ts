// Supabase Storage-backed cache for fetched imagery.
//
// Cache contract:
//   * Look up by `cache_key` (a stable hash of provider + params).
//   * A row in `imagery_tiles` exists IFF the blob exists in Storage.
//   * If `expires_at <= now()` we treat the row as missing.

import { createHash } from "node:crypto";
import type { TileKind } from "@/lib/types";
import { env } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/server";

const BUCKET = "imagery";

export function cacheKey(parts: Record<string, string | number>): string {
  const canonical = Object.keys(parts).sort().map(k => `${k}=${parts[k]}`).join("&");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

export interface CachedTile {
  id: string;
  storage_path: string;
  signedUrl: string;
  width_px: number;
  height_px: number;
  fetched_at: string;
}

export async function findFreshTile(key: string): Promise<CachedTile | null> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("imagery_tiles")
    .select("id, storage_path, width_px, height_px, fetched_at, expires_at")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const signed = await sb.storage.from(BUCKET).createSignedUrl(data.storage_path, 60 * 60);
  if (signed.error || !signed.data) return null;
  return {
    id: data.id,
    storage_path: data.storage_path,
    signedUrl: signed.data.signedUrl,
    width_px: data.width_px,
    height_px: data.height_px,
    fetched_at: data.fetched_at,
  };
}

export interface StoreTileArgs {
  key: string;
  zoneId: string | null;
  kind: TileKind;
  z?: number; x?: number; y?: number;
  centerLat: number; centerLng: number;
  bounds?: GeoJSON.Polygon;
  heading?: number; pitch?: number;
  widthPx: number; heightPx: number;
  bytes: Uint8Array;
  contentType?: string;
  meta?: Record<string, unknown>;
}

export async function storeTile(a: StoreTileArgs): Promise<CachedTile> {
  const sb = supabaseService();
  const ext  = (a.contentType ?? "image/jpeg").split("/")[1] ?? "jpg";
  const path = `${a.kind}/${a.key}.${ext}`;

  const upload = await sb.storage.from(BUCKET).upload(path, a.bytes, {
    contentType: a.contentType ?? "image/jpeg",
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const expiresAt = new Date(Date.now() + env.imageryTtlDays * 86400_000).toISOString();
  const { data: row, error } = await sb
    .from("imagery_tiles")
    .upsert({
      cache_key:    a.key,
      zone_id:      a.zoneId,
      kind:         a.kind,
      provider:     "google",
      z:            a.z ?? null,
      x:            a.x ?? null,
      y:            a.y ?? null,
      center:       `SRID=4326;POINT(${a.centerLng} ${a.centerLat})`,
      bounds:       a.bounds ? toEwkt(a.bounds) : null,
      heading:      a.heading ?? null,
      pitch:        a.pitch ?? null,
      width_px:     a.widthPx,
      height_px:    a.heightPx,
      storage_path: path,
      bytes:        a.bytes.byteLength,
      expires_at:   expiresAt,
      meta:         a.meta ?? {},
    }, { onConflict: "cache_key" })
    .select("id, storage_path, width_px, height_px, fetched_at")
    .single();
  if (error) throw error;

  const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return {
    id: row.id,
    storage_path: row.storage_path,
    signedUrl: signed.data?.signedUrl ?? "",
    width_px: row.width_px,
    height_px: row.height_px,
    fetched_at: row.fetched_at,
  };
}

function toEwkt(poly: GeoJSON.Polygon): string {
  const ring = poly.coordinates[0].map(([lng, lat]) => `${lng} ${lat}`).join(",");
  return `SRID=4326;POLYGON((${ring}))`;
}
