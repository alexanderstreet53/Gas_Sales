// Companies House API client.
//
// UK's official business registry. Free with a developer API key
// (https://developer.company-information.service.gov.uk/), basic auth.
//
// We restrict the search to SIC codes relevant to industrial gas
// customers: structural metal, welding, fabrication, gas distribution,
// engineering services.

const CH_BASE = "https://api.company-information.service.gov.uk";

// SIC codes that correlate with using industrial gas tanks: structural
// metal manufacture, welding, fabrication, gas distribution, engineering.
export const RELEVANT_SIC_CODES = [
  "25110", // Manufacture of structural metal products
  "25120", // Manufacture of doors and windows of metal
  "25210", // Manufacture of central heating radiators and boilers
  "25500", // Forging, pressing, stamping
  "25610", // Treatment and coating of metals
  "25620", // Machining
  "25710", // Manufacture of cutlery
  "25990", // Manufacture of other fabricated metal products n.e.c.
  "28130", // Manufacture of other pumps and compressors
  "33110", // Repair of fabricated metal products
  "35210", // Manufacture of gas
  "35220", // Distribution of gaseous fuels through mains
  "35230", // Trade of gas through mains
  "43221", // Plumbing, heating installation
  "43222", // Gas installation
  "46710", // Wholesale of solid, liquid and gaseous fuels
  "46740", // Wholesale of hardware, plumbing and heating equipment
  "71121", // Engineering design activities
  "71122", // Engineering related scientific and technical consulting
];

export interface CHCompany {
  company_number: string;
  company_name: string;
  registered_office_address: {
    postal_code?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    country?: string;
  };
  company_status: string;
  date_of_creation?: string;
  sic_codes?: string[];
  description_identifier?: string[];
}

function authHeader(apiKey: string): string {
  // Companies House uses HTTP Basic with username=apiKey, no password.
  // Trim defensively — a stray newline in the env var would silently 401.
  const cleaned = apiKey.trim();
  const b64 = Buffer.from(`${cleaned}:`).toString("base64");
  return `Basic ${b64}`;
}

/**
 * Companies House Advanced Search — filter by location and SIC codes.
 * `locationText` is a free-text location (postcode, town, "Park Royal"
 * all work — CH does fuzzy matching on the registered address).
 */
export async function advancedSearchCompanies(args: {
  apiKey: string;
  locationText: string;
  sicCodes?: string[];
  size?: number;
}): Promise<CHCompany[]> {
  const sicCodes = args.sicCodes ?? RELEVANT_SIC_CODES;
  const size = Math.min(args.size ?? 100, 100); // CH caps at 100 per request.
  const url = new URL(`${CH_BASE}/advanced-search/companies`);
  url.searchParams.set("location", args.locationText);
  url.searchParams.set("sic_codes", sicCodes.join(","));
  url.searchParams.set("company_status", "active");
  url.searchParams.set("size", String(size));

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader(args.apiKey) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Companies House ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json() as { items?: CHCompany[] };
  return json.items ?? [];
}

/** Geocode a UK postcode via postcodes.io (free, no auth). */
export async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
  if (!res.ok) return null;
  const json = await res.json() as { result?: { latitude: number; longitude: number } };
  if (!json.result) return null;
  return { lat: json.result.latitude, lng: json.result.longitude };
}

/** Format a CH registered office address into a single line. */
export function formatAddress(c: CHCompany): string | null {
  const a = c.registered_office_address;
  const parts = [
    a.address_line_1,
    a.address_line_2,
    a.locality,
    a.region,
    a.postal_code,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** A primary "business type" derived from the company's SIC codes. */
const SIC_LABELS: Record<string, string> = {
  "25110": "Structural metal products",
  "25120": "Metal doors and windows",
  "25210": "Heating radiators and boilers",
  "25500": "Forging, pressing, stamping",
  "25610": "Metal coating",
  "25620": "Metal machining",
  "25710": "Cutlery",
  "25990": "Fabricated metal products",
  "28130": "Pumps and compressors",
  "33110": "Repair of fabricated metal",
  "35210": "Gas manufacture",
  "35220": "Gas distribution",
  "35230": "Gas mains trading",
  "43221": "Plumbing, heating installation",
  "43222": "Gas installation",
  "46710": "Wholesale fuels",
  "46740": "Wholesale plumbing/heating",
  "71121": "Engineering design",
  "71122": "Engineering consulting",
};
export function businessTypeFromSic(c: CHCompany): string {
  const sics = c.sic_codes ?? [];
  for (const s of sics) if (SIC_LABELS[s]) return SIC_LABELS[s];
  return "Industrial";
}

/** Heuristic confidence based on which SIC codes a company has. */
export function chConfidence(c: CHCompany): number {
  const sics = new Set(c.sic_codes ?? []);
  let score = 0.55;
  if (sics.has("25110") || sics.has("25620") || sics.has("25990")) score += 0.2; // core fabrication
  if (sics.has("35210") || sics.has("35220") || sics.has("35230")) score += 0.2; // gas
  if (sics.has("43222") || sics.has("46710") || sics.has("46740")) score += 0.1; // gas-adjacent
  if (sics.size > 1) score += 0.05;
  return Math.min(0.95, Math.round(score * 100) / 100);
}
