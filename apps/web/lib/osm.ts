// OpenStreetMap Overpass API client.
//
// Pulls real industrial businesses (welders, metalworkers, gas suppliers,
// fabricators) inside a bounding box. Used to populate leads from public
// data until the satellite-imagery detection pipeline is wired up, and as
// an ongoing enrichment source even after.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

interface OsmFeature {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OsmBusiness {
  osmType: "node" | "way" | "relation";
  osmId: number;
  lat: number;
  lng: number;
  name: string;
  businessType: string;
  address: string | null;
  tags: Record<string, string>;
}

export interface Bbox { south: number; west: number; north: number; east: number }

/** Fetch real industrial businesses inside a bounding box from OSM. */
export async function fetchIndustrialBusinesses(bbox: Bbox): Promise<OsmBusiness[]> {
  const { south, west, north, east } = bbox;
  // One query, many filters. We accept anything that:
  //   - has craft=metal_construction/blacksmith/welder/engineer (UK welders use these)
  //   - is shop=trade or shop=hardware (B2B gas / metal supplies)
  //   - has industrial=* (any industrial use)
  //   - is man_made=works (factories)
  //   - is office=company with a name (industrial offices)
  //   - is building=industrial with a name
  const q = `
    [out:json][timeout:30];
    (
      nwr["craft"~"metal_construction|blacksmith|welder|engineer|carpenter"](${south},${west},${north},${east});
      nwr["shop"~"trade|hardware|industrial|gas"](${south},${west},${north},${east});
      nwr["industrial"](${south},${west},${north},${east});
      nwr["man_made"="works"](${south},${west},${north},${east});
      nwr["office"="company"][name](${south},${west},${north},${east});
      nwr["building"~"industrial|warehouse"][name](${south},${west},${north},${east});
      nwr["landuse"="industrial"][name](${south},${west},${north},${east});
    );
    out center tags;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const json = await res.json() as { elements: OsmFeature[] };

  // Deduplicate by name + coarse coords (same business sometimes appears as
  // node + bounding way at the same spot).
  const seen = new Set<string>();
  const out: OsmBusiness[] = [];
  for (const f of json.elements) {
    const b = featureToBusiness(f);
    if (!b) continue;
    const dedupKey = `${b.name.toLowerCase()}@${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(b);
  }
  return out;
}

function featureToBusiness(f: OsmFeature): OsmBusiness | null {
  const lat = f.lat ?? f.center?.lat;
  const lon = f.lon ?? f.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  const tags = f.tags ?? {};
  const name = tags.name;
  if (!name) return null;

  const businessType = (
    tags.craft ??
    tags.industrial ??
    tags.shop ??
    tags.man_made ??
    tags.office ??
    tags.building ??
    tags.landuse ??
    "industrial"
  ).replace(/_/g, " ");

  const street   = tags["addr:street"];
  const housenum = tags["addr:housenumber"];
  const city     = tags["addr:city"] ?? tags["addr:suburb"];
  const postcode = tags["addr:postcode"];
  const street_line = [housenum, street].filter(Boolean).join(" ");
  const address = [street_line || null, city, postcode].filter(Boolean).join(", ") || null;

  return {
    osmType: f.type, osmId: f.id,
    lat, lng: lon,
    name, businessType, address,
    tags,
  };
}

/** A rough confidence score for OSM-sourced leads, based on which tags are present. */
export function osmConfidence(b: OsmBusiness): number {
  let score = 0.4;
  const t = b.tags;
  if (/welder|metal_construction|blacksmith/i.test(t.craft ?? "")) score += 0.3;
  if (/gas/i.test(t.shop ?? "")) score += 0.2;
  if (t.industrial) score += 0.1;
  if (t["addr:street"]) score += 0.1;
  if (t.website || t.phone) score += 0.1;
  return Math.min(0.95, Math.round(score * 100) / 100);
}
