// Typed env access. Throws loudly at boot if anything required is missing.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

// First non-empty wins. Lets us accept both the legacy Supabase variable
// names (anon / service_role) and the new ones (publishable / secret).
function firstOf(names: string[], mustHave = false): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  if (mustHave) throw new Error(`Missing env var: one of ${names.join(", ")}`);
  return "";
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} is not numeric: ${v}`);
  return n;
}

export const env = {
  supabaseUrl:        required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey:    firstOf(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], true),
  supabaseServiceKey: firstOf(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]),
  googleKey:          optional("GOOGLE_MAPS_API_KEY"),
  mapboxToken:        optional("NEXT_PUBLIC_MAPBOX_TOKEN"),
  workerUrl:          optional("WORKER_URL", "http://localhost:8000"),
  workerApiKey:       optional("WORKER_API_KEY"),
  imageryTtlDays:     num("IMAGERY_TTL_DAYS", 90),
  imageryQps:         num("IMAGERY_QPS", 10),
  imageryDailyCapUsd: num("IMAGERY_DAILY_CAP_USD", 25),
  imageryDefaultZoom: num("IMAGERY_DEFAULT_ZOOM", 19),
  cost: {
    staticMapsPer1k:  num("GOOGLE_STATIC_MAPS_COST_PER_1K", 2.0),
    streetViewPer1k:  num("GOOGLE_STREETVIEW_COST_PER_1K", 7.0),
    geocodingPer1k:   num("GOOGLE_GEOCODING_COST_PER_1K", 5.0),
    placesPer1k:      num("GOOGLE_PLACES_COST_PER_1K", 17.0),
  },
};
