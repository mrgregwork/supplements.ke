/**
 * Product-specific FAQ generator.
 *
 * Selects 4 questions per product from a pool of 25+ category-aware generators.
 * Selection is deterministic but varies by product: a DJB2 hash of the slug drives
 * which questions appear and in what order, so each product gets a distinct FAQ set
 * without any obvious rotation pattern.
 */

export interface ProductForFaq {
  name: string;
  slug: string;
  brand?: string | null;
  price: number;
  currency?: string | null;
  originalPrice?: number | null;
  attributes?: Array<{ name: string; value: string }> | null;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
}

export interface FaqContext {
  displayPrice: string;
  originalPriceDisplay?: string | null;
  discount?: number | null;
  returnDays: number;
  targetRegion: string;
}

export interface Faq {
  question: string;
  answer: string;
}

// ─── hash ─────────────────────────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0); // unsigned 32-bit
}

// Derive a child seed from a parent seed + a constant — used to get independent
// random streams for each selection group without repeating the same index.
function derive(seed: number, constant: number): number {
  return (Math.imul(seed ^ (seed >>> 16), constant) >>> 0);
}

// Pick one element from arr using seed
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function attrValue(attrs: Array<{ name: string; value: string }>, ...keys: string[]): string | null {
  const lower = keys.map(k => k.toLowerCase());
  const match = attrs.find(a => lower.some(k => a.name.toLowerCase().includes(k)));
  return match?.value ?? null;
}

function hasAttr(attrs: Array<{ name: string; value: string }>, ...keys: string[]): boolean {
  return attrValue(attrs, ...keys) !== null;
}

type Cat = { cat?: string | null; sub?: string | null };

function inCat({ cat, sub }: Cat, ...slugs: string[]): boolean {
  const all = [cat, sub].filter(Boolean).join('/');
  return slugs.some(s => all.includes(s));
}

function isFatSoluble(p: ProductForFaq): boolean {
  return inCat(
    { cat: p.categorySlug, sub: p.subcategorySlug },
    'vitamin-d', 'vitamin-k', 'vitamin-e', 'omega', 'krill', 'fish-oil', 'collagen'
  ) || (p.name?.toLowerCase().includes('softgel') ?? false);
}

function isProbiotic(p: ProductForFaq): boolean {
  return inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'probiotic', 'prebiotic');
}

function isSoftgel(p: ProductForFaq): boolean {
  const n = p.name?.toLowerCase() ?? '';
  return n.includes('softgel') || n.includes('soft gel') || inCat(
    { cat: p.categorySlug, sub: p.subcategorySlug },
    'omega', 'krill', 'fish-oil'
  );
}

function isCollagen(p: ProductForFaq): boolean {
  return inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'collagen')
    || (p.name?.toLowerCase().includes('collagen') ?? false);
}

function isOmega(p: ProductForFaq): boolean {
  return inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'omega', 'krill', 'fish-oil');
}

function isJoint(p: ProductForFaq): boolean {
  return inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'bones-joints', 'bone-joint')
    || (p.name?.toLowerCase().includes('glucosamine') ?? false)
    || (p.name?.toLowerCase().includes('chondroitin') ?? false);
}

function isProtein(p: ProductForFaq): boolean {
  return inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'protein');
}

function isMagnesium(p: ProductForFaq): boolean {
  return (p.name?.toLowerCase().includes('magnesium') ?? false)
    || inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'magnesium');
}

function isIron(p: ProductForFaq): boolean {
  return (p.name?.toLowerCase().includes('iron') ?? false)
    || inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'iron');
}

function brandName(p: ProductForFaq): string {
  return p.brand ?? 'This brand';
}

function formWord(p: ProductForFaq): string {
  const n = p.name?.toLowerCase() ?? '';
  if (n.includes('softgel') || n.includes('soft gel')) return 'softgels';
  if (n.includes('tablet')) return 'tablets';
  if (n.includes('powder') || n.includes('grams') || n.includes('kg')) return 'powder';
  if (n.includes('gummy') || n.includes('gummies')) return 'gummies';
  if (n.includes('liquid') || n.includes('drops') || n.includes('ml')) return 'liquid';
  return 'capsules';
}

// ─── question generators ──────────────────────────────────────────────────────
// Each generator: { group, question(p, ctx), answer(p, ctx) }
// group: 'commercial' | 'usage' | 'ingredients' | 'quality' | 'outcomes'

type Generator = {
  group: 'commercial' | 'usage' | 'ingredients' | 'quality' | 'outcomes';
  q(p: ProductForFaq, ctx: FaqContext): string;
  a(p: ProductForFaq, ctx: FaqContext): string;
};

const GENERATORS: Generator[] = [

  // ── COMMERCIAL (4 options) ──────────────────────────────────────────────────

  {
    group: 'commercial',
    q: (p) => `How much does ${p.name} cost in ${String(p.categorySlug ?? '').includes('kenya') ? 'Nairobi' : 'Kenya'}?`,
    a: (p, ctx) => {
      const base = `${p.name} is available from Supplements Kenya for ${ctx.displayPrice}.`;
      const saving = ctx.discount ? ` That's ${ctx.discount}% off the regular price of ${ctx.originalPriceDisplay}.` : '';
      return `${base}${saving} All orders come with fast delivery across Kenya and no hidden fees.`;
    },
  },
  {
    group: 'commercial',
    q: (p) => `Where can I buy ${p.name} in Kenya?`,
    a: (p, ctx) => `You can order ${p.name} directly from Supplements Kenya at ${ctx.displayPrice} with delivery to Nairobi, Mombasa, and across the country. We stock only authentic, sealed inventory imported directly from the brand.`,
  },
  {
    group: 'commercial',
    q: (p) => `Is the ${p.name} sold by Supplements Kenya genuine?`,
    a: (p) => `Yes. Supplements Kenya sources all ${brandName(p)} products directly and stocks only verified, sealed inventory. We do not carry grey-market or repackaged goods.`,
  },
  {
    group: 'commercial',
    q: (p, ctx) => `What is the return policy for ${p.name}?`,
    a: (p, ctx) => `We offer a ${ctx.returnDays}-day return window on unopened ${p.name} in original sealed packaging. If you receive a damaged or incorrect item, contact us within 48 hours of delivery and we will resolve it promptly.`,
  },

  // ── USAGE (7 options) ───────────────────────────────────────────────────────

  {
    group: 'usage',
    q: (p) => `When is the best time to take ${p.name}?`,
    a: (p) => {
      if (isFatSoluble(p))
        return `${p.name} contains fat-soluble nutrients, so taking it with a meal that includes some fat gives the best absorption. Morning or evening with your largest meal both work well.`;
      if (isProbiotic(p))
        return `${p.name} can be taken with or without food. Many practitioners recommend taking it 20–30 minutes before a meal or first thing in the morning on an empty stomach, when stomach acid is lowest.`;
      if (isMagnesium(p))
        return `${p.name} can be taken at any time of day, but many people prefer the evening. Magnesium supports muscle relaxation and may help with sleep quality when taken 1–2 hours before bed.`;
      if (isJoint(p))
        return `${p.name} can be taken at any time with or without food. Splitting the daily dose between morning and evening maintains more consistent blood levels of the active compounds.`;
      if (isProtein(p))
        return `${p.name} is most commonly taken within 30–60 minutes after exercise to support muscle recovery. It can also be used as a protein supplement at any time of day.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'sleep', 'theanine'))
        return `${p.name} is most effective when taken 30–60 minutes before bed. It can also be used during the day for calm focus, particularly alongside caffeine.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'vitamin-b', 'energy'))
        return `${p.name} is best taken in the morning with breakfast. B vitamins and energy-supporting nutrients can be stimulating, and taking them earlier in the day avoids any potential interference with sleep.`;
      return `${p.name} can be taken at any time of day, with or without food, unless the label specifies otherwise. Consistency matters more than timing for most daily supplements.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `Should I take ${p.name} with food?`,
    a: (p) => {
      if (isFatSoluble(p))
        return `Yes — ${p.name} contains fat-soluble compounds that are significantly better absorbed when taken with a fat-containing meal. Even a small amount of dietary fat (a handful of nuts, a drizzle of olive oil) is sufficient.`;
      if (isIron(p))
        return `For maximum absorption, ${p.name} is best taken on an empty stomach or with a source of vitamin C. Avoid taking it within two hours of dairy products, calcium supplements, or antacids, which can reduce iron absorption.`;
      if (isProbiotic(p))
        return `${p.name} can be taken with or without food. If you experience any digestive discomfort, taking it with a meal may help.`;
      return `${p.name} can be taken with or without food. If you notice any digestive sensitivity, taking it alongside a meal will usually resolve this.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `How many ${formWord(p)} is one serving of ${p.name}?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      const serving = attrValue(attrs, 'serving size', 'serving', 'dose');
      if (serving) return `One serving of ${p.name} is ${serving}. Follow the label directions for the dose that matches your needs, and consult a healthcare professional if you are unsure about the right amount for your situation.`;
      const form = formWord(p);
      return `Check the label on your bottle of ${p.name} for the exact serving size. Most ${form === 'capsules' ? 'capsule-based' : form} supplements range from one to three ${form} per serving. Do not exceed the stated dose without medical advice.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `Can I take ${p.name} every day long-term?`,
    a: (p) => {
      if (isCollagen(p))
        return `Yes — collagen supplements like ${p.name} are intended for consistent daily use. Benefits to skin, joints, and connective tissue are typically seen after 4–8 weeks and build with continued use.`;
      if (isOmega(p))
        return `Yes — omega-3 supplements like ${p.name} are designed for daily long-term use. The cardiovascular and cognitive benefits studied in clinical research emerge from months of consistent supplementation, not short courses.`;
      if (isJoint(p))
        return `Yes — ${p.name} is designed for sustained daily use. Joint supplements typically need 8–12 weeks of consistent intake before noticeable effects on comfort and flexibility develop.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'adaptogen', 'ashwagandha'))
        return `${p.name} is generally considered safe for long-term daily use at the recommended dose. Adaptogens are traditionally taken in sustained cycles. If you use it continuously for more than three months, a periodic break of 2–4 weeks is sometimes recommended.`;
      return `${p.name} is formulated for daily use at the label dose. For supplements intended as ongoing nutritional support, consistent daily use is the norm. If you have any underlying health conditions or take prescription medication, check with your doctor before starting.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `Can I take ${p.name} alongside other supplements?`,
    a: (p) => {
      if (isMagnesium(p))
        return `${p.name} stacks well with vitamin D3, vitamin K2, and calcium. Avoid taking magnesium at the same time as iron or zinc supplements, as they can compete for absorption — separate them by 2 hours.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'vitamin-d'))
        return `Vitamin D3 from ${p.name} works synergistically with vitamin K2, which helps direct calcium to the right places in the body. Magnesium is also needed for vitamin D metabolism. These three are commonly taken together.`;
      if (isIron(p))
        return `Take ${p.name} separately from calcium, zinc, or magnesium supplements — all of these compete with iron for intestinal absorption. Vitamin C (taken together) significantly enhances iron absorption.`;
      if (isOmega(p))
        return `${p.name} combines well with most daily supplements. Omega-3 fatty acids are complementary to vitamin D, magnesium, and CoQ10. Be cautious if you are taking blood-thinning medications and consult your doctor before adding high-dose omega-3 to that regimen.`;
      return `${p.name} is generally compatible with a standard daily supplement routine. If you take prescription medications, check with your pharmacist before adding any new supplement — a small number of nutrients interact with common drugs such as blood thinners and thyroid medication.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `Is ${p.name} suitable for adults over 50?`,
    a: (p) => {
      if (isJoint(p))
        return `${p.name} is frequently used by adults over 50 specifically because age-related cartilage wear is the most common context for glucosamine and chondroitin research. It is safe for long-term use in healthy adults and the clinical trials include participants across a wide age range.`;
      if (isCollagen(p))
        return `Yes — natural collagen production declines significantly from the mid-30s onward, so ${p.name} is particularly relevant for adults over 50 who are looking to support skin elasticity, joint comfort, and connective tissue health.`;
      if (isMagnesium(p))
        return `Yes — adults over 50 actually have higher rates of dietary magnesium insufficiency than younger adults, making ${p.name} particularly relevant for this group. Magnesium also supports bone density and cardiovascular health, which are priority areas as we age.`;
      return `${p.name} is suitable for healthy adults of all ages at the recommended dose. Adults over 50 should review the serving size against any prescription medications they take, as some supplements can interact with heart, blood pressure, or blood-thinning drugs commonly prescribed in this age group.`;
    },
  },
  {
    group: 'usage',
    q: (p) => `How do I know how many ${formWord(p)} of ${p.name} to take?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      const serving = attrValue(attrs, 'serving size', 'serving', 'dose', 'recommended');
      if (serving) return `The label recommends ${serving} per day. This dose is consistent with the clinical research behind ${p.name}. Some people adjust up or down within the label range based on personal tolerance — start at the lower end if you are new to this type of supplement.`;
      return `Follow the serving suggestion on the label of ${p.name}. If you are new to this supplement category, start at the lower end of the dose range for the first week to assess tolerance before increasing to the full recommended amount.`;
    },
  },

  // ── INGREDIENTS (8 options) ─────────────────────────────────────────────────

  {
    group: 'ingredients',
    q: (p) => `How many ${formWord(p)} are in one bottle of ${p.name}?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      const count = attrValue(attrs, 'count', 'capsules', 'tablets', 'softgels', 'servings per container', 'quantity');
      const serving = attrValue(attrs, 'serving size');
      if (count && serving) return `Each bottle of ${p.name} contains ${count} ${formWord(p)}, with a serving size of ${serving}. That makes it a ${Math.round(parseInt(count) / parseInt(serving))} day supply at the recommended dose.`;
      if (count) return `Each bottle of ${p.name} contains ${count} ${formWord(p)}.`;
      return `Check the label on your bottle of ${p.name} for the exact count. The number of ${formWord(p)} and the serving size together determine how long each bottle will last.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `What is the key active ingredient in ${p.name}?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      if (attrs.length > 0) {
        const top = attrs.slice(0, 2).map(a => `${a.name} (${a.value})`).join(' and ');
        return `The primary active ingredients in ${p.name} are ${top}. These are the compounds responsible for the supplement's core benefits and are the ones backed by the research behind this product category.`;
      }
      const n = p.name.toLowerCase();
      if (n.includes('vitamin d')) return `The active ingredient in ${p.name} is cholecalciferol — vitamin D3, the same form your skin produces from sunlight exposure and the most bioavailable form for raising serum 25-hydroxyvitamin D levels.`;
      if (n.includes('vitamin c')) return `The active ingredient in ${p.name} is ascorbic acid — vitamin C — one of the most well-researched water-soluble antioxidants and immune nutrients.`;
      if (n.includes('magnesium')) return `The active ingredient in ${p.name} is elemental magnesium. The specific salt form used determines bioavailability — check the label for whether it uses citrate, glycinate, malate, or another form.`;
      if (n.includes('collagen')) return `The active ingredient in ${p.name} is hydrolysed collagen peptides — short-chain amino acid sequences derived from collagen protein that are small enough to be absorbed intact from the gut.`;
      if (n.includes('omega') || n.includes('fish oil') || n.includes('krill')) return `The active ingredients in ${p.name} are EPA and DHA — the long-chain omega-3 fatty acids most studied for cardiovascular, brain, and anti-inflammatory benefits.`;
      return `The active ingredients in ${p.name} are listed on the supplement facts panel on the label. These are the compounds studied for this product's health benefits.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `Does ${p.name} contain any artificial additives?`,
    a: (p) => {
      if (p.brand === 'Jarrow Formulas')
        return `Jarrow Formulas products, including ${p.name}, are formulated without artificial colours, flavours, or sweeteners. The brand focuses on clean, functional formulations without unnecessary excipients.`;
      if (p.brand === 'Life Extension')
        return `Life Extension formulates ${p.name} without artificial colours or sweeteners. Their products are non-GMO and produced in NSF GMP-registered facilities.`;
      if (p.brand === 'Vital Proteins')
        return `Vital Proteins products are typically free from artificial additives and use minimal, clean ingredient lists. Check the label of your specific ${p.name} product for the full excipient breakdown.`;
      return `${brandName(p)} designs ${p.name} to minimise unnecessary additives. Check the full ingredient list on the label for excipients such as magnesium stearate, silicon dioxide, or modified cellulose — these are common and generally inert processing aids.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `What form of ${isCollagen(p) ? 'collagen' : isOmega(p) ? 'omega-3' : isMagnesium(p) ? 'magnesium' : 'the key nutrient'} does ${p.name} use?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      if (attrs.length > 0) {
        const first = attrs[0];
        return `${p.name} uses ${first.value} of ${first.name}. The specific form matters because different chemical forms of the same nutrient can vary significantly in how well the body absorbs and uses them.`;
      }
      if (isCollagen(p)) {
        const n = p.name.toLowerCase();
        if (n.includes('marine')) return `${p.name} uses marine collagen, typically derived from fish skin and scales. Marine collagen is predominantly Type I collagen — the form found in skin, tendons, and bones.`;
        if (n.includes('type ii') || n.includes('type 2')) return `${p.name} uses Type II collagen, which is the primary collagen found in cartilage. This is a different application from the Type I collagen in most skin and joint powders.`;
        return `${p.name} uses hydrolysed collagen peptides, meaning the collagen protein has been broken down into shorter chains for easier absorption in the gut.`;
      }
      if (isMagnesium(p)) {
        const n = p.name.toLowerCase();
        if (n.includes('glycinate') || n.includes('bisglycinate')) return `${p.name} uses magnesium glycinate (bisglycinate) — one of the most bioavailable forms of magnesium and the gentlest on the digestive system. It is the preferred form for people who have experienced loose stools from oxide-based magnesium.`;
        if (n.includes('citrate')) return `${p.name} uses magnesium citrate, which has significantly better absorption than the cheaper magnesium oxide found in many budget supplements. It is well-tolerated and effective at modest doses.`;
        if (n.includes('malate')) return `${p.name} uses magnesium malate, where the mineral is bound to malic acid. This form is particularly associated with energy metabolism and is popular for muscle fatigue and fibromyalgia support.`;
        return `The specific magnesium form in ${p.name} is shown on the supplement facts label. Bioavailability varies significantly by form — citrate, glycinate, and malate are generally better absorbed than oxide.`;
      }
      return `The specific form of the active ingredient in ${p.name} is printed on the supplement facts panel. High-quality supplements use ingredient forms selected for superior bioavailability over cheaper alternatives.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => isOmega(p)
      ? `Where is the ${p.name.toLowerCase().includes('krill') ? 'krill' : 'fish'} in ${p.name} sourced from?`
      : isCollagen(p)
        ? `What is the source of the collagen in ${p.name}?`
        : `Where does ${brandName(p)} source the ingredients in ${p.name}?`,
    a: (p) => {
      if (isOmega(p)) {
        if (p.name.toLowerCase().includes('krill'))
          return `${p.name} uses krill harvested from Antarctic waters. Antarctic krill (Euphausia superba) is subject to some of the most rigorously managed fisheries quotas in the world under the CCAMLR convention, making it a sustainable omega-3 source.`;
        if (p.brand === 'Jarrow Formulas')
          return `Jarrow Formulas sources the fish oil in ${p.name} from cold-water fish such as anchovy and sardine, typically from South American Pacific waters. These small pelagic fish are lower on the food chain, which means lower heavy metal accumulation than large predatory fish.`;
        return `${p.name} uses concentrated fish oil from cold-water marine fish. Reputable omega-3 manufacturers routinely test for PCBs, mercury, and other contaminants — check the brand's Certificate of Analysis for current batch results.`;
      }
      if (isCollagen(p)) {
        const n = p.name.toLowerCase();
        if (n.includes('marine')) return `The collagen in ${p.name} is marine-sourced, typically from the skin and scales of freshwater or ocean fish. Marine collagen is predominantly Type I and has a slightly smaller peptide size than bovine collagen, which may support absorption.`;
        return `The collagen in ${p.name} is most commonly bovine (cattle-derived), specifically from hides, which are rich in Type I and Type III collagen. Some brands also produce porcine or marine variants — check the label if sourcing is a concern for you.`;
      }
      return `${brandName(p)} is subject to supplier qualification requirements and GMP standards that mandate ingredient identity and purity testing. Specific sourcing information for ${p.name} is available on the brand's website or from their customer service.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `Does ${p.name} contain shellfish, gluten, or other common allergens?`,
    a: (p) => {
      const n = p.name.toLowerCase();
      if (n.includes('krill'))
        return `${p.name} is derived from krill, a crustacean, and should not be taken by anyone with a shellfish allergy. It does not contain gluten or dairy.`;
      if (n.includes('glucosamine'))
        return `Glucosamine in ${p.name} is typically derived from shellfish (shrimp or crab shells). If you have a shellfish allergy, check the label for a shellfish-free version made from corn or fungal fermentation. The chondroitin component is bovine-derived.`;
      if (p.brand === 'Jarrow Formulas')
        return `Jarrow Formulas produces ${p.name} free from gluten, wheat, and soy. The product does not contain artificial colours or preservatives. If shellfish or tree nut allergies are a concern, check the specific supplement facts panel as a few Jarrow products contain these ingredients.`;
      return `Check the allergen statement on the ${p.name} label for the most accurate information. The product may be manufactured in a facility that also processes tree nuts, soy, dairy, or shellfish — the label will indicate if this applies.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `Does ${p.name} need to be refrigerated?`,
    a: (p) => {
      if (isProbiotic(p))
        return `${p.name} is best refrigerated after opening to maintain the highest viable CFU count through to the end of the bottle. Most Jarrow Formulas probiotic products are shelf-stable for up to three weeks at room temperature, but for extended potency, keep them in the refrigerator.`;
      if (isOmega(p))
        return `${p.name} does not require refrigeration, but storing it away from heat and direct sunlight will help preserve the omega-3 fatty acids. Once opened, keeping it in a cool cupboard or the refrigerator extends freshness and minimises oxidation.`;
      return `${p.name} should be stored in a cool, dry place away from direct sunlight. Unless the label specifically states refrigeration is required, room-temperature storage in a cupboard or drawer is fine. Do not store in the bathroom, where heat and humidity can degrade quality.`;
    },
  },
  {
    group: 'ingredients',
    q: (p) => `How much ${isMagnesium(p) ? 'elemental magnesium' : isCollagen(p) ? 'collagen' : 'active compound'} does each serving of ${p.name} provide?`,
    a: (p) => {
      const attrs = p.attributes ?? [];
      if (attrs.length > 0) {
        const first = attrs[0];
        return `Each serving of ${p.name} provides ${first.value} of ${first.name}. This dose reflects the levels used in the published research on this ingredient.`;
      }
      if (isMagnesium(p))
        return `The elemental magnesium content per serving of ${p.name} is listed on the supplement facts panel. Elemental magnesium (the actual mineral) is what matters — not the weight of the magnesium salt used. The RDA for magnesium is 310–420 mg per day depending on age and sex.`;
      if (isCollagen(p))
        return `The collagen peptide dose in ${p.name} is shown on the supplement facts panel. Human trials on collagen for skin and joint benefits have typically used 2.5 to 10 grams per day of hydrolysed peptides.`;
      return `The amount of active compound per serving of ${p.name} is listed on the supplement facts panel on the label. The dose is the key number to compare against the clinical research when assessing whether a supplement is likely to be effective.`;
    },
  },

  // ── QUALITY (5 options) ─────────────────────────────────────────────────────

  {
    group: 'quality',
    q: (p) => `Is ${p.name} third-party tested for purity and potency?`,
    a: (p) => {
      if (p.brand === 'Jarrow Formulas')
        return `Jarrow Formulas manufactures in GMP-certified facilities and conducts third-party identity and purity testing on raw materials and finished products. ${p.name} is produced under the same quality standards applied across the Jarrow range.`;
      if (p.brand === 'Life Extension')
        return `Life Extension produces ${p.name} in NSF GMP-registered facilities. The brand is one of the more transparent in the industry on ingredient sourcing and testing documentation.`;
      if (p.brand === 'Nature Made')
        return `Nature Made is USP Verified on many of its products, including ${p.name}. USP Verification is a voluntary programme that confirms what is on the label matches what is in the bottle, and that contaminant levels meet acceptable limits.`;
      if (p.brand === 'Nutricost')
        return `Nutricost products, including ${p.name}, are manufactured in GMP-certified facilities and third-party tested. The brand typically provides Certificates of Analysis on request.`;
      if (p.brand === 'Sports Research')
        return `Sports Research products are non-GMO Project verified and manufactured in GMP-certified facilities. Many products in the range carry additional certifications — check the ${p.name} label for current accreditations.`;
      return `${brandName(p)} products are required to meet GMP (Good Manufacturing Practice) standards. For the most current certification and testing documentation on ${p.name}, check the brand's website or contact Supplements Kenya, who can provide available batch documentation.`;
    },
  },
  {
    group: 'quality',
    q: (p) => `Is ${p.name} non-GMO?`,
    a: (p) => {
      if (p.brand === 'Jarrow Formulas')
        return `Jarrow Formulas states that ${p.name} is manufactured from non-GMO ingredients. The brand maintains a non-GMO position across its product range.`;
      if (p.brand === 'Life Extension')
        return `Life Extension formulates ${p.name} as non-GMO. The brand publishes detailed product information including ingredient sourcing and GMO status.`;
      if (p.brand === 'Sports Research')
        return `${p.name} by Sports Research is non-GMO Project verified — independently certified rather than just self-declared, which is a meaningful distinction.`;
      return `Check the label on your ${p.name} for the non-GMO status. Many reputable supplement brands state non-GMO on the label; if it is not stated, you can contact the brand directly for confirmation.`;
    },
  },
  {
    group: 'quality',
    q: (p) => `Is ${p.name} suitable for vegetarians?`,
    a: (p) => {
      if (isCollagen(p))
        return `No — collagen is derived from animal tissue, so ${p.name} is not suitable for vegetarians or vegans. There is currently no plant-based equivalent of collagen peptides, though plant-based supplements that support the body's own collagen production (vitamin C, silica) exist as alternatives.`;
      if (isOmega(p))
        return `Standard fish oil and krill oil products, including ${p.name}, are not suitable for vegetarians. Algae-based omega-3 supplements (which contain the same EPA and DHA) are the plant-based alternative.`;
      if (isSoftgel(p))
        return `The softgel capsule in ${p.name} contains gelatin, which is animal-derived, making it unsuitable for vegetarians. The formula itself contains no other animal-derived ingredients. A vegetarian capsule version may be available from this brand.`;
      if (p.brand === 'Jarrow Formulas')
        return `Yes — ${p.name} uses vegetarian capsules and contains no animal-derived ingredients in either the formula or the capsule shell, unless the label specifies otherwise.`;
      return `Check the supplement facts and other ingredients panel on your ${p.name} label. Capsule type is the most common source of non-vegetarian ingredients in supplements — gelatin capsules are animal-derived, while hypromellose (HPMC) capsules are plant-based.`;
    },
  },
  {
    group: 'quality',
    q: (p) => `Is ${p.name} manufactured in a GMP-certified facility?`,
    a: (p) => {
      if (p.brand === 'Jarrow Formulas' || p.brand === 'Life Extension' || p.brand === 'Nature Made' || p.brand === 'Nutricost' || p.brand === 'Sports Research' || p.brand === 'Vital Proteins')
        return `Yes — ${brandName(p)} manufactures ${p.name} in facilities certified to GMP (Good Manufacturing Practice) standards, which are the minimum quality requirements for supplement production regulated in the US and the EU.`;
      return `${brandName(p)} products are sold in the US market, which requires GMP compliance for all dietary supplements under FDA regulations. Supplements Kenya only stocks brands that can demonstrate GMP-compliant manufacturing.`;
    },
  },
  {
    group: 'quality',
    q: (p) => `Is ${p.name} free from common allergens like soy and dairy?`,
    a: (p) => {
      if (p.brand === 'Jarrow Formulas')
        return `Jarrow Formulas produces ${p.name} free from soy and dairy in the formula itself. Products are manufactured in a facility that may process other allergens; check the label for the allergen cross-contact statement if you have severe allergies.`;
      if (p.brand === 'Life Extension')
        return `Life Extension formulates ${p.name} as soy-free and dairy-free. The brand provides detailed ingredient and allergen information on its product labels and website.`;
      return `The allergen status of ${p.name} is shown on the label. Soy and dairy are not typical supplement ingredients, but they occasionally appear in flavoured or protein-containing products. The most reliable check is always the "Other Ingredients" section of the supplement facts panel.`;
    },
  },

  // ── OUTCOMES (6 options) ────────────────────────────────────────────────────

  {
    group: 'outcomes',
    q: (p) => `How long before I notice results from ${p.name}?`,
    a: (p) => {
      if (isJoint(p))
        return `Clinical trials on glucosamine and chondroitin run for 12–24 weeks, and most participants report meaningful changes in joint comfort and flexibility after 8–12 weeks of consistent daily use. ${p.name} is a maintenance supplement; results develop gradually and require sustained intake.`;
      if (isCollagen(p))
        return `Skin and hair benefits from collagen supplementation are typically first noticed after 4–8 weeks of daily use. Joint benefits can take longer — 8–12 weeks is common. Effects from ${p.name} build with consistent, long-term intake and are not immediate.`;
      if (isProbiotic(p))
        return `Gut microbiome changes from probiotic supplementation can be measurable within 1–2 weeks. Digestive comfort improvements are often noticed within the first 2–4 weeks of taking ${p.name} consistently. Immune effects and other systemic benefits typically require longer supplementation.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'sleep'))
        return `${p.name} supports sleep quality through calming pathways that tend to be noticeable within a few days to a week of consistent evening use. Unlike pharmaceutical sleep aids, effects are typically subtle and cumulative rather than immediate sedation.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'vitamin-d'))
        return `Blood 25-hydroxyvitamin D levels typically rise measurably within 4–8 weeks of consistent daily supplementation with ${p.name}. Symptom-level improvements (energy, mood, immune function) may lag slightly behind lab values.`;
      if (isOmega(p))
        return `Blood omega-3 index levels increase meaningfully after 4–8 weeks of consistent daily supplementation with ${p.name}. The cardiovascular, brain, and anti-inflammatory benefits studied in long-term trials reflect months of sustained use.`;
      return `Most nutritional supplements from ${p.name}'s category require consistent daily use for 4–8 weeks before changes are noticeable. Supplement benefits are generally slow and cumulative — they reflect nutritional status correction and physiological adaptation rather than acute pharmacological effects.`;
    },
  },
  {
    group: 'outcomes',
    q: (p) => `Who is ${p.name} most suitable for?`,
    a: (p) => {
      if (isJoint(p))
        return `${p.name} is most commonly used by adults experiencing age-related joint stiffness, reduced flexibility in the knees, hips, or hands, and active individuals who want to support joint durability over time. Clinical trials have shown the most pronounced benefits in people with moderate cartilage wear rather than severe structural damage.`;
      if (isCollagen(p))
        return `${p.name} is well suited to adults over 30, when natural collagen synthesis begins to decline, and particularly over 50. It is commonly used by people interested in supporting skin elasticity, joint comfort, and connective tissue health. Athletes also use collagen peptides for tendon and ligament support.`;
      if (isProbiotic(p))
        return `${p.name} is suitable for adults looking to support digestive health, gut microbiome diversity, or immune function. It is particularly useful after a course of antibiotics (which deplete gut flora), during travel, and for people with irregular digestion or IBS symptoms.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'brain', 'memory', 'cognitive'))
        return `${p.name} is most suitable for students, professionals with cognitively demanding workloads, and adults over 40 who are proactively supporting brain health. It is also used in nootropic stacks for focus and attention.`;
      if (isOmega(p))
        return `${p.name} is suitable for most adults, and particularly valuable for people whose diet includes little or no fatty fish (salmon, mackerel, sardines, herring). Adults with cardiovascular risk factors, people in cognitively demanding roles, and those over 40 are the most common primary users.`;
      return `${p.name} is formulated for adult use and is suitable for most healthy individuals looking to supplement this specific nutrient category. People with chronic conditions, those who are pregnant or breastfeeding, and anyone on regular prescription medication should check with their healthcare provider before starting.`;
    },
  },
  {
    group: 'outcomes',
    q: (p) => `What health goals does ${p.name} primarily support?`,
    a: (p) => {
      const sub = p.subcategorySlug ?? '';
      const cat = p.categorySlug ?? '';
      if (cat.includes('collagen')) return `${p.name} primarily supports skin elasticity and hydration, joint flexibility and cartilage integrity, hair and nail strength, and connective tissue throughout the body.`;
      if (cat.includes('omega') || sub.includes('krill') || sub.includes('fish-oil')) return `${p.name} primarily supports cardiovascular health (triglyceride balance, arterial flexibility), brain function and cognitive performance, and a healthy inflammatory response.`;
      if (cat.includes('probiotics')) return `${p.name} primarily supports digestive comfort, gut microbiome diversity, immune function, and — for women's formulas — vaginal and urinary tract flora balance.`;
      if (sub.includes('brain') || sub.includes('memory') || sub.includes('cognitive')) return `${p.name} primarily supports memory, focus, mental energy, and long-term brain health. It is often used as part of a broader nootropic routine.`;
      if (cat.includes('weight-management')) return `${p.name} supports body composition goals by targeting ${sub.includes('appetite') ? 'appetite regulation and satiety signalling' : sub.includes('metabolism') ? 'metabolic rate and fat oxidation' : 'weight management as part of a calorie-appropriate diet and exercise routine'}.`;
      if (sub.includes('immunity') || sub.includes('immune')) return `${p.name} primarily supports immune system function, particularly innate immune defence against seasonal illness and oxidative stress.`;
      if (sub.includes('sleep')) return `${p.name} supports sleep onset, sleep quality, and healthy sleep architecture without the residual grogginess associated with pharmaceutical sleep aids.`;
      return `${p.name} is designed to support ${cat.replace(/-/g, ' ')} — specifically the ${sub.replace(/-/g, ' ')} dimension. The specific health goals addressed are reflected in the choice of ingredients and their studied doses.`;
    },
  },
  {
    group: 'outcomes',
    q: (p) => `Is ${p.name} effective for athletes and active people?`,
    a: (p) => {
      if (isCollagen(p))
        return `Yes — athletes use ${p.name} to support tendon, ligament, and cartilage integrity under high-repetition and high-load training. Some sports medicine researchers recommend taking collagen peptides with vitamin C 30–60 minutes before training to support connective tissue synthesis during the post-exercise repair window.`;
      if (isOmega(p))
        return `Omega-3 supplements like ${p.name} are widely used in athletic populations for their role in reducing exercise-induced inflammation, supporting faster muscle recovery between sessions, and maintaining joint mobility under training stress.`;
      if (isJoint(p))
        return `${p.name} is relevant for athletes experiencing joint wear from high-impact sports, repetitive loading, or competition volume. It is a long-term support supplement — benefits are structural and develop over weeks to months of consistent use.`;
      if (isProtein(p))
        return `${p.name} is specifically designed for athletes and active individuals. Protein supplementation post-exercise supports muscle protein synthesis, reduces muscle soreness, and helps maintain lean mass during caloric restriction.`;
      return `${p.name} can be part of a supplement routine for active individuals. Athletes generally have higher micronutrient and nutritional demands than sedentary adults, so ensuring adequate intake of the nutrients in ${p.name} is particularly relevant for those training regularly.`;
    },
  },
  {
    group: 'outcomes',
    q: (p) => `Can ${p.name} help with energy levels?`,
    a: (p) => {
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'energy', 'vitamin-b', 'b12'))
        return `Yes — ${p.name} is formulated specifically to support energy metabolism. B vitamins, CoQ10, iron, and certain amino acids play direct roles in cellular energy production. Correcting a deficiency in any of these can produce a noticeable improvement in fatigue and vitality.`;
      if (isMagnesium(p))
        return `Magnesium plays a role in over 300 enzymatic reactions, including the production of ATP — the cellular energy currency. Low magnesium is associated with fatigue, and correcting a deficit with ${p.name} can support energy levels, particularly in people with high stress or exercise loads.`;
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'vitamin-d'))
        return `Vitamin D deficiency is closely associated with fatigue and low energy. If deficiency is contributing to your symptoms, correcting it with ${p.name} can lead to noticeable improvements in energy, mood, and overall vitality over several weeks.`;
      return `${p.name} is not a stimulant and does not produce a direct energy boost. However, nutritional supplements that correct deficiencies, support mitochondrial function, or reduce inflammation can support overall vitality and reduce fatigue as secondary effects of improved nutritional status.`;
    },
  },
  {
    group: 'outcomes',
    q: (p) => `Does ${p.name} support immune function?`,
    a: (p) => {
      if (inCat({ cat: p.categorySlug, sub: p.subcategorySlug }, 'vitamin-c', 'vitamin-d', 'zinc', 'immunity'))
        return `Yes — ${p.name} is directly formulated for immune support. ${p.name.toLowerCase().includes('vitamin c') ? 'Vitamin C' : p.name.toLowerCase().includes('vitamin d') ? 'Vitamin D' : p.name.toLowerCase().includes('zinc') ? 'Zinc' : 'The key nutrients in this product'} are among the most researched nutrients for immune system function.`;
      if (isProbiotic(p))
        return `Yes — gut microbiome health has a direct relationship with immune function. Approximately 70% of immune tissue is located in and around the gut, and ${p.name} supports the microbial environment that modulates immune responses.`;
      if (isOmega(p))
        return `Omega-3 fatty acids from ${p.name} help regulate the body's inflammatory response, which underpins healthy immune function. They don't act as direct immune stimulants, but a well-regulated inflammatory baseline supports more effective immune responses.`;
      return `${p.name} is not primarily an immune supplement, but adequate nutrition across vitamins, minerals, and essential fatty acids supports the immune system as a foundation. If immune support is your primary goal, the most evidence-backed options are vitamin C, vitamin D, zinc, and probiotics.`;
    },
  },
];

// ─── selection algorithm ──────────────────────────────────────────────────────

const GROUP_PRIMES: Record<Generator['group'], number> = {
  commercial:  0x9e3779b9,
  usage:       0x6c62272e,
  ingredients: 0xc2b2ae35,
  quality:     0x27d4eb2f,
  outcomes:    0x165667b1,
};

// 6 different orderings of [commercial, usage, ingredients, quality/outcomes]
// so that FAQ section structure varies across products
const QUESTION_ORDERS = [
  ['commercial', 'usage', 'ingredients', 'quality'],
  ['usage', 'ingredients', 'commercial', 'outcomes'],
  ['ingredients', 'commercial', 'outcomes', 'usage'],
  ['usage', 'outcomes', 'commercial', 'ingredients'],
  ['commercial', 'ingredients', 'usage', 'outcomes'],
  ['outcomes', 'commercial', 'usage', 'ingredients'],
] as const;

export function generateProductFaqs(
  product: ProductForFaq,
  context: FaqContext,
): Faq[] {
  const h = djb2(product.slug);

  // Decide which 4 groups to include (always 4, from the 5 available)
  // 'quality' and 'outcomes' alternate by hash so we don't always show the same mix
  const orderIndex = h % QUESTION_ORDERS.length;
  const groups = QUESTION_ORDERS[orderIndex];

  const faqs: Faq[] = [];

  for (const group of groups) {
    const pool = GENERATORS.filter(g => g.group === group);
    if (pool.length === 0) continue;
    const groupSeed = derive(h, GROUP_PRIMES[group]);
    const gen = pick(pool, groupSeed);
    faqs.push({
      question: gen.q(product, context),
      answer:   gen.a(product, context),
    });
  }

  return faqs;
}
