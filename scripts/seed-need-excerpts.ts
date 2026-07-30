/**
 * Seeds the one-sentence, pain-to-solution card excerpts used by the
 * "browse by need" hub cards (currently /specialty-supplements/).
 *
 *   npx tsx scripts/seed-need-excerpts.ts          # fill only empty excerpts
 *   npx tsx scripts/seed-need-excerpts.ts --force  # overwrite existing ones
 *
 * Copy deliberately uses structure/function wording ("supports", "helps
 * maintain") and never claims to treat, cure or prevent disease.
 */
import "dotenv/config";
import { db } from "../server/db";
import { categories, subcategories } from "../shared/schema";
import { eq } from "drizzle-orm";

const FORCE = process.argv.includes("--force");

/**
 * Subcategory slugs are NOT unique across categories — "eye-health",
 * "heart-health" and "liver-support" each exist under both specialty-supplements
 * and health-goals. Matching on slug alone silently updates whichever row comes
 * last, so everything below is scoped to this category.
 */
const CATEGORY_SLUG = "specialty-supplements";

/** keyed by subcategory slug */
const EXCERPTS: Record<string, string> = {
  "bones-joints":
    "Stiff knees and aching joints turn stairs into a chore — glucosamine, calcium and collagen formulas support cartilage, bone density and easier movement.",
  "brain-cognitive":
    "When focus fades by mid-afternoon, nootropic and omega-3 formulas support memory, concentration and mental clarity through long working days.",
  "herbal":
    "If you would rather start with what grows naturally, traditional botanicals like ashwagandha, moringa and turmeric offer plant-based everyday support.",
  "immunity":
    "Catching every bug going round the office wears you down — vitamin C, zinc and elderberry formulas help support your immune defences year-round.",
  "sleep":
    "For nights spent staring at the ceiling, melatonin, magnesium and calming botanicals help you fall asleep faster and wake genuinely rested.",
  "detox-cleanse":
    "When you feel heavy, bloated and sluggish, gentle cleanse formulas support the liver and digestive system in clearing everyday build-up.",
  "antioxidants":
    "Long hours, city pollution and strong sun add up — antioxidant formulas help defend your cells against the free-radical damage behind premature ageing.",
  "anti-inflammatory":
    "For aches that linger and workouts that leave you sore for days, turmeric, omega-3 and boswellia help calm everyday inflammation.",
  "immune-booster-packs":
    "Covering the whole family costs less as a bundle — curated immunity packs group the essentials at a lower price per bottle.",
  "wellness-bundles":
    "If you are unsure which supplements actually work well together, ready-made bundles pair complementary formulas into one complete routine.",
  "liver-support":
    "Late nights, rich food and the occasional drink take their toll — milk thistle and liver-support formulas help protect your hardest-working organ.",
  "kidney-support":
    "Dehydration and a high-protein diet leave your kidneys under strain, and targeted formulas help maintain healthy filtration and fluid balance.",
  "eye-health":
    "Screens leave eyes dry, tired and strained by evening — lutein and zeaxanthin formulas help protect vision from blue light and age-related decline.",
  "heart-health":
    "With blood pressure and cholesterol concerns running in so many families, omega-3 and CoQ10 formulas help maintain healthy circulation.",
  "stress-anxiety":
    "When you are running on adrenaline and cannot switch off, adaptogens such as ashwagandha help the body regulate cortisol and feel calmer under pressure.",
};

async function main() {
  const [cat] = await db.select().from(categories).where(eq(categories.slug, CATEGORY_SLUG));
  if (!cat) { console.error(`No category with slug "${CATEGORY_SLUG}".`); process.exit(1); }

  const rows = await db.select().from(subcategories).where(eq(subcategories.categoryId, cat.id));
  const bySlug = new Map(rows.map(r => [r.slug, r]));

  let updated = 0, skipped = 0, missing: string[] = [];

  for (const [slug, excerpt] of Object.entries(EXCERPTS)) {
    const row = bySlug.get(slug);
    if (!row) { missing.push(slug); continue; }
    if (row.cardExcerpt?.trim() && !FORCE) { skipped++; continue; }
    await db
      .update(subcategories)
      .set({ cardExcerpt: excerpt, updatedAt: new Date() })
      .where(eq(subcategories.id, row.id));
    updated++;
  }

  console.log(`updated ${updated}, left alone ${skipped}`);
  if (missing.length) {
    console.log(`no subcategory found for: ${missing.join(", ")}`);
  }
  process.exit(0);
}

main().catch(err => { console.error("seed failed:", err); process.exit(1); });
