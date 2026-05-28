// Run one chunk of an imagery sweep for this zone.
// Designed to be re-invoked (cron, manual button) until `stoppedReason==="complete"`.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchZoneChunk } from "@/lib/imagery/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Pro plan; falls back to 60 on Hobby.

interface MaybeError { code?: string; message?: string }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();

  // Read from the zones_geojson view (added by migration 0002) so the
  // boundary comes back as GeoJSON without depending on any project
  // setting.
  const { data: zone, error } = await sb
    .from("zones_geojson")
    .select("id, boundary, zoom, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    const e = error as MaybeError;
    if (e.code === "42P01" || (e.message ?? "").includes("zones_geojson")) {
      return NextResponse.json({
        error: "missing_view",
        hint: "Run supabase/migrations/0002_geojson_views.sql in the Supabase SQL Editor — it adds the view this endpoint reads from.",
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!zone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (zone.status !== "active") {
    return NextResponse.json({ error: "zone_not_active", hint: "Set zone status to 'active' first." }, { status: 409 });
  }

  const boundary = zone.boundary as unknown as GeoJSON.Polygon;
  if (!boundary || boundary.type !== "Polygon") {
    return NextResponse.json({
      error: "boundary_not_polygon",
      hint: "Zone boundary couldn't be parsed as a Polygon. Re-create the zone.",
    }, { status: 500 });
  }

  try {
    const result = await fetchZoneChunk({ zoneId: id, boundary, zoom: zone.zoom });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
