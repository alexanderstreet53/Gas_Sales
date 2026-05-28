// Cluster confirmed detections into sites, then promote sites to leads
// with a reverse-geocoded address. Runs idempotently — re-running just
// updates the existing sites/leads.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { clusterDetections } from "@/lib/geo/clustering";
import { reverseGeocode } from "@/lib/imagery/google";
import { normalizePoint } from "@/lib/geo/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: zoneId } = await params;
  const sb = supabaseService();

  const { data: dets, error } = await sb
    .from("detections")
    .select("id, location, confidence")
    .eq("zone_id", zoneId)
    .eq("review_result", "confirmed");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (dets ?? [])
    .map(d => {
      const p = normalizePoint(d.location);
      if (!p) return null;
      return { id: d.id as string, lng: p.lng, lat: p.lat, confidence: d.confidence as number };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const clusters = clusterDetections(points, 25, 1);
  let leadsCreated = 0;
  let sitesUpserted = 0;

  for (const c of clusters) {
    const { data: site, error: siteErr } = await sb
      .from("sites")
      .insert({
        zone_id: zoneId,
        centroid: `SRID=4326;POINT(${c.centroidLng} ${c.centroidLat})`,
        hull: c.hull
          ? `SRID=4326;POLYGON((${c.hull.coordinates[0].map(p => p.join(" ")).join(",")}))`
          : null,
        detection_count: c.detectionIds.length,
        best_confidence: c.bestConfidence,
      })
      .select("id")
      .single();
    if (siteErr || !site) continue;
    sitesUpserted += 1;

    await sb.from("detections").update({ site_id: site.id }).in("id", c.detectionIds);

    const geo = await reverseGeocode(c.centroidLat, c.centroidLng);
    const { error: leadErr } = await sb.from("leads").insert({
      site_id: site.id,
      zone_id: zoneId,
      formatted_addr: geo?.formatted ?? null,
      place_id: geo?.placeId ?? null,
      confidence: c.bestConfidence,
      status: "new",
    });
    if (!leadErr) leadsCreated += 1;
  }

  return NextResponse.json({ clusters: clusters.length, sitesUpserted, leadsCreated });
}
