// Thin client for the FastAPI detection worker. Includes a cold-start
// retry so the caller doesn't surface "fetch failed" when the Fly
// machine is asleep.

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

/** Best-effort ping to wake a sleeping Fly machine. Quietly fails if unreachable. */
async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${env.workerUrl}/healthz`, {
      signal: AbortSignal.timeout(45_000), // PyTorch import is slow
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function callDetect(req: DetectRequest): Promise<DetectResponse> {
  // First attempt — if the worker is warm this returns in <2s.
  try {
    return await postDetect(req);
  } catch (firstErr) {
    const msg = (firstErr as Error).message;
    // Only retry on connection-level failures (cold start, network blip).
    if (!/fetch failed|ECONNREFUSED|ETIMEDOUT|terminated/i.test(msg)) throw firstErr;

    // Worker was likely asleep. Ping /healthz to wake it, then retry once.
    await pingHealth();
    return await postDetect(req);
  }
}

async function postDetect(req: DetectRequest): Promise<DetectResponse> {
  const res = await fetch(`${env.workerUrl}/detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.workerApiKey,
    },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Worker /detect failed: ${res.status} ${await res.text()}`);
  return res.json();
}
