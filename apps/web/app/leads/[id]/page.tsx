import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import LeadDetail from "@/components/LeadDetail";
import { normalizePoint } from "@/lib/geo/parse";

export const dynamic = "force-dynamic";

interface ImageTile { storage_path: string; width_px: number; height_px: number }

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

  // Top-confidence detection's satellite tile, for a satellite preview crop.
  const { data: topDetection } = await sb
    .from("detections")
    .select("id, confidence, tile_id, bbox_pixels, imagery_tiles(storage_path, width_px, height_px)")
    .eq("site_id", lead.site_id)
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const satTile = topDetection?.imagery_tiles as unknown as ImageTile | null;
  let satelliteUrl: string | null = null;
  if (satTile?.storage_path) {
    const signed = await sb.storage.from("imagery").createSignedUrl(satTile.storage_path, 60 * 60);
    satelliteUrl = signed.data?.signedUrl ?? null;
  }

  const topDetectionForView = topDetection
    ? {
        bbox_pixels: topDetection.bbox_pixels as number[] | null,
        confidence: topDetection.confidence as number,
        imagery_tiles: satTile ? { width_px: satTile.width_px, height_px: satTile.height_px } : null,
      }
    : null;

  // Street View tile, if a scan has been run.
  const enrichment = (lead.enrichment as Record<string, unknown> | null) ?? {};
  const sv = enrichment.streetview as { tile_id?: string } | undefined;
  let streetViewUrl: string | null = null;
  if (sv?.tile_id) {
    const { data: svTile } = await sb
      .from("imagery_tiles")
      .select("storage_path")
      .eq("id", sv.tile_id)
      .maybeSingle();
    if (svTile?.storage_path) {
      const signed = await sb.storage.from("imagery").createSignedUrl(svTile.storage_path, 60 * 60);
      streetViewUrl = signed.data?.signedUrl ?? null;
    }
  }

  // Site centroid for "Open in maps" / external Street View link.
  // Centroid arrives as GeoJSON or hex EWKB depending on Supabase config; normalise both.
  const siteShape = (lead.sites as unknown) as { centroid?: unknown } | { centroid?: unknown }[] | null;
  const site = Array.isArray(siteShape) ? siteShape[0] : siteShape;
  const latLng = normalizePoint(site?.centroid);

  // Interactive 360 Street View via the Maps Embed API (separate from
  // Street View Static used for caching). The key ends up in the iframe
  // src — restrict it by HTTP referrer on the Google side.
  const googleKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  const streetViewEmbedSrc = (googleKey && latLng)
    ? `https://www.google.com/maps/embed/v1/streetview?key=${googleKey}&location=${latLng.lat},${latLng.lng}&heading=0&pitch=0&fov=90`
    : null;

  return (
    <LeadDetail
      lead={lead}
      topDetection={topDetectionForView}
      satelliteUrl={satelliteUrl}
      streetViewUrl={streetViewUrl}
      streetViewEmbedSrc={streetViewEmbedSrc}
      latLng={latLng}
    />
  );
}
