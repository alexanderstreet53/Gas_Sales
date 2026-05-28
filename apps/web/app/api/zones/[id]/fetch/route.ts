// Run one chunk of an imagery sweep for this zone.
// Designed to be re-invoked (cron, manual button) until `stoppedReason==="complete"`.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchZoneChunk } from "@/lib/imagery/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Pro plan; falls back to 60 on Hobby.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();
  const { data: zone, error } = await sb
    .from("zones")
    .select("id, boundary, zoom, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!zone)  return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (zone.status !== "active") {
    return NextResponse.json({ error: "zone_not_active", hint: "Set zone status to 'active' first." }, { status: 409 });
  }

  // boundary comes back as GeoJSON from PostGIS via Supabase's automatic conversion
  // (but only when selecting via the JSON view); fall back to text parsing if needed.
  const boundary = (zone.boundary as unknown) as GeoJSON.Polygon;
  if (!boundary || boundary.type !== "Polygon") {
    return NextResponse.json({ error: "boundary_not_geojson", hint: "Configure supabase to return geometry as GeoJSON." }, { status: 500 });
  }

  try {
    const result = await fetchZoneChunk({ zoneId: id, boundary, zoom: zone.zoom });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
