// Plausible-looking tank-type identification for the sales demo. Real
// classifier is a separate model-training task; until that exists, this
// generates stable (deterministic per lead) but realistic-looking
// "gas type / size / confidence" labels so the lead detail page shows
// the eventual feature.

export type GasType =
  | "oxygen"
  | "argon"
  | "nitrogen"
  | "methane"
  | "propane"
  | "co2"
  | "acetylene";

export interface TankEstimate {
  type: GasType;
  typeLabel: string;
  symbol: string;
  /** Litres */
  estimatedSizeL: number;
  /** 0..1 */
  confidence: number;
  demo: true;
}

const TYPES: { type: GasType; label: string; symbol: string; weight: number }[] = [
  { type: "oxygen",    label: "Oxygen",    symbol: "O₂",     weight: 3 },
  { type: "argon",     label: "Argon",     symbol: "Ar",     weight: 2 },
  { type: "nitrogen",  label: "Nitrogen",  symbol: "N₂",     weight: 3 },
  { type: "methane",   label: "Methane",   symbol: "CH₄",    weight: 1 },
  { type: "propane",   label: "Propane",   symbol: "C₃H₈",   weight: 2 },
  { type: "co2",       label: "CO₂",       symbol: "CO₂",    weight: 2 },
  { type: "acetylene", label: "Acetylene", symbol: "C₂H₂",   weight: 1 },
];

/** Deterministic per-lead tank estimate so it doesn't flicker on refresh. */
export function makeDemoTank(leadId: string, businessType?: string | null): TankEstimate {
  const seed = hash(leadId);
  const rng = mulberry32(seed);

  // Bias type by what the business does (welder → acetylene / argon; food → CO2; etc.).
  const t = pickWeighted(TYPES, rng(), bizBias(businessType));

  const size = [200, 500, 1000, 2000, 3000, 6000][Math.floor(rng() * 6)];
  const confidence = Number((0.42 + rng() * 0.45).toFixed(2));

  return {
    type: t.type,
    typeLabel: t.label,
    symbol: t.symbol,
    estimatedSizeL: size,
    confidence,
    demo: true,
  };
}

function bizBias(biz?: string | null): (t: GasType) => number {
  const s = (biz ?? "").toLowerCase();
  return (t) => {
    if (/weld|fabric|metal|forge|steel/.test(s) && (t === "argon" || t === "acetylene" || t === "oxygen")) return 3;
    if (/food|brew|drinks|beverage/.test(s) && t === "co2") return 4;
    if (/gas|distribut|fuel/.test(s) && (t === "propane" || t === "methane")) return 3;
    if (/engineer|machin|repair/.test(s) && (t === "argon" || t === "nitrogen")) return 2;
    return 1;
  };
}

function pickWeighted<T extends { type: GasType; weight: number }>(
  arr: T[],
  r: number,
  mult: (type: GasType) => number,
): T {
  const weighted = arr.map(item => ({ item, w: item.weight * mult(item.type) }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let acc = r * total;
  for (const w of weighted) {
    acc -= w.w;
    if (acc <= 0) return w.item;
  }
  return weighted[weighted.length - 1].item;
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
