// Thin client for the FastAPI detection worker.

import { env } from "@/lib/env";

export interface DetectRequest {
  tileId: string;
  imageUrl: string;            // signed URL the worker fetches
  centerLat: number;
  centerLng: number;
  zoom: number;
  widthPx: number;
  heightPx: number;
}

export interface DetectionResult {
  class: string;
  confidence: number;
  bbox_pixels: [number, number, number, number];
  lat: number;
  lng: number;
}

export interface DetectResponse {
  model_version: string;
  detections: DetectionResult[];
}

export async function callDetect(req: DetectRequest): Promise<DetectResponse> {
  const res = await fetch(`${env.workerUrl}/detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.workerApiKey,
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Worker /detect failed: ${res.status} ${await res.text()}`);
  return res.json();
}
