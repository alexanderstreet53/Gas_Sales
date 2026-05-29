// Run a Street View scan for a single lead. Fetches the panorama at 4
// headings (N / E / S / W) so the AI can look in all directions, then
// runs YOLO on each. Caches per heading — re-scanning is free.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchStreetViewTile } from "@/lib/imagery/google";
import { callDetect } from "@/lib/worker";
import { normalizePoint } from "@/lib/geo/parse";
import { env } from "@/lib/env";
import { makeDemoDetections, seedFromString, DEMO_MODEL_VERSION } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADINGS = [0, 90, 180, 270] as const;
const HEADING_NAMES: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

interface ShotResult {
  heading: number;
  name: string;
  tile_id: string;
  detected: number;
  detectionError: string | null;
}

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

  const workerConfigured = env.workerUrl && !env.workerUrl.includes("localhost");
  const workerSkipped = !isDemo && !workerConfigured;

  // Fetch all 4 directions in parallel.
  const shots = await Promise.all(HEADINGS.map(async (heading): Promise<ShotResult | null> => {
    try {
      const tile = await fetchStreetViewTile({
        zoneId: lead.zone_id as string,
        lat: point.lat,
        lng: point.lng,
        heading,
      });

      // Run AI on this shot (or synthesise demo boxes), if not already done.
      let detected = 0;
      let detectionError: string | null = null;

      if (isDemo || workerConfigured) {
        const { data: existing } = await sb
          .from("detections")
          .select("id", { count: "exact", head: true })
          .eq("tile_id", tile.id);
        const already = (existing as unknown as { count?: number } | null)?.count ?? 0;

        if (!already) {
          try {
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
              if (insErr) detectionError = insErr.message;
            }
            detected = rows.length;
          } catch (e) {
            detectionError = (e as Error).message;
          }
        } else {
          detected = already;
        }
      }

      return {
        heading,
        name: HEADING_NAMES[heading] ?? `${heading}°`,
        tile_id: tile.id,
        detected,
        detectionError,
      };
    } catch (e) {
      // No panorama at this heading (Google has no coverage / no image) is fine
      // — just skip it. Other headings may still succeed.
      const msg = (e as Error).message;
      if (/no\s+pano|404|zero_results/i.test(msg)) return null;
      throw e;
    }
  }));

  const successful = shots.filter((s): s is ShotResult => s !== null);

  // Persist the list of shots on the lead's enrichment. Keep the legacy
  // single `streetview` pointer too, for backward compat with anything
  // that reads it.
  const prior = (lead.enrichment as Record<string, unknown> | null) ?? {};
  const updated: Record<string, unknown> = {
    ...prior,
    streetviews: successful.map(s => ({ tile_id: s.tile_id, heading: s.heading, name: s.name })),
  };
  if (successful[0]) {
    updated.streetview = { tile_id: successful[0].tile_id, fetched_at: new Date().toISOString() };
  }
  await sb.from("leads").update({ enrichment: updated }).eq("id", id);

  const totalDetected = successful.reduce((s, x) => s + x.detected, 0);

  return NextResponse.json({
    ok: true,
    demo: isDemo,
    shots: successful,
    totalDetected,
    workerSkipped,
  });
}
