// Demo / sales-pitch helper: generate plausible-looking fake detections
// for a tile. Used when the lead-detail "Demo mode" toggle is on so the
// UI demonstrates what the product will look like with a trained model.
//
// Each row gets model_version = "demo-v1" so demo data is identifiable
// and can be cleaned up in SQL (`delete from detections where
// model_version = 'demo-v1'`).

export const DEMO_MODEL_VERSION = "demo-v1";

export interface DemoBox {
  class: string;
  confidence: number;
  bbox_pixels: [number, number, number, number];
}

interface MakeArgs {
  width: number;
  height: number;
  source: "satellite" | "streetview";
  // Optional deterministic seed for stable demo on a given tile.
  seed?: number;
}

/** Returns 1–4 plausible-looking fake boxes for a tile. */
export function makeDemoDetections({ width, height, source, seed }: MakeArgs): DemoBox[] {
  const rng = seed != null ? mulberry32(seed) : Math.random;

  // Satellite: small horizontal cylinders / vertical tanks, roughly
  //   2-6 m wide at z=19 → ~10-30 px. Cluster sizes a bit larger.
  // Street view: dominant ground-level objects, much bigger.
  const cfg = source === "satellite"
    ? { minW: 14, maxW: 38, minH: 14, maxH: 38, count: [1, 2, 3] as const, padding: 30 }
    : { minW: 70, maxW: 180, minH: 60, maxH: 160, count: [1, 2] as const, padding: 30 };

  const count = cfg.count[Math.floor(rng() * cfg.count.length)];
  const labels = source === "satellite"
    ? ["bulk_tank", "bulk_tank", "cylinder"] // skew toward bulk_tank
    : ["cylinder", "cylinder", "bulk_tank"]; // skew toward cylinder at street level

  const out: DemoBox[] = [];
  for (let i = 0; i < count; i++) {
    const w = Math.floor(cfg.minW + rng() * (cfg.maxW - cfg.minW));
    const h = Math.floor(cfg.minH + rng() * (cfg.maxH - cfg.minH));
    const x = Math.floor(cfg.padding + rng() * Math.max(1, width - w - cfg.padding * 2));
    // Street-level: bias toward lower half of the frame (where ground objects sit).
    const yBase = source === "streetview" ? height * 0.4 : cfg.padding;
    const yRange = source === "streetview"
      ? height * 0.55 - h
      : height - h - cfg.padding * 2;
    const y = Math.floor(yBase + rng() * Math.max(1, yRange));
    const label = labels[Math.floor(rng() * labels.length)];
    const confidence = Number((0.78 + rng() * 0.18).toFixed(2));
    out.push({
      class: label,
      confidence,
      bbox_pixels: [x, y, x + w, y + h],
    });
  }
  return out;
}

/** Lightweight deterministic PRNG seeded by an integer. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a UUID-ish string to a 32-bit int so a given tile always gets
 * the same demo detections (otherwise demo mode would jitter on every
 * page refresh).
 */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
