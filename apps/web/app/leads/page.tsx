import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import StatusPill from "@/components/StatusPill";
import SeedRealDataButton from "@/components/SeedRealDataButton";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  business_name: string | null;
  business_type: string | null;
  formatted_addr: string | null;
  confidence: number;
  status: LeadStatus;
  zone_id: string;
  updated_at: string;
  zones: { name: string } | null;
}

const STATUSES: LeadStatus[] = ["new","verified","contacted","converted","rejected"];

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; zone?: string }> }) {
  const sp = await searchParams;
  const sb = supabaseService();

  const [{ data: rows }, { data: counts }] = await Promise.all([
    (async () => {
      let q = sb
        .from("leads")
        .select("id, business_name, business_type, formatted_addr, confidence, status, zone_id, updated_at, zones(name)")
        .is("deleted_at", null)
        .order("confidence", { ascending: false })
        .limit(500);
      if (sp.status) q = q.eq("status", sp.status);
      if (sp.zone)   q = q.eq("zone_id", sp.zone);
      return q;
    })(),
    sb.from("leads").select("status").is("deleted_at", null),
  ]);

  const leads = (rows ?? []) as unknown as LeadRow[];

  // Build status counts (across all zones, ignoring current status filter).
  const statusCounts: Record<LeadStatus, number> & { all: number } = {
    all: 0, new: 0, verified: 0, contacted: 0, converted: 0, rejected: 0,
  };
  for (const r of counts ?? []) {
    const s = r.status as LeadStatus;
    statusCounts.all++;
    if (s in statusCounts) statusCounts[s]++;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-600 mt-0.5">Sales-ready businesses, ranked by confidence.</p>
        </div>
        <div className="text-sm text-slate-500">{leads.length} shown</div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5 text-sm">
        <FilterChip href="/leads" label="All" count={statusCounts.all} active={!sp.status} />
        {STATUSES.map(s => (
          <FilterChip
            key={s}
            href={`/leads?status=${s}`}
            label={s}
            count={statusCounts[s]}
            active={sp.status === s}
            status={s}
          />
        ))}
      </div>

      {statusCounts.all === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="sm:hidden space-y-2">
            {leads.map(l => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="block bg-white rounded-2xl border border-slate-200 p-3 active:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <Avatar name={l.business_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium truncate">
                          {l.business_name ?? <span className="italic text-slate-400">unknown</span>}
                        </div>
                        <StatusPill status={l.status} />
                      </div>
                      {l.business_type && (
                        <div className="text-[11px] text-slate-500 capitalize mt-0.5">{l.business_type}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{l.formatted_addr ?? "—"}</div>
                      <div className="text-xs text-slate-500 mt-1.5 flex justify-between">
                        <span>{l.zones?.name ?? "—"}</span>
                        <span className="tabular-nums">{(l.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {leads.length === 0 && <FilteredEmpty />}
          </ul>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">Business</th>
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Address</th>
                    <th className="text-left px-5 py-3">Zone</th>
                    <th className="text-right px-5 py-3">Confidence</th>
                    <th className="text-left px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/leads/${l.id}`} className="flex items-center gap-3">
                          <Avatar name={l.business_name} />
                          <span className="font-medium">
                            {l.business_name ?? <span className="italic text-slate-400">unknown</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600 capitalize">{l.business_type ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{l.formatted_addr ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{l.zones?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <ConfidenceBar value={l.confidence} />
                      </td>
                      <td className="px-5 py-3"><StatusPill status={l.status} /></td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      No leads match this filter.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ href, label, count, active, status }: {
  href: string; label: string; count: number; active: boolean; status?: LeadStatus;
}) {
  const dot: Record<LeadStatus, string> = {
    new: "bg-blue-500", verified: "bg-emerald-500", contacted: "bg-amber-500",
    converted: "bg-violet-500", rejected: "bg-slate-400",
  };
  return (
    <Link href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium capitalize transition-colors ${
        active
          ? "bg-ink text-white border-ink"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
      }`}>
      {status && <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />}
      {label}
      <span className={`tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>{count}</span>
    </Link>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="inline-flex items-center gap-2 w-32 justify-end">
      <span className="text-slate-600 text-xs">{pct}%</span>
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
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

function EmptyState() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-ink to-slate-800 text-white p-8 sm:p-12 text-center shadow-lg">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold">No leads yet</h2>
      <p className="text-sm text-slate-300 mt-1 max-w-md mx-auto">
        Pull real industrial businesses from OpenStreetMap to get started.
        Welders, fabricators, and gas suppliers across three UK industrial estates.
      </p>
      <div className="mt-5 inline-block"><SeedRealDataButton /></div>
    </div>
  );
}

function FilteredEmpty() {
  return (
    <li className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
      No leads match this filter.
    </li>
  );
}
