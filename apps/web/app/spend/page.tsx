import { supabaseService } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function loadSpend() {
  const sb = supabaseService();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await sb
    .from("api_spend")
    .select("provider, est_cost_usd, cache_hit, created_at")
    .gte("created_at", since30d);

  const rows = data ?? [];
  const since24h = Date.now() - 86_400_000;

  const byProvider = new Map<string, { calls: number; cost: number; hits: number }>();
  for (const r of rows) {
    const k = r.provider;
    const cur = byProvider.get(k) ?? { calls: 0, cost: 0, hits: 0 };
    cur.calls += 1;
    cur.cost  += Number(r.est_cost_usd);
    if (r.cache_hit) cur.hits += 1;
    byProvider.set(k, cur);
  }

  const spend24h = rows
    .filter(r => !r.cache_hit && new Date(r.created_at).getTime() >= since24h)
    .reduce((s, r) => s + Number(r.est_cost_usd), 0);
  const spend30d = rows.filter(r => !r.cache_hit).reduce((s, r) => s + Number(r.est_cost_usd), 0);

  return { byProvider, spend24h, spend30d, total: rows.length };
}

export default async function SpendPage() {
  const s = await loadSpend();
  const pct = Math.min(100, (s.spend24h / env.imageryDailyCapUsd) * 100);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Spend & usage</h1>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Last 24h spend</div>
          <div className="text-2xl font-semibold mt-1">${s.spend24h.toFixed(2)}</div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-1">Daily cap ${env.imageryDailyCapUsd}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Last 30d spend</div>
          <div className="text-2xl font-semibold mt-1">${s.spend30d.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">API calls (30d)</div>
          <div className="text-2xl font-semibold mt-1">{s.total.toLocaleString()}</div>
        </div>
      </section>

      <section className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">By provider</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Provider</th>
              <th className="text-right px-4 py-2">Calls</th>
              <th className="text-right px-4 py-2">Cache hits</th>
              <th className="text-right px-4 py-2">Cost (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...s.byProvider.entries()].map(([p, v]) => (
              <tr key={p}>
                <td className="px-4 py-2">{p}</td>
                <td className="px-4 py-2 text-right">{v.calls.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{v.hits.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">${v.cost.toFixed(2)}</td>
              </tr>
            ))}
            {s.byProvider.size === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No spend yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
