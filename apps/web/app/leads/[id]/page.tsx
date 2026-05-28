import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import LeadDetail from "@/components/LeadDetail";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseService();
  const { data: lead } = await sb
    .from("leads")
    .select("*, sites(centroid, hull), zones(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!lead) notFound();

  // Pull the highest-confidence detection's tile, for the imagery preview.
  const { data: topDetection } = await sb
    .from("detections")
    .select("id, confidence, tile_id, bbox_pixels, imagery_tiles(storage_path, width_px, height_px)")
    .eq("site_id", lead.site_id)
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle();

  let signedUrl: string | null = null;
  if (topDetection?.imagery_tiles && "storage_path" in (topDetection.imagery_tiles as object)) {
    const path = (topDetection.imagery_tiles as { storage_path: string }).storage_path;
    const signed = await sb.storage.from("imagery").createSignedUrl(path, 60 * 60);
    signedUrl = signed.data?.signedUrl ?? null;
  }

  return <LeadDetail lead={lead} topDetection={topDetection} signedUrl={signedUrl} />;
}
