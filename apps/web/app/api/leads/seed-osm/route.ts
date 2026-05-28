// Pulls real industrial businesses from OpenStreetMap inside known UK
// industrial estates and creates leads from them. Real names, real
// addresses (where OSM has them), real coords.
//
// Idempotent: re-running replaces any prior OSM-sourced leads in those
// zones, leaving non-OSM leads (e.g. from your own satellite pipeline)
// untouched.

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { fetchIndustrialBusinesses, osmConfidence, type Bbox } from "@/lib/osm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ZoneSpec {
  slug: string;
  name: string;
  description: string;
  bbox: Bbox;
  polygonEwkt: string;
}

const ZONES: ZoneSpec[] = [
  {
    slug: "park-royal",
    name: "Park Royal",
    description: "Park Royal industrial estate, west London — the UK's largest concentration of light industry.",
    bbox: { south: 51.5240, west: -0.2810, north: 51.5380, east: -0.2580 },
    polygonEwkt: "SRID=4326;POLYGON((-0.2810 51.5240,-0.2580 51.5240,-0.2580 51.5380,-0.2810 51.5380,-0.2810 51.5240))",
  },
  {
    slug: "slough-trading-estate",
    name: "Slough Trading Estate",
    description: "Europe's largest privately-owned trading estate. Engineering, fabrication, gas distribution.",
    bbox: { south: 51.5120, west: -0.6250, north: 51.5260, east: -0.5920 },
    polygonEwkt: "SRID=4326;POLYGON((-0.6250 51.5120,-0.5920 51.5120,-0.5920 51.5260,-0.6250 51.5260,-0.6250 51.5120))",
  },
  {
    slug: "trafford-park",
    name: "Trafford Park",
    description: "Greater Manchester industrial estate — heavy engineering and steel fabrication.",
    bbox: { south: 53.4600, west: -2.3450, north: 53.4800, east: -2.2950 },
    polygonEwkt: "SRID=4326;POLYGON((-2.3450 53.4600,-2.2950 53.4600,-2.2950 53.4800,-2.3450 53.4800,-2.3450 53.4600))",
  },
];

interface ZoneResult { slug: string; zoneId: string; found: number; inserted: number }

async function seedZone(z: ZoneSpec): Promise<ZoneResult> {
  const sb = supabaseService();

  // Upsert the zone (match on name; fine for our small fixed list).
  const { data: existing } = await sb.from("zones").select("id").eq("name", z.name).maybeSingle();
  let zoneId = existing?.id as string | undefined;
  if (!zoneId) {
    const { data, error } = await sb
      .from("zones")
      .insert({
        name: z.name,
        description: z.description,
        boundary: z.polygonEwkt,
        zoom: 19,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`zone insert failed: ${error?.message}`);
    zoneId = data.id;
  }

  // Wipe any prior OSM-sourced leads + their sites in this zone.
  const { data: priorLeads } = await sb
    .from("leads")
    .select("site_id")
    .eq("zone_id", zoneId)
    .filter("enrichment->>source", "eq", "osm");
  const priorSiteIds = (priorLeads ?? []).map(l => l.site_id).filter(Boolean) as string[];
  if (priorSiteIds.length > 0) {
    await sb.from("sites").delete().in("id", priorSiteIds);  // cascades to leads
  }

  // Pull real businesses from OSM.
  const businesses = await fetchIndustrialBusinesses(z.bbox);
  if (businesses.length === 0) {
    return { slug: z.slug, zoneId: zoneId!, found: 0, inserted: 0 };
  }

  // Create sites, then leads.
  const siteRows = businesses.map(b => ({
    zone_id: zoneId,
    centroid: `SRID=4326;POINT(${b.lng} ${b.lat})`,
    detection_count: 0,
    best_confidence: osmConfidence(b),
  }));
  const { data: sites, error: sitesErr } = await sb.from("sites").insert(siteRows).select("id");
  if (sitesErr || !sites) throw new Error(`site insert failed: ${sitesErr?.message}`);

  const leadRows = businesses.map((b, i) => ({
    site_id: sites[i].id,
    zone_id: zoneId,
    business_name: b.name,
    business_type: b.businessType,
    formatted_addr: b.address,
    confidence: osmConfidence(b),
    status: "new",
    enrichment: {
      source: "osm",
      osm_type: b.osmType,
      osm_id: b.osmId,
      tags: b.tags,
    },
  }));
  const { error: leadsErr } = await sb.from("leads").insert(leadRows);
  if (leadsErr) throw new Error(`lead insert failed: ${leadsErr.message}`);

  return { slug: z.slug, zoneId: zoneId!, found: businesses.length, inserted: leadRows.length };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const onlySlug = url.searchParams.get("zone");

  const targets = onlySlug ? ZONES.filter(z => z.slug === onlySlug) : ZONES;
  if (targets.length === 0) {
    return NextResponse.json(
      { error: "unknown_zone", available: ZONES.map(z => z.slug) },
      { status: 400 },
    );
  }

  const results: ZoneResult[] = [];
  for (const z of targets) {
    try { results.push(await seedZone(z)); }
    catch (e) {
      return NextResponse.json(
        { error: (e as Error).message, completed: results },
        { status: 500 },
      );
    }
  }
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  return NextResponse.json({ ok: true, totalInserted, results });
}
