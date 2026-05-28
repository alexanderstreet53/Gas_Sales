import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import StatusPill from "@/components/StatusPill";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  business_name: string | null;
  formatted_addr: string | null;
  confidence: number;
  status: LeadStatus;
  zone_id: string;
  updated_at: string;
  zones: { name: string } | null;
}

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; zone?: string }> }) {
  const sp = await searchParams;
  const sb = supabaseService();
  let q = sb
    .from("leads")
    .select("id, business_name, formatted_addr, confidence, status, zone_id, updated_at, zones(name)")
    .is("deleted_at", null)
    .order("confidence", { ascending: false })
    .limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.zone)   q = q.eq("zone_id", sp.zone);
  const { data } = await q;
  const leads = (data ?? []) as unknown as LeadRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="text-sm text-slate-500">{leads.length} shown</div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {(["new","verified","contacted","converted","rejected"] as LeadStatus[]).map(s => (
          <Link key={s} href={`/leads?status=${s}`} className="px-3 py-1.5 rounded-full border bg-white capitalize">{s}</Link>
        ))}
        <Link href="/leads" className="px-3 py-1.5 rounded-full border bg-white">All</Link>
      </div>

      {/* Mobile: card list */}
      <ul className="sm:hidden space-y-2">
        {leads.map(l => (
          <li key={l.id}>
            <Link href={`/leads/${l.id}`}
              className="block bg-white rounded-xl border p-3 active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">
                  {l.business_name ?? <span className="italic text-slate-400">unknown</span>}
                </div>
                <StatusPill status={l.status} />
              </div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{l.formatted_addr ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-1 flex justify-between">
                <span>{l.zones?.name ?? "—"}</span>
                <span>{(l.confidence * 100).toFixed(0)}%</span>
              </div>
            </Link>
          </li>
        ))}
        {leads.length === 0 && (
          <li className="bg-white rounded-xl border p-6 text-center text-slate-500 text-sm">No leads yet.</li>
        )}
      </ul>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Business</th>
                <th className="text-left px-4 py-2">Address</th>
                <th className="text-left px-4 py-2">Zone</th>
                <th className="text-left px-4 py-2">Confidence</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/leads/${l.id}`} className="font-medium">
                      {l.business_name ?? <span className="italic text-slate-400">unknown</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{l.formatted_addr ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{l.zones?.name ?? "—"}</td>
                  <td className="px-4 py-2">{(l.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2"><StatusPill status={l.status} /></td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No leads yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
