import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import StatusPill from "@/components/StatusPill";
import SeedRealDataButton from "@/components/SeedRealDataButton";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface DashboardData {
  zones: number;
  tiles: number;
  detections: number;
  unreviewed: number;
  leads: number;
  spend24h: number;
  recentLeads: {
    id: string;
    business_name: string | null;
    formatted_addr: string | null;
    confidence: number;
    status: LeadStatus;
    updated_at: string;
    zones: { name: string } | null;
  }[];
  statusCounts: Record<LeadStatus, number>;
}

async function load(): Promise<DashboardData | null> {
  try {
    const sb = supabaseService();
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const [zones, tiles, detections, unreviewed, leadsCount, spend24h, recent, statusBreakdown] = await Promise.all([
      sb.from("zones").select("id", { count: "exact", head: true }).is("deleted_at", null),
      sb.from("imagery_tiles").select("id", { count: "exact", head: true }),
      sb.from("detections").select("id", { count: "exact", head: true }),
      sb.from("detections").select("id", { count: "exact", head: true }).eq("reviewed", false),
      sb.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
      sb.from("api_spend").select("est_cost_usd").gte("created_at", since24h).eq("cache_hit", false),
      sb.from("leads")
        .select("id, business_name, formatted_addr, confidence, status, updated_at, zones(name)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(8),
      sb.from("leads").select("status").is("deleted_at", null),
    ]);

    const spend = (spend24h.data ?? []).reduce((s, r) => s + Number(r.est_cost_usd), 0);
    const statusCounts: Record<LeadStatus, number> = {
      new: 0, verified: 0, contacted: 0, converted: 0, rejected: 0,
    };
    for (const r of statusBreakdown.data ?? []) {
      const s = r.status as LeadStatus;
      if (s in statusCounts) statusCounts[s]++;
    }

    return {
      zones: zones.count ?? 0,
      tiles: tiles.count ?? 0,
      detections: detections.count ?? 0,
      unreviewed: unreviewed.count ?? 0,
      leads: leadsCount.count ?? 0,
      spend24h: spend,
      recentLeads: (recent.data ?? []) as unknown as DashboardData["recentLeads"],
      statusCounts,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const d = await load();

  if (!d) {
    return (
      <div className="space-y-6">
        <Hero />
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="font-medium mb-1">Supabase isn&apos;t connected yet.</div>
          Set <code className="px-1 bg-amber-100 rounded">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="px-1 bg-amber-100 rounded">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and{" "}
          <code className="px-1 bg-amber-100 rounded">SUPABASE_SECRET_KEY</code> in Vercel,
          then run the SQL migration in <code className="px-1 bg-amber-100 rounded">supabase/migrations/0001_initial_schema.sql</code>.
        </div>
      </div>
    );
  }

  const empty = d.leads === 0;

  return (
    <div className="space-y-8">
      <Hero />

      {empty && (
        <div className="rounded-2xl bg-gradient-to-br from-ink to-slate-800 text-white p-6 sm:p-8 shadow-lg">
          <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-300">Get started</div>
              <h2 className="text-xl sm:text-2xl font-semibold mt-1">No leads yet — pull real businesses</h2>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Fetch real welders, fabricators, and gas suppliers from OpenStreetMap
                across Park Royal, Slough Trading Estate, and Trafford Park. Real names,
                real addresses, real coordinates — populated in seconds.
              </p>
            </div>
            <div className="flex-shrink-0">
              <SeedRealDataButton />
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Zones"          value={d.zones}                href="/zones"  icon={<MapIcon />} />
        <Kpi label="Leads"          value={d.leads}                href="/leads"  icon={<UsersIcon />} accent="primary" />
        <Kpi label="In review"      value={d.unreviewed}           href="/review" icon={<CheckIcon />} />
        <Kpi label="Cached tiles"   value={d.tiles}                href="/spend"  icon={<LayersIcon />} />
        <Kpi label="Spend (24h)"    value={`$${d.spend24h.toFixed(2)}`} href="/spend" icon={<ChartIcon />} />
      </section>

      {d.leads > 0 && (
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-medium">Recent leads</h2>
              <Link href="/leads" className="text-xs text-slate-500 hover:text-ink">View all →</Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {d.recentLeads.map(l => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <Avatar name={l.business_name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {l.business_name ?? <span className="italic text-slate-400">unknown</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {l.zones?.name ?? "—"} · {l.formatted_addr ?? "no address"}
                      </div>
                    </div>
                    <div className="hidden sm:block text-xs text-slate-500 tabular-nums">
                      {(l.confidence * 100).toFixed(0)}%
                    </div>
                    <StatusPill status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-medium">Lead pipeline</h2>
              <div className="mt-3 space-y-1.5">
                <PipelineRow status="new"       count={d.statusCounts.new}       total={d.leads} />
                <PipelineRow status="verified"  count={d.statusCounts.verified}  total={d.leads} />
                <PipelineRow status="contacted" count={d.statusCounts.contacted} total={d.leads} />
                <PipelineRow status="converted" count={d.statusCounts.converted} total={d.leads} />
                <PipelineRow status="rejected"  count={d.statusCounts.rejected}  total={d.leads} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-medium">Add more data</h2>
              <p className="text-xs text-slate-500 mt-1">
                Pull additional real businesses from OpenStreetMap.
              </p>
              <div className="mt-3">
                <SeedRealDataButton variant="ghost" />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-1">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
        Discover UK businesses using industrial gas tanks — welders, fabricators,
        metal repair — by analysing satellite imagery across defined zones.
      </p>
    </section>
  );
}

interface KpiProps { label: string; value: number | string; href: string; icon: React.ReactNode; accent?: "primary" }
function Kpi({ label, value, href, icon, accent }: KpiProps) {
  const ring = accent === "primary" ? "ring-1 ring-accent/30 bg-accent/[0.04]" : "";
  return (
    <Link href={href}
      className={`group block rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition-all ${ring}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-slate-400 group-hover:text-accent transition-colors">{icon}</div>
      </div>
      <div className="text-2xl sm:text-3xl font-semibold mt-1 tabular-nums">{value}</div>
    </Link>
  );
}

function PipelineRow({ status, count, total }: { status: LeadStatus; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const tone: Record<LeadStatus, string> = {
    new:       "bg-blue-500",
    verified:  "bg-emerald-500",
    contacted: "bg-amber-500",
    converted: "bg-violet-500",
    rejected:  "bg-slate-400",
  };
  return (
    <div className="text-xs space-y-1">
      <div className="flex justify-between">
        <span className="capitalize text-slate-600">{status}</span>
        <span className="text-slate-500 tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone[status]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initials = (name ?? "?")
    .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center text-xs font-semibold">
      {initials || "?"}
    </div>
  );
}

function MapIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>; }
function UsersIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function CheckIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
function LayersIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>; }
function ChartIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>; }
