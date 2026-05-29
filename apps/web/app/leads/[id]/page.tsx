import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import LeadDetail from "@/components/LeadDetail";
import { normalizePoint } from "@/lib/geo/parse";

export const dynamic = "force-dynamic";

interface TileRow {
  id: string;
  storage_path: string;
  width_px: number;
  height_px: number;
  z: number | null;
  center: unknown;
}

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

  // Site centroid for the lead.
  const siteShape = (lead.sites as unknown) as { centroid?: unknown } | { centroid?: unknown }[] | null;
  const site = Array.isArray(siteShape) ? siteShape[0] : siteShape;
  const latLng = normalizePoint(site?.centroid);

  // Find the cached satellite tile closest to this lead's coords.
  // Renders independently of detections so the user sees the tile even
  // before running detect.
  let satelliteUrl: string | null = null;
  let satTileMeta: { width_px: number; height_px: number; id: string } | null = null;
  let detections: { class: string; confidence: number; bbox_pixels: number[] }[] = [];

  if (latLng) {
    const { data: tiles } = await sb
      .from("imagery_tiles")
      .select("id, storage_path, width_px, height_px, z, center")
      .eq("zone_id", lead.zone_id)
      .eq("kind", "satellite");

    let best: TileRow | null = null;
    let bestDist = Infinity;
    for (const t of (tiles ?? []) as TileRow[]) {
      const p = normalizePoint(t.center);
      if (!p) continue;
      const dy = (p.lat - latLng.lat) * 111_320;
      const dx = (p.lng - latLng.lng) * 111_320 * Math.cos((latLng.lat * Math.PI) / 180);
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = t; }
    }

    if (best) {
      const signed = await sb.storage.from("imagery").createSignedUrl(best.storage_path, 60 * 60);
      satelliteUrl = signed.data?.signedUrl ?? null;
      satTileMeta = { id: best.id, width_px: best.width_px, height_px: best.height_px };

      // Detections on this tile (newly-run per-lead detects land here).
      const { data: dets } = await sb
        .from("detections")
        .select("class, confidence, bbox_pixels")
        .eq("tile_id", best.id)
        .order("confidence", { ascending: false });
      detections = ((dets ?? []) as { class: string; confidence: number; bbox_pixels: number[] }[]);
    }
  }

  // Street View shots — one per heading (N / E / S / W). Falls back to
  // the legacy single-shot pointer if a multi-shot scan hasn't run yet.
  const enrichment = (lead.enrichment as Record<string, unknown> | null) ?? {};
  interface ShotMeta { tile_id: string; heading: number; name?: string }
  const shotMetas = (enrichment.streetviews as ShotMeta[] | undefined) ?? (() => {
    const legacy = enrichment.streetview as { tile_id?: string } | undefined;
    return legacy?.tile_id ? [{ tile_id: legacy.tile_id, heading: 0, name: "N" }] : [];
  })();

  interface StreetShot {
    heading: number;
    name: string;
    url: string;
    tile: { id: string; width_px: number; height_px: number };
    detections: { class: string; confidence: number; bbox_pixels: number[] }[];
  }

  const streetShots: StreetShot[] = [];
  for (const sm of shotMetas) {
    const { data: svTile } = await sb
      .from("imagery_tiles")
      .select("id, storage_path, width_px, height_px")
      .eq("id", sm.tile_id)
      .maybeSingle();
    if (!svTile?.storage_path) continue;
    const signed = await sb.storage.from("imagery").createSignedUrl(svTile.storage_path, 60 * 60);
    if (!signed.data?.signedUrl) continue;
    const { data: dets } = await sb
      .from("detections")
      .select("class, confidence, bbox_pixels")
      .eq("tile_id", svTile.id)
      .order("confidence", { ascending: false });
    streetShots.push({
      heading: sm.heading,
      name: sm.name ?? `${sm.heading}°`,
      url: signed.data.signedUrl,
      tile: { id: svTile.id, width_px: svTile.width_px, height_px: svTile.height_px },
      detections: ((dets ?? []) as { class: string; confidence: number; bbox_pixels: number[] }[]),
    });
  }
  // Sort N, E, S, W for predictable display.
  streetShots.sort((a, b) => a.heading - b.heading);

  // Interactive 360 Street View via the Maps Embed API.
  const googleKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  const streetViewEmbedSrc = (googleKey && latLng)
    ? `https://www.google.com/maps/embed/v1/streetview?key=${googleKey}&location=${latLng.lat},${latLng.lng}&heading=0&pitch=0&fov=90`
    : null;

  return (
    <LeadDetail
      lead={lead}
      satelliteUrl={satelliteUrl}
      satelliteTile={satTileMeta}
      satelliteDetections={detections}
      streetShots={streetShots}
      streetViewEmbedSrc={streetViewEmbedSrc}
      latLng={latLng}
    />
  );
}
