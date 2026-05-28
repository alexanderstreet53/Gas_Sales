import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import ZoneDrawer from "@/components/ZoneDrawer";
import SeedRealDataButton from "@/components/SeedRealDataButton";

export const dynamic = "force-dynamic";

interface ZoneRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  zoom: number;
  created_at: string;
}

async function loadZones(): Promise<{ zones: ZoneRow[]; leadCounts: Map<string, number> }> {
  try {
    const sb = supabaseService();
    const [{ data }, { data: leads }] = await Promise.all([
      sb
        .from("zones")
        .select("id, name, description, status, zoom, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      sb.from("leads").select("zone_id").is("deleted_at", null),
    ]);
    const leadCounts = new Map<string, number>();
    for (const l of leads ?? []) {
      leadCounts.set(l.zone_id as string, (leadCounts.get(l.zone_id as string) ?? 0) + 1);
    }
    return { zones: (data ?? []) as ZoneRow[], leadCounts };
  } catch { return { zones: [], leadCounts: new Map() }; }
}

export default async function ZonesPage() {
  const { zones, leadCounts } = await loadZones();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Zones</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Areas to scan. Draw a polygon or pull pre-defined UK industrial estates.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-medium">New zone</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          Click the map to add corners, close at 3+ points, then save.
        </p>
        <ZoneDrawer />
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-medium">Existing zones</h2>
          <SeedRealDataButton variant="ghost" />
        </div>
        {zones.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500 mb-4">No zones yet.</p>
            <SeedRealDataButton />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {zones.map(z => (
              <li key={z.id}>
                <Link href={`/zones/${z.id}`}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{z.name}</div>
                    {z.description && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{z.description}</div>
                    )}
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>z{z.zoom}</span>
                      <span className="capitalize">{z.status}</span>
                      <span>{leadCounts.get(z.id) ?? 0} leads</span>
                      <span>created {new Date(z.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-slate-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
