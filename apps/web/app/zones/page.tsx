import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import ZoneDrawer from "@/components/ZoneDrawer";

export const dynamic = "force-dynamic";

async function loadZones() {
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("zones")
      .select("id, name, description, status, zoom, created_at, boundary")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch { return []; }
}

export default async function ZonesPage() {
  const zones = await loadZones();
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <h1 className="text-2xl font-semibold">Zones</h1>
        <span className="text-xs sm:text-sm text-slate-500">
          Draw a polygon below or POST GeoJSON to <code>/api/zones</code>.
        </span>
      </div>

      <ZoneDrawer />

      <section className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b text-sm font-medium">Existing zones</div>
        {zones.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No zones yet.</div>
        ) : (
          <ul className="divide-y">
            {zones.map(z => (
              <li key={z.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <Link href={`/zones/${z.id}`} className="font-medium">{z.name}</Link>
                  <div className="text-xs text-slate-500">
                    z{z.zoom} · {z.status} · created {new Date(z.created_at).toLocaleDateString()}
                  </div>
                </div>
                <form action={`/api/zones/${z.id}/fetch`} method="post" className="sm:flex-shrink-0">
                  <button className="w-full sm:w-auto text-sm px-3 py-2 rounded-lg bg-ink text-white">
                    Run imagery sweep
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
