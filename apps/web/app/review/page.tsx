import { supabaseService } from "@/lib/supabase/server";
import ReviewQueue from "@/components/ReviewQueue";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const sb = supabaseService();
  const { data: dets } = await sb
    .from("detections")
    .select("id, class, confidence, bbox_pixels, tile_id, imagery_tiles(storage_path, width_px, height_px)")
    .eq("reviewed", false)
    .order("confidence", { ascending: false })
    .limit(25);

  const items = await Promise.all((dets ?? []).map(async d => {
    const tile = d.imagery_tiles as unknown as { storage_path: string; width_px: number; height_px: number } | null;
    let signedUrl = "";
    if (tile) {
      const signed = await sb.storage.from("imagery").createSignedUrl(tile.storage_path, 60 * 60);
      signedUrl = signed.data?.signedUrl ?? "";
    }
    return {
      id: d.id,
      class: d.class,
      confidence: d.confidence,
      bbox: d.bbox_pixels as [number, number, number, number],
      signedUrl,
      tileWidth: tile?.width_px ?? 640,
      tileHeight: tile?.height_px ?? 640,
    };
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Verification queue</h1>
        <p className="text-slate-600 text-sm mt-1 max-w-2xl">
          Confirm or reject each detection. Confirmed boxes are eligible
          for site clustering; rejected ones train future negatives.
        </p>
      </div>
      <ReviewQueue items={items} />
    </div>
  );
}
