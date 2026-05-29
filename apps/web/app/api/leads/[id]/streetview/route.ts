// Run a Street View scan for a single lead. Same caching as the bulk
// /api/leads/streetview-scan endpoint — re-scanning a lead with the
// same lat/lng is a cache hit and costs nothing.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchStreetViewTile } from "@/lib/imagery/google";
import { normalizePoint } from "@/lib/geo/parse";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
    .select("id, zone_id, enrichment, sites(centroid)")
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

  try {
    const tile = await fetchStreetViewTile({
      zoneId: lead.zone_id as string,
      lat: point.lat,
      lng: point.lng,
      heading: 0,
    });

    const prior = (lead.enrichment as Record<string, unknown> | null) ?? {};
    await sb.from("leads").update({
      enrichment: { ...prior, streetview: { tile_id: tile.id, fetched_at: new Date().toISOString() } },
    }).eq("id", id);

    return NextResponse.json({ ok: true, tileId: tile.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
