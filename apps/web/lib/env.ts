// Typed env access. Lazy: required vars are only checked the first time
// they're read, so importing this module never throws at module-load time
// (which would break `next build`'s data-collection pass before runtime).

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
  get supabaseUrl()        { return required("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseAnonKey()    { return firstOf(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], true); },
  get supabaseServiceKey() { return firstOf(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]); },
  get googleKey()          { return optional("GOOGLE_MAPS_API_KEY"); },
  get mapboxToken()        { return optional("NEXT_PUBLIC_MAPBOX_TOKEN"); },
  get workerUrl()          { return optional("WORKER_URL", "http://localhost:8000"); },
  get workerApiKey()       { return optional("WORKER_API_KEY"); },
  get imageryTtlDays()     { return num("IMAGERY_TTL_DAYS", 90); },
  get imageryQps()         { return num("IMAGERY_QPS", 10); },
  get imageryDailyCapUsd() { return num("IMAGERY_DAILY_CAP_USD", 25); },
  get imageryDefaultZoom() { return num("IMAGERY_DEFAULT_ZOOM", 19); },
  cost: {
    get staticMapsPer1k() { return num("GOOGLE_STATIC_MAPS_COST_PER_1K", 2.0); },
    get streetViewPer1k() { return num("GOOGLE_STREETVIEW_COST_PER_1K", 7.0); },
    get geocodingPer1k()  { return num("GOOGLE_GEOCODING_COST_PER_1K", 5.0); },
    get placesPer1k()     { return num("GOOGLE_PLACES_COST_PER_1K", 17.0); },
  },
};
