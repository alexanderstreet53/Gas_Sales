// Demo / sales-pitch helper for when the YOLO worker is asleep or you
// haven't trained a custom model yet. Generates plausible *vehicle*
// detections — cars, trucks, lorries — at realistic sizes for the
// imagery zoom level. These are honest labels: pretrained YOLOv8 (COCO)
// genuinely detects these classes out of the box, so the demo lines
// up with what the real worker would return on the same imagery.
//
// Each row gets model_version = "demo-v1" so demo data is identifiable
// and can be wiped: `delete from detections where model_version = 'demo-v1'`.

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
  /** Optional deterministic seed so the same tile always gets the same demo. */
  seed?: number;
}

/** Returns 1–5 plausible-looking vehicle detection boxes for a tile. */
export function makeDemoDetections({ width, height, source, seed }: MakeArgs): DemoBox[] {
  const rng = seed != null ? mulberry32(seed) : Math.random;

  if (source === "satellite") {
    // At z=19 (~0.3 m/px) a car footprint is roughly 4 m × 2 m → 13×7 px.
    // A van / small truck is ~6 m × 2.5 m → 20×8 px.
    // A lorry / HGV is ~12 m × 2.7 m → 40×9 px.
    const count = 1 + Math.floor(rng() * 4); // 1–4
    return Array.from({ length: count }, () => {
      const r = rng();
      const kind = r < 0.55 ? "car" : r < 0.85 ? "truck" : "bus";
      const dims = kind === "car"   ? { w: 11 + rng() * 6,  h: 5 + rng() * 4 }
                 : kind === "truck" ? { w: 18 + rng() * 14, h: 7 + rng() * 4 }
                 :                    { w: 28 + rng() * 14, h: 8 + rng() * 5 };
      const w = Math.round(dims.w);
      const h = Math.round(dims.h);
      const x = Math.floor(40 + rng() * Math.max(1, width  - w - 80));
      const y = Math.floor(40 + rng() * Math.max(1, height - h - 80));
      return {
        class: kind,
        confidence: Number((0.72 + rng() * 0.24).toFixed(2)),
        bbox_pixels: [x, y, x + w, y + h] as [number, number, number, number],
      };
    });
  }

  // Street view: vehicles dominate the lower half of the frame.
  const count = 1 + Math.floor(rng() * 3); // 1–3
  return Array.from({ length: count }, () => {
    const r = rng();
    const kind = r < 0.55 ? "car" : r < 0.85 ? "truck" : "person";
    const dims = kind === "car"    ? { w: 140 + rng() * 100, h: 90 + rng() * 60  }
               : kind === "truck"  ? { w: 200 + rng() * 140, h: 130 + rng() * 70 }
               :                     { w: 50  + rng() * 40,  h: 130 + rng() * 60 };
    const w = Math.min(width  - 40, Math.round(dims.w));
    const h = Math.min(height - 40, Math.round(dims.h));
    const x = Math.floor(20 + rng() * Math.max(1, width - w - 40));
    const yBase = height * 0.35;
    const yRange = Math.max(1, height * 0.55 - h);
    const y = Math.floor(yBase + rng() * yRange);
    return {
      class: kind,
      confidence: Number((0.78 + rng() * 0.18).toFixed(2)),
      bbox_pixels: [x, y, x + w, y + h] as [number, number, number, number],
    };
  });
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
 * the same demo detections instead of jittering on every refresh.
 */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
