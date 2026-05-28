// Spend tracking. Every API call should funnel through `logSpend` so the
// dashboard at /spend tells the truth.

import { env } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/server";

type Provider = "google_static" | "google_streetview" | "google_geocoding" | "google_places";

const PRICING: Record<Provider, number> = {
  google_static:     env.cost.staticMapsPer1k  / 1000,
  google_streetview: env.cost.streetViewPer1k  / 1000,
  google_geocoding:  env.cost.geocodingPer1k   / 1000,
  google_places:     env.cost.placesPer1k      / 1000,
};

export function estimateCost(provider: Provider, units = 1): number {
  const perCall = PRICING[provider] ?? 0;
  return Number((perCall * units).toFixed(6));
}

export async function logSpend(args: {
  provider: Provider;
  endpoint: string;
  zoneId?: string | null;
  units?: number;
  cacheHit?: boolean;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const units = args.units ?? 1;
  const est   = args.cacheHit ? 0 : estimateCost(args.provider, units);
  const sb    = supabaseService();
  await sb.from("api_spend").insert({
    provider:     args.provider,
    endpoint:     args.endpoint,
    zone_id:      args.zoneId ?? null,
    units,
    est_cost_usd: est,
    cache_hit:    args.cacheHit ?? false,
    meta:         args.meta ?? {},
  });
}

/**
 * Returns total non-cached spend in the last 24h.
 * Used as a hard stop in the bulk fetcher.
 */
export async function spendLast24hUsd(): Promise<number> {
  const sb = supabaseService();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("api_spend")
    .select("est_cost_usd")
    .gte("created_at", since)
    .eq("cache_hit", false);
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + Number(r.est_cost_usd), 0);
}
