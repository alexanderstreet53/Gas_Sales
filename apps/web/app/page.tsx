import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import UkMap from "@/components/UkMap";
import StatusPill from "@/components/StatusPill";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ZoneRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  boundary: { type: "Polygon"; coordinates: number[][][] } | null;
}

interface ZoneWithStats {
  id: string;
  name: string;
  description: string | null;
  status: string;
  boundary: ZoneRow["boundary"];
  leads: number;
  detections: number;
  verified: number;
  contacted: number;
  converted: number;
}

interface RecentLead {
  id: string;
  business_name: string | null;
  formatted_addr: string | null;
  confidence: number;
  status: LeadStatus;
  zones: { name: string } | null;
}

async function load(): Promise<{
  zones: ZoneWithStats[];
  totals: { leads: number; verified: number; contacted: number; converted: number; detections: number };
  recent: RecentLead[];
} | null> {
  try {
    const sb = supabaseService();
    const [{ data: zones }, { data: leads }, { data: dets }, { data: recent }] = await Promise.all([
      sb.from("zones_geojson")
        .select("id, name, description, status, boundary")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      sb.from("leads")
        .select("zone_id, status")
        .is("deleted_at", null),
      sb.from("detections").select("zone_id"),
      sb.from("leads")
        .select("id, business_name, formatted_addr, confidence, status, zones(name)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    const leadsByZone = new Map<string, { total: number; verified: number; contacted: number; converted: number }>();
    for (const l of leads ?? []) {
      const k = l.zone_id as string;
      const v = leadsByZone.get(k) ?? { total: 0, verified: 0, contacted: 0, converted: 0 };
      v.total++;
      if (l.status === "verified") v.verified++;
      else if (l.status === "contacted") v.contacted++;
      else if (l.status === "converted") v.converted++;
      leadsByZone.set(k, v);
    }
    const detsByZone = new Map<string, number>();
    for (const d of dets ?? []) {
      const k = d.zone_id as string;
      detsByZone.set(k, (detsByZone.get(k) ?? 0) + 1);
    }

    const zonesWithStats: ZoneWithStats[] = ((zones ?? []) as ZoneRow[]).map(z => {
      const ls = leadsByZone.get(z.id) ?? { total: 0, verified: 0, contacted: 0, converted: 0 };
      return {
        id: z.id,
        name: z.name,
        description: z.description,
        status: z.status,
        boundary: z.boundary,
        leads: ls.total,
        detections: detsByZone.get(z.id) ?? 0,
        verified: ls.verified,
        contacted: ls.contacted,
        converted: ls.converted,
      };
    });

    const totals = {
      leads: zonesWithStats.reduce((s, z) => s + z.leads, 0),
      verified: zonesWithStats.reduce((s, z) => s + z.verified, 0),
      contacted: zonesWithStats.reduce((s, z) => s + z.contacted, 0),
      converted: zonesWithStats.reduce((s, z) => s + z.converted, 0),
      detections: zonesWithStats.reduce((s, z) => s + z.detections, 0),
    };

    return { zones: zonesWithStats, totals, recent: (recent ?? []) as unknown as RecentLead[] };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const d = await load();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  if (!d) {
    return (
      <div className="space-y-5">
        <Hero />
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          Supabase isn&apos;t connected yet. Configure env vars and apply migrations to see the map.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Hero />

      {/* Summary strip */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <Stat label="Areas scanned" value={d.zones.length} />
        <Stat label="Leads" value={d.totals.leads} primary />
        <Stat label="AI detections" value={d.totals.detections} />
        <Stat label="Contacted" value={d.totals.contacted} />
        <Stat label="Converted" value={d.totals.converted} />
      </section>

      <UkMap
        zones={d.zones.map(z => ({
          id: z.id,
          name: z.name,
          description: z.description,
          status: z.status,
          leads: z.leads,
          detections: z.detections,
          verified: z.verified,
          contacted: z.contacted,
          converted: z.converted,
          boundary: z.boundary,
        }))}
        mapboxToken={mapboxToken}
      />

      <section className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-medium text-sm">Areas</h2>
            <Link href="/zones" className="text-xs text-slate-500 hover:text-ink">All zones →</Link>
          </div>
          {d.zones.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">
              No areas yet. <Link href="/zones" className="underline">Add a UK industrial estate</Link> to begin.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.zones.map(z => {
                const stages = [
                  { name: "Discovered", n: z.leads,                          tone: "bg-blue-500" },
                  { name: "Verified",   n: z.verified,                       tone: "bg-emerald-500" },
                  { name: "Contacted",  n: z.contacted,                      tone: "bg-amber-500" },
                  { name: "Converted",  n: z.converted,                      tone: "bg-violet-500" },
                ];
                return (
                  <li key={z.id}>
                    <Link href={`/zones/${z.id}`} className="block px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-baseline justify-between">
                        <div className="font-medium">{z.name}</div>
                        <div className="text-xs text-slate-500 tabular-nums">{z.leads} leads · {z.detections} dets</div>
                      </div>
                      <div className="mt-2 flex gap-1 h-1.5">
                        {stages.map(s => {
                          const pct = z.leads > 0 ? (s.n / z.leads) * 100 : 0;
                          return (
                            <div key={s.name} className="flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full ${s.tone}`} style={{ width: `${pct}%` }} />
                            </div>
                          );
                        })}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-medium text-sm">Recent leads</h2>
            <Link href="/pipeline" className="text-xs text-slate-500 hover:text-ink">Pipeline →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {d.recent.map(l => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <Avatar name={l.business_name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{l.business_name ?? "unknown"}</div>
                    <div className="text-[11px] text-slate-500 truncate">{l.zones?.name ?? "—"}</div>
                  </div>
                  <StatusPill status={l.status} />
                </Link>
              </li>
            ))}
            {d.recent.length === 0 && (
              <li className="p-6 text-sm text-slate-500 text-center">No leads yet.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-1">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">UK industrial gas prospecting</h1>
      <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
        Areas you&apos;ve scanned across the UK, coloured by how far through the funnel each one is. Click a marker to drill in.
      </p>
    </section>
  );
}

function Stat({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  return (
    <div className={`rounded-2xl border ${primary ? "bg-accent/[0.04] border-accent/30 ring-1 ring-accent/20" : "bg-white border-slate-200"} p-3 sm:p-4`}>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initials = (name ?? "?").split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center text-xs font-semibold">
      {initials || "?"}
    </div>
  );
}
