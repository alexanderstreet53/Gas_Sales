import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadCounts() {
  try {
    const sb = supabaseService();
    const [zones, tiles, detections, leads, spend24h] = await Promise.all([
      sb.from("zones").select("id", { count: "exact", head: true }).is("deleted_at", null),
      sb.from("imagery_tiles").select("id", { count: "exact", head: true }),
      sb.from("detections").select("id", { count: "exact", head: true }),
      sb.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
      sb.from("api_spend")
        .select("est_cost_usd")
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
        .eq("cache_hit", false),
    ]);
    const spend = (spend24h.data ?? []).reduce((s, r) => s + Number(r.est_cost_usd), 0);
    return {
      zones: zones.count ?? 0,
      tiles: tiles.count ?? 0,
      detections: detections.count ?? 0,
      leads: leads.count ?? 0,
      spend24h: spend,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const counts = await loadCounts();
  const cards = counts ? [
    { label: "Active zones",     value: counts.zones,      href: "/zones" },
    { label: "Cached tiles",     value: counts.tiles,      href: "/spend" },
    { label: "Detections",       value: counts.detections, href: "/review" },
    { label: "Leads",            value: counts.leads,      href: "/leads" },
    { label: "Spend (last 24h)", value: `$${counts.spend24h.toFixed(2)}`, href: "/spend" },
  ] : [];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-600 mt-1 max-w-2xl">
          Discover businesses using industrial gas tanks by analysing
          satellite imagery across defined industrial zones.
        </p>
      </section>

      {counts ? (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {cards.map(c => (
            <Link key={c.label} href={c.href}
              className="block bg-white rounded-xl border p-3 sm:p-4 hover:shadow-sm active:bg-slate-50 transition">
              <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
              <div className="text-xl sm:text-2xl font-semibold mt-1">{c.value}</div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
          Supabase connection isn&apos;t configured yet. Fill in
          <code className="mx-1 px-1 bg-amber-100 rounded">apps/web/.env.local</code>
          using the keys in <code className="mx-1 px-1 bg-amber-100 rounded">.env.example</code>,
          then refresh.
        </section>
      )}

      <section className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal pl-5">
          <li><Link href="/zones">Define a zone</Link> by drawing a polygon or importing GeoJSON.</li>
          <li>Run an <Link href="/zones">imagery sweep</Link> — tiles are cached for 90 days.</li>
          <li><Link href="/label">Label</Link> 300+ crops to fine-tune the detector.</li>
          <li>Run detection; <Link href="/review">verify</Link> high-confidence crops.</li>
          <li>Promoted detections become <Link href="/leads">leads</Link>.</li>
        </ol>
      </section>
    </div>
  );
}
