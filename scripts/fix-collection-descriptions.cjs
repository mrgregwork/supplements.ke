require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function fixDescription(html) {
  if (!html) return html;

  // 1. Replace em-dashes (—) with colon-space in H2 headings
  //    e.g. "X in Kenya — What to Know" → "X in Kenya: What to Know"
  //    e.g. "X — Popular Supplements" → "X: Popular Supplements"
  let fixed = html.replace(/ — /g, ': ');
  // Also catch em-dash with no surrounding spaces
  fixed = fixed.replace(/—/g, ': ');

  // 2. Fix "Back to X Hub" → "See all X"
  //    Handles: "Back to Protein Hub", "Back to Vitamins Hub", etc.
  fixed = fixed.replace(/Back to ([A-Za-z0-9\s&']+?) Hub/g, (match, name) => {
    return `See all ${name.trim()}`;
  });

  // 3. Fix "Back to X hub" (lowercase hub)
  fixed = fixed.replace(/Back to ([A-Za-z0-9\s&']+?) hub/g, (match, name) => {
    return `See all ${name.trim()}`;
  });

  return fixed;
}

async function main() {
  // Fix categories
  const cats = await pool.query(`SELECT id, slug, long_description FROM categories WHERE long_description IS NOT NULL`);
  let catFixed = 0;
  for (const cat of cats.rows) {
    const fixed = fixDescription(cat.long_description);
    if (fixed !== cat.long_description) {
      await pool.query(`UPDATE categories SET long_description = $1 WHERE id = $2`, [fixed, cat.id]);
      console.log(`[CAT] Fixed: ${cat.slug}`);
      catFixed++;
    }
  }

  // Fix subcategories
  const subs = await pool.query(`SELECT s.id, s.slug, c.slug as cat_slug, s.long_description FROM subcategories s JOIN categories c ON s.category_id = c.id WHERE s.long_description IS NOT NULL`);
  let subFixed = 0;
  for (const sub of subs.rows) {
    const fixed = fixDescription(sub.long_description);
    if (fixed !== sub.long_description) {
      await pool.query(`UPDATE subcategories SET long_description = $1 WHERE id = $2`, [fixed, sub.id]);
      console.log(`[SUB] Fixed: ${sub.cat_slug}/${sub.slug}`);
      subFixed++;
    }
  }

  console.log(`\nDone. Categories fixed: ${catFixed}, Subcategories fixed: ${subFixed}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
