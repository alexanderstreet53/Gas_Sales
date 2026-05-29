// Run a Street View scan for a single lead. Fetches the panorama, then
// — if the worker is configured — runs YOLO over the panorama to find
// cylinders / tanks visible at street level (where they're way more
// detectable than from satellite). Detection results are stored in the
// detections table with location = camera position (the lead's coords),
// because pixels in a 2D street-level shot can't be georeferenced.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchStreetViewTile } from "@/lib/imagery/google";
import { callDetect } from "@/lib/worker";
import { normalizePoint } from "@/lib/geo/parse";
import { env } from "@/lib/env";
import { makeDemoDetections, seedFromString, DEMO_MODEL_VERSION } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isDemo = new URL(req.url).searchParams.get("demo") === "1";

  if (!env.googleKey) {
    return NextResponse.json(
      {
        error: "google_key_missing",
        message: "GOOGLE_MAPS_API_KEY is not set in Vercel. Add it under Settings → Environment Variables and redeploy.",
      },
      { status: 400 },
    );
  }

  const sb = supabaseService();
  const { data: lead, error } = await sb
    .from("leads")
    .select("id, zone_id, site_id, enrichment, sites(centroid)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead)  return NextResponse.json({ error: "not_found" }, { status: 404 });

  const siteRaw = (lead.sites as unknown) as { centroid?: unknown } | { centroid?: unknown }[] | null;
  const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
  const point = normalizePoint(site?.centroid);
  if (!point) {
    return NextResponse.json(
      { error: "no_site_centroid", message: "This lead has no site centroid set." },
      { status: 400 },
    );
  }

  // 1. Fetch the Street View panorama (cached).
  let tile;
  try {
    tile = await fetchStreetViewTile({
      zoneId: lead.zone_id as string,
      lat: point.lat,
      lng: point.lng,
      heading: 0,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const prior = (lead.enrichment as Record<string, unknown> | null) ?? {};
  await sb.from("leads").update({
    enrichment: { ...prior, streetview: { tile_id: tile.id, fetched_at: new Date().toISOString() } },
  }).eq("id", id);

  // 2. Run AI on the panorama. Real or demo, depending on the flag.
  //    Don't fail the scan if the worker is unreachable — the imagery
  //    is already cached and useful on its own.
  let detected = 0;
  let detectionError: string | null = null;
  const workerConfigured = env.workerUrl && !env.workerUrl.includes("localhost");
  const workerSkipped = !isDemo && !workerConfigured;

  if (isDemo || workerConfigured) {
    try {
      // Dedupe: skip if this tile already has detections from the same source.
      const { data: existing } = await sb
        .from("detections")
        .select("id", { count: "exact", head: true })
        .eq("tile_id", tile.id);
      const alreadyDetected = (existing as unknown as { count?: number } | null)?.count ?? 0;

      if (!alreadyDetected) {
        let resp;
        if (isDemo) {
          const demoBoxes = makeDemoDetections({
            width: tile.width_px,
            height: tile.height_px,
            source: "streetview",
            seed: seedFromString(tile.id),
          });
          resp = {
            model_version: DEMO_MODEL_VERSION,
            detections: demoBoxes.map(d => ({ ...d, lat: point.lat, lng: point.lng })),
          };
        } else {
          resp = await callDetect({
            tileId: tile.id,
            imageUrl: tile.signedUrl,
            centerLat: point.lat,
            centerLng: point.lng,
            zoom: 19,
            widthPx: tile.width_px,
            heightPx: tile.height_px,
          });
        }

        const rows = resp.detections.map(d => ({
          tile_id: tile.id,
          zone_id: lead.zone_id,
          site_id: (lead as { site_id?: string | null }).site_id ?? null,
          class: d.class,
          confidence: d.confidence,
          bbox_pixels: d.bbox_pixels,
          location: `SRID=4326;POINT(${point.lng} ${point.lat})`,
          model_version: resp.model_version,
        }));

        if (rows.length > 0) {
          const { error: insErr } = await sb.from("detections").insert(rows);
          if (insErr) detectionError = `insert failed: ${insErr.message}`;
        }
        detected = rows.length;
      }
    } catch (e) {
      detectionError = (e as Error).message;
    }
  }

  return NextResponse.json({
    ok: true,
    demo: isDemo,
    tileId: tile.id,
    detected,
    detectionError,
    workerSkipped,
  });
}
