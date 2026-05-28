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

  // Supabase's TS inference returns the joined table as an array; at runtime
  // it's a single object because the FK is many-to-one. Normalise here.
  const tile = topDetection?.imagery_tiles as unknown as
    { storage_path: string; width_px: number; height_px: number } | null;

  let signedUrl: string | null = null;
  if (tile?.storage_path) {
    const signed = await sb.storage.from("imagery").createSignedUrl(tile.storage_path, 60 * 60);
    signedUrl = signed.data?.signedUrl ?? null;
  }

  const topDetectionForView = topDetection
    ? {
        bbox_pixels: topDetection.bbox_pixels as number[] | null,
        confidence: topDetection.confidence as number,
        imagery_tiles: tile ? { width_px: tile.width_px, height_px: tile.height_px } : null,
      }
    : null;

  return <LeadDetail lead={lead} topDetection={topDetectionForView} signedUrl={signedUrl} />;
}
