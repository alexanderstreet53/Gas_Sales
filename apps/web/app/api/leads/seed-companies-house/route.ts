// Pulls real registered UK businesses from Companies House for each zone
// and inserts them as leads with enrichment.source = "companies_house".
//
// Requires COMPANIES_HOUSE_API_KEY in the env. Get one free at
// https://developer.company-information.service.gov.uk/.
//
// Geocodes each company's registered postcode via postcodes.io (free, no
// auth), then drops anything outside the zone's bounding box so we don't
// store companies registered at addresses far from the actual industrial
// estate.

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { supabaseService } from "@/lib/supabase/server";
import {
  advancedSearchCompanies,
  geocodePostcode,
  formatAddress,
  businessTypeFromSic,
  chConfidence,
  type CHCompany,
} from "@/lib/companies-house";
import type { Bbox } from "@/lib/osm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ZoneSpec {
  slug: string;
  name: string;
  description: string;
  bbox: Bbox;
  polygonEwkt: string;
  /** What we tell Companies House to filter on (postcode prefix or area name). */
  locationQuery: string;
}

const ZONES: ZoneSpec[] = [
  {
    slug: "park-royal",
    name: "Park Royal",
    description: "Park Royal industrial estate, west London — the UK's largest concentration of light industry.",
    bbox: { south: 51.5240, west: -0.2810, north: 51.5380, east: -0.2580 },
    polygonEwkt: "SRID=4326;POLYGON((-0.2810 51.5240,-0.2580 51.5240,-0.2580 51.5380,-0.2810 51.5380,-0.2810 51.5240))",
    locationQuery: "NW10",
  },
  {
    slug: "slough-trading-estate",
    name: "Slough Trading Estate",
    description: "Europe's largest privately-owned trading estate. Engineering, fabrication, gas distribution.",
    bbox: { south: 51.5120, west: -0.6250, north: 51.5260, east: -0.5920 },
    polygonEwkt: "SRID=4326;POLYGON((-0.6250 51.5120,-0.5920 51.5120,-0.5920 51.5260,-0.6250 51.5260,-0.6250 51.5120))",
    locationQuery: "SL1",
  },
  {
    slug: "trafford-park",
    name: "Trafford Park",
    description: "Greater Manchester industrial estate — heavy engineering and steel fabrication.",
    bbox: { south: 53.4600, west: -2.3450, north: 53.4800, east: -2.2950 },
    polygonEwkt: "SRID=4326;POLYGON((-2.3450 53.4600,-2.2950 53.4600,-2.2950 53.4800,-2.3450 53.4800,-2.3450 53.4600))",
    locationQuery: "M17",
  },
];

interface ZoneResult { slug: string; found: number; insideZone: number; inserted: number }

function insideBbox(lat: number, lng: number, b: Bbox): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

async function seedZone(z: ZoneSpec, apiKey: string): Promise<ZoneResult> {
  const sb = supabaseService();

  // Upsert zone (match on name).
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

  // Wipe prior Companies House leads in this zone for idempotence.
  const { data: priorLeads } = await sb
    .from("leads")
    .select("site_id")
    .eq("zone_id", zoneId)
    .filter("enrichment->>source", "eq", "companies_house");
  const priorSiteIds = (priorLeads ?? []).map(l => l.site_id).filter(Boolean) as string[];
  if (priorSiteIds.length > 0) {
    await sb.from("sites").delete().in("id", priorSiteIds);
  }

  // Fetch from Companies House.
  const companies = await advancedSearchCompanies({
    apiKey,
    locationText: z.locationQuery,
    size: 100,
  });

  // Geocode each (postcode -> lat/lng), filter to zone bbox, then insert.
  // Concurrency-limited so postcodes.io is not hammered.
  const gate = pLimit(5);
  const inside: { company: CHCompany; lat: number; lng: number }[] = [];

  await Promise.all(companies.map(c => gate(async () => {
    const postcode = c.registered_office_address?.postal_code;
    if (!postcode) return;
    const coords = await geocodePostcode(postcode);
    if (!coords) return;
    if (insideBbox(coords.lat, coords.lng, z.bbox)) {
      inside.push({ company: c, lat: coords.lat, lng: coords.lng });
    }
  })));

  if (inside.length === 0) {
    return { slug: z.slug, found: companies.length, insideZone: 0, inserted: 0 };
  }

  // Create sites and leads in bulk.
  const siteRows = inside.map(({ company, lat, lng }) => ({
    zone_id: zoneId,
    centroid: `SRID=4326;POINT(${lng} ${lat})`,
    detection_count: 0,
    best_confidence: chConfidence(company),
  }));
  const { data: sites, error: sitesErr } = await sb.from("sites").insert(siteRows).select("id");
  if (sitesErr || !sites) throw new Error(`site insert failed: ${sitesErr?.message}`);

  const leadRows = inside.map(({ company }, i) => ({
    site_id: sites[i].id,
    zone_id: zoneId,
    business_name: company.company_name,
    business_type: businessTypeFromSic(company),
    formatted_addr: formatAddress(company),
    confidence: chConfidence(company),
    status: "new",
    enrichment: {
      source: "companies_house",
      company_number: company.company_number,
      sic_codes: company.sic_codes ?? [],
      company_status: company.company_status,
      date_of_creation: company.date_of_creation,
    },
  }));
  const { error: leadsErr } = await sb.from("leads").insert(leadRows);
  if (leadsErr) throw new Error(`lead insert failed: ${leadsErr.message}`);

  return { slug: z.slug, found: companies.length, insideZone: inside.length, inserted: leadRows.length };
}

export async function POST(req: Request) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "companies_house_key_missing",
        message: "COMPANIES_HOUSE_API_KEY is not set. Get a free key at https://developer.company-information.service.gov.uk/ and add it in Vercel → Settings → Environment Variables.",
      },
      { status: 400 },
    );
  }

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
    try { results.push(await seedZone(z, apiKey)); }
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
