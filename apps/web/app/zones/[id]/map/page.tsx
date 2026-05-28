import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import ZoneMap from "@/components/ZoneMap";
import { normalizePoint } from "@/lib/geo/parse";

export const dynamic = "force-dynamic";

interface Boundary { type: "Polygon"; coordinates: number[][][] }

export default async function ZoneMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();

  const { data: zone } = await sb
    .from("zones_geojson")
    .select("id, name, description, boundary")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!zone) notFound();

  const [{ data: leads }, { data: detections }] = await Promise.all([
    sb.from("leads")
      .select("id, business_name, business_type, confidence, status, sites(centroid)")
      .eq("zone_id", id)
      .is("deleted_at", null),
    sb.from("detections")
      .select("id, class, confidence, location, review_result")
      .eq("zone_id", id),
  ]);

  const leadPins = (leads ?? []).flatMap(l => {
    const siteRaw = (l.sites as unknown) as { centroid?: unknown } | { centroid?: unknown }[] | null;
    const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
    const p = normalizePoint(site?.centroid);
    if (!p) return [];
    return [{
      id: l.id as string,
      lat: p.lat, lng: p.lng,
      name: (l.business_name as string | null) ?? null,
      type: (l.business_type as string | null) ?? null,
      confidence: l.confidence as number,
      status: l.status as string,
    }];
  });

  const detectionPins = (detections ?? []).flatMap(d => {
    const p = normalizePoint(d.location);
    if (!p) return [];
    return [{
      id: d.id as string,
      lat: p.lat, lng: p.lng,
      class: d.class as string,
      confidence: d.confidence as number,
      reviewResult: d.review_result as string | null,
    }];
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Zone map</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{zone.name}</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {leadPins.length} leads · {detectionPins.length} detections
          </p>
        </div>
        <Link href={`/zones/${id}`} className="text-sm text-slate-500 hover:text-ink">← Back to zone</Link>
      </div>

      <ZoneMap
        zoneName={zone.name}
        boundary={zone.boundary as Boundary | null}
        leads={leadPins}
        detections={detectionPins}
        mapboxToken={mapboxToken}
      />
    </div>
  );
}
