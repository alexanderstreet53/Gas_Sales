// Run YOLO detection on a batch of cached tiles for a zone.
// Designed to be re-invoked until `stoppedReason==="complete"`.

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { supabaseService } from "@/lib/supabase/server";
import { callDetect } from "@/lib/worker";
import { tilePixelToLatLng } from "@/lib/geo/tiles";
import { normalizePoint } from "@/lib/geo/parse";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!env.workerUrl || env.workerUrl.includes("localhost")) {
    return NextResponse.json({
      error: "worker_not_configured",
      message: "WORKER_URL is not set in Vercel. Deploy the worker and set WORKER_URL + WORKER_API_KEY first.",
    }, { status: 400 });
  }

  const url = new URL(req.url);
  const chunk = Math.min(Number(url.searchParams.get("chunk") ?? 20), 60);

  const sb = supabaseService();

  // Pull a chunk of tiles for this zone that don't already have detections.
  const { data: tiles, error } = await sb
    .from("imagery_tiles")
    .select("id, zone_id, center, storage_path, width_px, height_px, z")
    .eq("zone_id", id)
    .eq("kind", "satellite")
    .limit(chunk);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tiles || tiles.length === 0) {
    return NextResponse.json({ tilesProcessed: 0, detected: 0, failed: 0, stoppedReason: "no_tiles" });
  }

  // Of those, find which already have detections (so we skip them).
  const tileIds = tiles.map(t => t.id);
  const { data: existing } = await sb
    .from("detections")
    .select("tile_id")
    .in("tile_id", tileIds);
  const already = new Set((existing ?? []).map(d => d.tile_id));
  const todo = tiles.filter(t => !already.has(t.id));

  const gate = pLimit(2);
  let processed = 0, detected = 0, failed = 0;
  const failures: string[] = [];

  await Promise.all(todo.map(tile => gate(async () => {
    try {
      const signed = await sb.storage.from("imagery").createSignedUrl(tile.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) { failed++; failures.push(`tile ${tile.id}: signed url`); return; }

      const center = normalizePoint(tile.center);
      if (!center) { failed++; failures.push(`tile ${tile.id}: bad centroid`); return; }

      const resp = await callDetect({
        tileId: tile.id,
        imageUrl: signed.data.signedUrl,
        centerLat: center.lat,
        centerLng: center.lng,
        zoom: tile.z ?? 19,
        widthPx: tile.width_px,
        heightPx: tile.height_px,
      });

      processed++;

      const rows = resp.detections.map(d => {
        const cx = (d.bbox_pixels[0] + d.bbox_pixels[2]) / 2;
        const cy = (d.bbox_pixels[1] + d.bbox_pixels[3]) / 2;
        const [lat, lng] = tilePixelToLatLng(
          cx, cy, tile.width_px, tile.height_px,
          center.lat, center.lng, tile.z ?? 19,
        );
        return {
          tile_id: tile.id,
          zone_id: tile.zone_id,
          class: d.class,
          confidence: d.confidence,
          bbox_pixels: d.bbox_pixels,
          location: `SRID=4326;POINT(${lng} ${lat})`,
          model_version: resp.model_version,
        };
      });

      if (rows.length > 0) {
        const { error: insErr } = await sb.from("detections").insert(rows);
        if (insErr) { failed++; failures.push(`tile ${tile.id}: insert ${insErr.message}`); return; }
        detected += rows.length;
      }
    } catch (e) {
      failed++;
      failures.push(`tile ${tile.id}: ${(e as Error).message}`);
    }
  })));

  return NextResponse.json({
    tilesProcessed: processed,
    skippedAlreadyDetected: already.size,
    detected, failed,
    failures: failures.slice(0, 5),
    stoppedReason: tiles.length < chunk ? "complete" : "chunk_limit",
  });
}
