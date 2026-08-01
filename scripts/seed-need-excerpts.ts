/**
 * Seeds the one-sentence, pain-to-solution card excerpts shown on
 * "browse by need" hub cards.
 *
 *   npx tsx scripts/seed-need-excerpts.ts                    # all categories, fill blanks only
 *   npx tsx scripts/seed-need-excerpts.ts --category vitamins
 *   npx tsx scripts/seed-need-excerpts.ts --force            # overwrite existing
 *
 * Copy lives in scripts/data/need-cards.json, shared with
 * generate-need-images.ts so wording and imagery cannot drift apart.
 *
 * Everything is matched per category, never by slug alone: subcategory slugs
 * are NOT unique across categories (multivitamins appears in four, eye-health
 * heart-health liver-support kidney-support and postnatal in two), so a
 * slug-only lookup silently writes to the wrong row.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { db } from "../server/db";
import { categories, subcategories } from "../shared/schema";
import { eq } from "drizzle-orm";

type Card = { excerpt: string; scene: string; cast: "person" | "family" | "none" };
type Data = Record<string, Record<string, Card>>;

const DATA: Data = JSON.parse(readFileSync("scripts/data/need-cards.json", "utf8"));

const FORCE = process.argv.includes("--force");
const onlyIdx = process.argv.indexOf("--category");
const ONLY_CATEGORY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : undefined;

async function main() {
  const wanted = ONLY_CATEGORY ? [ONLY_CATEGORY] : Object.keys(DATA);
  let updated = 0, skipped = 0;
  const missing: string[] = [];

  for (const catSlug of wanted) {
    const cards = DATA[catSlug];
    if (!cards) { console.error(`no copy defined for category "${catSlug}"`); continue; }

    const [cat] = await db.select().from(categories).where(eq(categories.slug, catSlug));
    if (!cat) { console.error(`no category with slug "${catSlug}"`); continue; }

    const rows = await db.select().from(subcategories).where(eq(subcategories.categoryId, cat.id));
    const bySlug = new Map(rows.map(r => [r.slug, r]));

    for (const [slug, card] of Object.entries(cards)) {
      const row = bySlug.get(slug);
      if (!row) { missing.push(`${catSlug}/${slug}`); continue; }
      if (row.cardExcerpt?.trim() && !FORCE) { skipped++; continue; }

      await db
        .update(subcategories)
        .set({ cardExcerpt: card.excerpt, updatedAt: new Date() })
        .where(eq(subcategories.id, row.id));
      updated++;
    }
  }

  console.log(`updated ${updated}, left alone ${skipped}`);
  if (missing.length) console.log(`no matching subcategory row for: ${missing.join(", ")}`);
  process.exitCode = 0;
}

main().catch(err => { console.error("seed failed:", err); process.exitCode = 1; });
