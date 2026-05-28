// Runs YOLO inference on a single cached tile via the worker, then writes
// detections back to the database.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { callDetect } from "@/lib/worker";
import { tilePixelToLatLng } from "@/lib/geo/tiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ tileId: z.string().uuid() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sb = supabaseService();
  const { data: tile, error } = await sb
    .from("imagery_tiles")
    .select("id, zone_id, center, storage_path, width_px, height_px, z")
    .eq("id", parsed.data.tileId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tile)  return NextResponse.json({ error: "tile_not_found" }, { status: 404 });

  const signed = await sb.storage.from("imagery").createSignedUrl(tile.storage_path, 60 * 60);
  if (signed.error || !signed.data) {
    return NextResponse.json({ error: "tile_signed_url_failed" }, { status: 500 });
  }

  const center = tile.center as unknown as GeoJSON.Point;
  const [centerLng, centerLat] = center.coordinates;

  const detectResp = await callDetect({
    tileId: tile.id,
    imageUrl: signed.data.signedUrl,
    centerLat, centerLng,
    zoom: tile.z ?? 19,
    widthPx: tile.width_px, heightPx: tile.height_px,
  });

  // Persist each detection, computing the georeferenced centroid.
  const rows = detectResp.detections.map(d => {
    const cx = (d.bbox_pixels[0] + d.bbox_pixels[2]) / 2;
    const cy = (d.bbox_pixels[1] + d.bbox_pixels[3]) / 2;
    const [lat, lng] = tilePixelToLatLng(cx, cy, tile.width_px, tile.height_px,
      centerLat, centerLng, tile.z ?? 19);
    return {
      tile_id: tile.id,
      zone_id: tile.zone_id,
      class: d.class,
      confidence: d.confidence,
      bbox_pixels: d.bbox_pixels,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      model_version: detectResp.model_version,
    };
  });

  if (rows.length > 0) {
    const { error: insErr } = await sb.from("detections").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({
    count: rows.length,
    model_version: detectResp.model_version,
  });
}
