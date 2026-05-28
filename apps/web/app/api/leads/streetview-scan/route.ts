// Run a Street View scan across leads — fetches a Google Street View
// Static image at each lead's site centroid, caches the blob in Supabase
// Storage, and stores the tile id on the lead so the lead-detail page
// can display the imagery.
//
// Uses the existing fetchStreetViewTile cache, so re-scanning is a no-op
// (cache hit, no API spend).
//
// Query params:
//   ?zone=<id>     restrict to one zone
//   ?limit=<n>     cap leads processed (default 50, max 200)

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { supabaseService } from "@/lib/supabase/server";
import { fetchStreetViewTile } from "@/lib/imagery/google";
import { env } from "@/lib/env";
import { normalizePoint } from "@/lib/geo/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface SiteShape { centroid: unknown }

export async function POST(req: Request) {
  if (!env.googleKey) {
    return NextResponse.json(
      {
        error: "google_key_missing",
        message: "GOOGLE_MAPS_API_KEY is not set in Vercel. Add it under Settings → Environment Variables and redeploy. Each Street View call costs ~$0.007.",
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const zoneId = url.searchParams.get("zone");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const sb = supabaseService();
  let q = sb
    .from("leads")
    .select("id, zone_id, enrichment, sites(centroid)")
    .is("deleted_at", null)
    .limit(limit);
  if (zoneId) q = q.eq("zone_id", zoneId);
  const { data: leads, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gate = pLimit(3);
  let scanned = 0, cached = 0, failed = 0, skipped = 0;
  const failures: { leadId: string; reason: string }[] = [];

  await Promise.all((leads ?? []).map(l => gate(async () => {
    // Supabase's TS inference types the FK-joined site as array; runtime returns one row.
    // Centroid arrives either as GeoJSON (if the project has GeoJSON-for-geometry
    // enabled) or as raw EWKB hex; normalisePoint handles both.
    const siteRaw = (l.sites as unknown) as SiteShape | SiteShape[] | null;
    const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
    const point = normalizePoint(site?.centroid);
    if (!point) { skipped++; return; }

    const { lng, lat } = point;
    try {
      const startedAt = Date.now();
      const tile = await fetchStreetViewTile({
        zoneId: l.zone_id as string,
        lat, lng,
        heading: 0,
      });
      const tookMs = Date.now() - startedAt;
      if (tookMs < 150) cached++;
      scanned++;

      const prior = (l.enrichment as Record<string, unknown> | null) ?? {};
      await sb.from("leads").update({
        enrichment: { ...prior, streetview: { tile_id: tile.id, fetched_at: new Date().toISOString() } },
      }).eq("id", l.id);
    } catch (e) {
      failed++;
      failures.push({ leadId: l.id as string, reason: (e as Error).message });
    }
  })));

  return NextResponse.json({
    ok: true,
    total: leads?.length ?? 0,
    scanned, cached, failed, skipped,
    failures: failures.slice(0, 5),
  });
}
