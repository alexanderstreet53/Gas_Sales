import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RawLead {
  id: string;
  business_name: string | null;
  business_type: string | null;
  confidence: number;
  status: string;
  site_id: string | null;
  zone_id: string;
  enrichment: Record<string, unknown> | null;
  zones: { name: string } | null;
}

interface FunnelLead {
  id: string;
  name: string | null;
  type: string | null;
  zoneName: string;
  confidence: number;
  status: string;
  stage: Stage;
  hasStreetView: boolean;
  hasSatelliteScan: boolean;
  hasTankType: boolean;
}

const STAGES = [
  { id: "discovered" as const, name: "Discovered",       hint: "Sourced from OSM / Companies House" },
  { id: "satellite"  as const, name: "Satellite scan",   hint: "Detection ran on a satellite tile" },
  { id: "street"     as const, name: "Street View scan", hint: "Panorama fetched + AI run" },
  { id: "typed"      as const, name: "Type identified",  hint: "Tank type estimated" },
  { id: "verified"   as const, name: "Verified",         hint: "Human reviewed" },
  { id: "contacted"  as const, name: "Contacted",        hint: "Sales touched" },
  { id: "converted"  as const, name: "Converted",        hint: "Closed customer" },
];

type Stage = typeof STAGES[number]["id"];

const STAGE_TONES: Record<Stage, string> = {
  discovered: "from-blue-500/10 to-blue-500/5 border-blue-200",
  satellite:  "from-cyan-500/10 to-cyan-500/5 border-cyan-200",
  street:     "from-teal-500/10 to-teal-500/5 border-teal-200",
  typed:      "from-amber-500/10 to-amber-500/5 border-amber-200",
  verified:   "from-emerald-500/10 to-emerald-500/5 border-emerald-200",
  contacted:  "from-orange-500/10 to-orange-500/5 border-orange-200",
  converted:  "from-violet-500/10 to-violet-500/5 border-violet-200",
};

function classifyLead(l: RawLead, siteIdsWithDetections: Set<string>): Stage {
  const e = (l.enrichment ?? {}) as Record<string, unknown>;
  const hasStreet = !!(e.streetviews || e.streetview);
  const hasSatellite = !!(l.site_id && siteIdsWithDetections.has(l.site_id));
  const hasTankType = !!(e.tank_type);

  if (l.status === "converted") return "converted";
  if (l.status === "contacted") return "contacted";
  if (l.status === "verified")  return "verified";
  if (hasTankType)              return "typed";
  if (hasStreet)                return "street";
  if (hasSatellite)             return "satellite";
  return "discovered";
}

export default async function PipelinePage() {
  const sb = supabaseService();

  const [{ data: rawLeads }, { data: detSites }] = await Promise.all([
    sb.from("leads")
      .select("id, business_name, business_type, confidence, status, site_id, zone_id, enrichment, zones(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500),
    sb.from("detections").select("site_id").not("site_id", "is", null),
  ]);

  const siteIdsWithDetections = new Set(
    ((detSites ?? []) as { site_id: string | null }[])
      .map(d => d.site_id).filter(Boolean) as string[],
  );

  const leads: FunnelLead[] = ((rawLeads ?? []) as unknown as RawLead[]).map(l => {
    const e = (l.enrichment ?? {}) as Record<string, unknown>;
    return {
      id: l.id,
      name: l.business_name,
      type: l.business_type,
      zoneName: l.zones?.name ?? "—",
      confidence: l.confidence,
      status: l.status,
      stage: classifyLead(l, siteIdsWithDetections),
      hasStreetView: !!(e.streetviews || e.streetview),
      hasSatelliteScan: !!(l.site_id && siteIdsWithDetections.has(l.site_id)),
      hasTankType: !!e.tank_type,
    };
  });

  const byStage = new Map<Stage, FunnelLead[]>();
  for (const s of STAGES) byStage.set(s.id, []);
  for (const l of leads) byStage.get(l.stage)?.push(l);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Sales pipeline</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Every lead moves left → right as it gets enriched and qualified. Click a card to open it.
        </p>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-3 px-3 snap-x">
        {STAGES.map(stage => {
          const stageLeads = byStage.get(stage.id) ?? [];
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-72 sm:w-80 rounded-2xl border bg-gradient-to-b ${STAGE_TONES[stage.id]} snap-start`}
            >
              <div className="px-4 py-3 border-b border-slate-200/60 sticky top-0 bg-white/60 backdrop-blur rounded-t-2xl">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold text-sm">{stage.name}</h2>
                  <span className="text-xs tabular-nums font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{stage.hint}</p>
              </div>
              <ul className="p-2 space-y-2 min-h-[80px] max-h-[70vh] overflow-y-auto">
                {stageLeads.map(l => (
                  <li key={l.id}>
                    <Link
                      href={`/leads/${l.id}`}
                      className="block bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="text-sm font-medium truncate">
                        {l.name ?? <em className="text-slate-400">unknown</em>}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {l.zoneName}{l.type ? ` · ${l.type}` : ""}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                          l.confidence >= 0.85 ? "bg-emerald-100 text-emerald-800"
                          : l.confidence >= 0.65 ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                        }`}>
                          {(l.confidence * 100).toFixed(0)}%
                        </span>
                        {l.hasSatelliteScan && <Pill>SAT</Pill>}
                        {l.hasStreetView   && <Pill>SV</Pill>}
                        {l.hasTankType     && <Pill>TYPE</Pill>}
                      </div>
                    </Link>
                  </li>
                ))}
                {stageLeads.length === 0 && (
                  <li className="px-3 py-6 text-center text-[11px] text-slate-400">No leads yet</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded-full font-semibold text-slate-700 bg-slate-100 border border-slate-200">
      {children}
    </span>
  );
}
