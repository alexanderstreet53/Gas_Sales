// Run YOLO detection on the single cached satellite tile that covers
// this lead's site centroid. Useful when you just want to check one
// business without sweeping the whole zone.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { callDetect } from "@/lib/worker";
import { tilePixelToLatLng, metresPerPixel } from "@/lib/geo/tiles";
import { normalizePoint } from "@/lib/geo/parse";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!env.workerUrl || env.workerUrl.includes("localhost")) {
    return NextResponse.json(
      { error: "worker_not_configured", message: "WORKER_URL is not set in Vercel. Deploy the worker and set WORKER_URL + WORKER_API_KEY first." },
      { status: 400 },
    );
  }

  const sb = supabaseService();

  // 1. Lead + site centroid
  const { data: lead, error } = await sb
    .from("leads")
    .select("id, zone_id, sites(centroid)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead)  return NextResponse.json({ error: "not_found" }, { status: 404 });

  const siteRaw = (lead.sites as unknown) as { centroid?: unknown } | { centroid?: unknown }[] | null;
  const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
  const leadPoint = normalizePoint(site?.centroid);
  if (!leadPoint) {
    return NextResponse.json(
      { error: "no_site_centroid", message: "This lead has no site centroid." },
      { status: 400 },
    );
  }

  // 2. All cached satellite tiles in this zone
  const { data: tiles, error: tilesErr } = await sb
    .from("imagery_tiles")
    .select("id, zone_id, center, storage_path, width_px, height_px, z")
    .eq("zone_id", lead.zone_id)
    .eq("kind", "satellite");
  if (tilesErr) return NextResponse.json({ error: tilesErr.message }, { status: 500 });
  if (!tiles || tiles.length === 0) {
    return NextResponse.json(
      { error: "no_cached_tiles", message: "No satellite tiles cached for this zone yet. Run the imagery sweep on the zone first." },
      { status: 400 },
    );
  }

  // 3. Pick the tile whose centre is closest to the lead (great-circle approx).
  let best: typeof tiles[number] | null = null;
  let bestPoint: { lat: number; lng: number } | null = null;
  let bestDist = Infinity;
  for (const t of tiles) {
    const p = normalizePoint(t.center);
    if (!p) continue;
    const dy = (p.lat - leadPoint.lat) * 111_320;
    const dx = (p.lng - leadPoint.lng) * 111_320 * Math.cos((leadPoint.lat * Math.PI) / 180);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) { bestDist = dist; best = t; bestPoint = p; }
  }
  if (!best || !bestPoint) {
    return NextResponse.json({ error: "no_tile_match" }, { status: 500 });
  }

  // Sanity: tile should actually cover the lead, not be 5km away.
  const mPerPx = metresPerPixel(bestPoint.lat, best.z ?? 19);
  const tileRadiusM = (Math.max(best.width_px, best.height_px) / 2) * mPerPx;
  if (bestDist > tileRadiusM * 1.5) {
    return NextResponse.json({
      error: "lead_outside_cached_tiles",
      message: `The closest cached tile is ${(bestDist / 1000).toFixed(2)} km from this lead. Run an imagery sweep that covers this area.`,
    }, { status: 400 });
  }

  // 4. Call the worker on that tile.
  const signed = await sb.storage.from("imagery").createSignedUrl(best.storage_path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  let detectResp;
  try {
    detectResp = await callDetect({
      tileId: best.id,
      imageUrl: signed.data.signedUrl,
      centerLat: bestPoint.lat,
      centerLng: bestPoint.lng,
      zoom: best.z ?? 19,
      widthPx: best.width_px,
      heightPx: best.height_px,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // 5. Persist detections (skip duplicates already on this tile).
  const { data: existing } = await sb
    .from("detections")
    .select("bbox_pixels")
    .eq("tile_id", best.id);
  const existingBboxes = new Set((existing ?? []).map(d => JSON.stringify(d.bbox_pixels)));

  const newRows = detectResp.detections
    .filter(d => !existingBboxes.has(JSON.stringify(d.bbox_pixels)))
    .map(d => {
      const cx = (d.bbox_pixels[0] + d.bbox_pixels[2]) / 2;
      const cy = (d.bbox_pixels[1] + d.bbox_pixels[3]) / 2;
      const [lat, lng] = tilePixelToLatLng(
        cx, cy, best!.width_px, best!.height_px,
        bestPoint!.lat, bestPoint!.lng, best!.z ?? 19,
      );
      return {
        tile_id: best!.id,
        zone_id: best!.zone_id,
        class: d.class,
        confidence: d.confidence,
        bbox_pixels: d.bbox_pixels,
        location: `SRID=4326;POINT(${lng} ${lat})`,
        model_version: detectResp.model_version,
      };
    });

  if (newRows.length > 0) {
    const { error: insErr } = await sb.from("detections").insert(newRows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tileId: best.id,
    tileDistanceM: Math.round(bestDist),
    detectionsFound: detectResp.detections.length,
    newlyInserted: newRows.length,
    duplicates: detectResp.detections.length - newRows.length,
  });
}
