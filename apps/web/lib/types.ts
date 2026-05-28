// Database row types. Hand-rolled to keep things simple; switch to
// `supabase gen types typescript` once the schema stabilises.

export type ZoneStatus = "draft" | "active" | "paused" | "archived";
export type LeadStatus = "new" | "verified" | "contacted" | "converted" | "rejected";
export type TileKind  = "satellite" | "streetview";

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  boundary: GeoJSON.Polygon;   // returned as GeoJSON by the API layer
  zoom: number;
  status: ZoneStatus;
  created_at: string;
  updated_at: string;
}

export interface ImageryTile {
  id: string;
  zone_id: string | null;
  provider: string;
  kind: TileKind;
  cache_key: string;
  z: number | null;
  x: number | null;
  y: number | null;
  center: GeoJSON.Point;
  bounds: GeoJSON.Polygon | null;
  heading: number | null;
  pitch: number | null;
  width_px: number;
  height_px: number;
  storage_path: string;
  fetched_at: string;
  expires_at: string;
}

export interface Detection {
  id: string;
  tile_id: string;
  zone_id: string | null;
  site_id: string | null;
  class: string;
  confidence: number;
  bbox_pixels: [number, number, number, number];
  location: GeoJSON.Point;
  footprint: GeoJSON.Polygon | null;
  model_version: string;
  reviewed: boolean;
  review_result: "confirmed" | "rejected" | null;
}

export interface Site {
  id: string;
  zone_id: string;
  centroid: GeoJSON.Point;
  hull: GeoJSON.Polygon | null;
  detection_count: number;
  best_confidence: number;
}

export interface Lead {
  id: string;
  site_id: string;
  zone_id: string;
  address: string | null;
  formatted_addr: string | null;
  place_id: string | null;
  business_name: string | null;
  business_type: string | null;
  enrichment: Record<string, unknown>;
  confidence: number;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLabel {
  id: string;
  tile_id: string;
  class: string;
  bbox_pixels: [number, number, number, number];
  is_negative: boolean;
  notes: string | null;
}

export interface ApiSpendRow {
  id: number;
  provider: string;
  endpoint: string;
  zone_id: string | null;
  units: number;
  est_cost_usd: number;
  cache_hit: boolean;
  created_at: string;
}
