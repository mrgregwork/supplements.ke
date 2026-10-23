// Real, weight/size-based shipping cost for Amazon-imported products, replacing
// a single flat USD guess applied to every item regardless of how big or heavy
// it actually is. Ported from shopusa.co.ke's shared/globalMeasurements.ts and
// shared/globalPricing.ts (air-freight path only -- see docs/PRD-SHOPUSA-GLOBAL.md
// section 5.1 for the full worked formula this mirrors), adapted to this site's
// simpler single-currency landed-cost model.
//
// Written against a REAL Rainforest response, which showed three things a naive
// reading would miss:
//   1. `weight` is a string such as "1.4 pounds".
//   2. There is often NO top-level `dimensions` field -- the numbers live in the
//      `specifications` list under names like "Item Dimensions W x H".
//   3. Dimension strings are frequently incomplete (e.g. only width x height, no
//      depth), so no volume can be computed from them.
// Also a trap: a spec called "Capacity" held "2.5 pounds" -- weight is therefore
// only ever taken from specs whose NAME says weight, never from a value alone.

const KG_PER_LB = 0.45359237;
const MM_PER_INCH = 25.4;

export function toKg(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.trim().toLowerCase();
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return value;
  if (["g", "gram", "grams"].includes(u)) return value / 1000;
  if (["lb", "lbs", "pound", "pounds"].includes(u)) return value * KG_PER_LB;
  if (["oz", "ounce", "ounces"].includes(u)) return (value / 16) * KG_PER_LB;
  return null;
}

export function toInches(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.trim().toLowerCase();
  if (["in", "inch", "inches", "\""].includes(u)) return value;
  if (["ft", "foot", "feet"].includes(u)) return value * 12;
  if (["cm", "centimeter", "centimeters", "centimetre", "centimetres"].includes(u)) return (value * 10) / MM_PER_INCH;
  if (["mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(u)) return value / MM_PER_INCH;
  return null;
}

export type Measurements = {
  weightKg: number | null;
  weightNote: string | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  dimsNote: string | null;
  dimsPartial: boolean;
};

type Spec = { name?: string; value?: string };

// Shipping weight beats product weight: packaging is part of what gets freighted.
const WEIGHT_NAMES = [/^package weight$/i, /^shipping weight$/i, /^item weight$/i, /^product weight$/i];
// Package dimensions are the box that ships, so they beat the product's own.
const DIMS_NAMES = [/^package dimensions$/i, /^product dimensions$/i, /^item dimensions\s*l\s*x\s*w\s*x\s*h$/i, /^item dimensions/i, /^dimensions$/i];

const normalise = (s: string) =>
  s
    .replace(/×/g, "x")
    .replace(/[""″]/g, '"')
    .replace(/[''′]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function parseWeight(text: string): number | null {
  const m = normalise(text).match(/(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|grams?|g|pounds?|lbs?|ounces?|oz)\b/i);
  if (!m) return null;
  return toKg(Number(m[1]), m[2]);
}

// Returns up to three numbers (already in inches) and how many were found.
export function parseDimensions(text: string): { inches: number[]; found: number } | null {
  // Amazon's US format is often "5.9 x 3.9 x 1.9 inches; 1.1 Pounds": dimensions
  // come before the semicolon.
  const dimsPart = normalise(text).split(";")[0];
  const unitMatch = [...dimsPart.matchAll(/\b(inches|inch|in|centimeters?|centimetres?|cm|millimeters?|millimetres?|mm|feet|foot|ft)\b/gi)].pop();
  const stringUnit = unitMatch ? unitMatch[1] : null;
  const tokens = [...dimsPart.matchAll(/(\d+(?:\.\d+)?)\s*(\"|inches|inch|in\b|cm|mm|ft\b)?/gi)];
  if (tokens.length === 0) return null;
  const inches: number[] = [];
  for (const t of tokens.slice(0, 3)) {
    // A quote mark directly after a number means inches (10"W). Otherwise use
    // the unit stated once for the whole string, defaulting to inches because
    // this is amazon.com.
    const unit = t[2] ?? stringUnit ?? "in";
    const v = toInches(Number(t[1]), unit);
    if (v != null) inches.push(v);
  }
  return { inches, found: tokens.length };
}

export function extractMeasurements(product: { weight?: unknown; dimensions?: unknown; specifications?: Spec[] }): Measurements {
  const specs: Spec[] = Array.isArray(product.specifications) ? product.specifications : [];
  const find = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const hit = specs.find((s) => s.name && re.test(s.name.trim()) && s.value);
      if (hit) return hit;
    }
    return null;
  };

  let weightKg: number | null = null;
  let weightNote: string | null = null;
  const weightSpec = find(WEIGHT_NAMES);
  if (weightSpec) {
    weightKg = parseWeight(weightSpec.value as string);
    if (weightKg != null) weightNote = weightSpec.name as string;
  }
  if (weightKg == null && typeof product.weight === "string") {
    weightKg = parseWeight(product.weight);
    if (weightKg != null) weightNote = "weight";
  }

  let lengthIn: number | null = null;
  let widthIn: number | null = null;
  let heightIn: number | null = null;
  let dimsNote: string | null = null;
  let dimsPartial = false;
  const dimSources: { text: string; label: string }[] = [];
  if (typeof product.dimensions === "string") dimSources.push({ text: product.dimensions, label: "dimensions" });
  for (const re of DIMS_NAMES) {
    const hit = specs.find((s) => s.name && re.test(s.name.trim()) && s.value);
    if (hit) dimSources.push({ text: hit.value as string, label: hit.name as string });
  }
  for (const src of dimSources) {
    const parsed = parseDimensions(src.text);
    if (!parsed) continue;
    if (parsed.found >= 3 && parsed.inches.length >= 3) {
      [lengthIn, widthIn, heightIn] = parsed.inches;
      dimsNote = src.label;
      dimsPartial = false;
      break;
    }
    dimsPartial = true; // keep looking: a later source may be complete
    dimsNote = dimsNote ?? src.label;
  }
  // The ";" tail of a dimensions string may carry the weight when nothing else did.
  if (weightKg == null) {
    for (const src of dimSources) {
      const tail = normalise(src.text).split(";")[1];
      const w = tail ? parseWeight(tail) : null;
      if (w != null) {
        weightKg = w;
        weightNote = `${src.label} (tail)`;
        break;
      }
    }
  }
  return { weightKg, weightNote, lengthIn, widthIn, heightIn, dimsNote: lengthIn != null ? dimsNote : dimsPartial ? `${dimsNote} (incomplete)` : null, dimsPartial: lengthIn == null && dimsPartial };
}

export type ShippingCostResult = {
  shippingCostUSD: number;
  basis: "actual_weight" | "volumetric_weight" | "flat_fallback";
  chargeableKg: number | null;
};

// Same air-freight formula as shopusa.co.ke Global (PRD 5.1): chargeable weight
// is the GREATER of actual and volumetric weight, charged at a per-kg rate.
// `airRateUsdPerKg` is opt-in (null/unset) per site/admin -- until an admin sets
// a real rate in Settings, every call here falls back to the existing flat
// `shippingCostUSD`, so this never silently changes a site's pricing behaviour
// on its own. Once a rate is set, an individual item still falls back to the
// flat figure if Amazon simply never published a weight or usable dimensions
// for it, rather than guessing or blocking the price entirely.
export function calculateShippingCostUSD(
  measurements: Measurements | null | undefined,
  settings: {
    shippingCostUSD: number;
    airRateUsdPerKg: number | null;
    airVolumetricDivisor: number;
    airMinimumChargeableKg: number;
  }
): ShippingCostResult {
  const flat: ShippingCostResult = { shippingCostUSD: settings.shippingCostUSD, basis: "flat_fallback", chargeableKg: null };
  if (!settings.airRateUsdPerKg || settings.airRateUsdPerKg <= 0 || !measurements) return flat;

  const haveWeight = typeof measurements.weightKg === "number" && measurements.weightKg > 0;
  const haveDims =
    typeof measurements.lengthIn === "number" && measurements.lengthIn > 0 &&
    typeof measurements.widthIn === "number" && measurements.widthIn > 0 &&
    typeof measurements.heightIn === "number" && measurements.heightIn > 0;
  if (!haveWeight && !haveDims) return flat;

  const volumetricKg = haveDims
    ? ((measurements.lengthIn as number) * (measurements.widthIn as number) * (measurements.heightIn as number)) / settings.airVolumetricDivisor
    : null;
  const actualKg = haveWeight ? (measurements.weightKg as number) : 0;
  const chargeableKg = Math.max(actualKg, volumetricKg ?? 0, settings.airMinimumChargeableKg);
  const basis: ShippingCostResult["basis"] = (volumetricKg ?? 0) >= actualKg ? "volumetric_weight" : "actual_weight";

  return { shippingCostUSD: chargeableKg * settings.airRateUsdPerKg, basis, chargeableKg };
}
