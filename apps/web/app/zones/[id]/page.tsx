import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import ZoneDetail from "@/components/ZoneDetail";

export const dynamic = "force-dynamic";

export default async function ZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();
  const { data: zone } = await sb
    .from("zones")
    .select("id, name, description, status, zoom, boundary, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!zone) notFound();

  const [{ count: tileCount }, { count: detectionCount }, { count: leadCount }] = await Promise.all([
    sb.from("imagery_tiles").select("id", { count: "exact", head: true }).eq("zone_id", id),
    sb.from("detections").select("id", { count: "exact", head: true }).eq("zone_id", id),
    sb.from("leads").select("id", { count: "exact", head: true }).eq("zone_id", id).is("deleted_at", null),
  ]);

  return (
    <ZoneDetail
      zone={zone}
      tileCount={tileCount ?? 0}
      detectionCount={detectionCount ?? 0}
      leadCount={leadCount ?? 0}
    />
  );
}
