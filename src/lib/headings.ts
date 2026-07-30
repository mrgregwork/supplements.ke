/**
 * Canonical H1 wording for collection pages (categories and subcategories).
 *
 * This is the single source of truth for that wording, because the hub-and-spoke
 * internal links use the target page's H1 as their anchor text. Deriving both
 * from this function means an anchor can never drift out of sync with the
 * heading of the page it points at.
 *
 * The house style is "<thing> Supplements in Kenya", but applying that blindly
 * produces "Collagen supplements Supplements in Kenya" or "Proteins Supplements
 * in Kenya", so the rules below normalise the real collection names.
 */

const DEFAULT_REGION = 'Kenya';

/** Product formats read badly with "Supplements" bolted on ("Collagen Powder Supplements"). */
const FORM_TAIL = /\b(powders?|capsules?|tablets?|gummies|gummy|softgels?|bundles?|packs?|blends?)$/i;

/** Trailing "s" that is not a plural — Wellness, Focus, Analysis. */
const NOT_PLURAL = /(ss|us|is)$/i;

function isPlural(word: string): boolean {
  return /s$/i.test(word) && !NOT_PLURAL.test(word);
}

function singularise(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y');
  if (isPlural(word)) return word.replace(/s$/i, '');
  return word;
}

/**
 * Build the H1 for a collection.
 *
 * "Creatine"            -> "Creatine Supplements in Kenya"
 * "Protein"             -> "Protein Supplements in Kenya"
 * "Probiotics"          -> "Probiotic Supplements in Kenya"
 * "Collagen supplements"-> "Collagen Supplements in Kenya"   (not doubled)
 * "Supplement Gummies"  -> "Supplement Gummies in Kenya"     (not doubled)
 * "Men's Vitamins"      -> "Men's Vitamins in Kenya"         (plural head reads alone)
 * "Collagen Powder"     -> "Collagen Powder in Kenya"        (format, not an ingredient)
 * "Best Collagen for Skin" -> "Best Collagen for Skin in Kenya"
 */
export function collectionHeading(name: string, region: string = DEFAULT_REGION): string {
  const raw = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return `Supplements in ${region}`;

  const withRegion = (s: string) => `${s} in ${region}`;

  // Already contains "supplement(s)" — say it once, with consistent casing.
  if (/\bsupplements?\b/i.test(raw)) {
    return withRegion(
      raw
        .replace(/\bsupplements\b/gi, 'Supplements')
        .replace(/\bsupplement\b/gi, 'Supplement')
    );
  }

  // Qualified phrases ("Iron Support for Women") don't take a trailing noun.
  if (/\bfor\b/i.test(raw)) return withRegion(raw);

  // Formats stop at the region.
  if (FORM_TAIL.test(raw)) return withRegion(raw);

  const words = raw.split(' ');

  // Single ingredient — the case this wording exists for.
  if (words.length === 1) return withRegion(`${singularise(raw)} Supplements`);

  // "Mass Gainers", "Digestive Enzymes" — already a plural product noun.
  if (isPlural(words[words.length - 1])) return withRegion(raw);

  return withRegion(`${raw} Supplements`);
}
