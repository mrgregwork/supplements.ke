require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Get vitamins category
  const catRes = await pool.query(`SELECT id, name, slug FROM categories WHERE slug = 'vitamins'`);
  if (!catRes.rows.length) {
    console.log('No vitamins category found. Trying partial match...');
    const all = await pool.query(`SELECT id, name, slug FROM categories ORDER BY name`);
    console.log('All categories:');
    all.rows.forEach(r => console.log(`  ${r.slug} — ${r.name} (${r.id})`));
    await pool.end();
    return;
  }

  const vitamins = catRes.rows[0];
  console.log(`\nCategory: ${vitamins.name} (${vitamins.slug}) — ID: ${vitamins.id}\n`);

  // Existing subcategories
  const subRes = await pool.query(
    `SELECT id, name, slug FROM subcategories WHERE category_id = $1 ORDER BY sort_order, name`,
    [vitamins.id]
  );
  console.log(`Existing subcategories (${subRes.rows.length}):`);
  subRes.rows.forEach(r => console.log(`  [${r.slug}] ${r.name} (${r.id})`));

  // All products in vitamins
  const prodRes = await pool.query(
    `SELECT id, name, slug, subcategory_id, subcategory_slug FROM products WHERE category_id = $1 ORDER BY name`,
    [vitamins.id]
  );
  console.log(`\nProducts in vitamins (${prodRes.rows.length} total):`);
  prodRes.rows.forEach(r => {
    const sub = r.subcategory_slug || r.subcategory_id || '(none)';
    console.log(`  ${r.name} → subcategory: ${sub}`);
  });

  // Group products by name keywords to suggest subcategory mapping
  const keywords = {
    'vitamin c': [],
    'vitamin d': [],
    'vitamin b12': [],
    'vitamin b complex': [],
    'vitamin b': [],
    'vitamin e': [],
    'vitamin k': [],
    'vitamin a': [],
    'multivitamin': [],
    'prenatal': [],
    "women": [],
    'kids': [],
    'children': [],
    'biotin': [],
    'folate|folic': [],
    'iron': [],
  };

  console.log('\n--- Keyword grouping ---');
  for (const [kw, matches] of Object.entries(keywords)) {
    const re = new RegExp(kw, 'i');
    const found = prodRes.rows.filter(p => re.test(p.name));
    if (found.length) {
      console.log(`\n[${kw}] (${found.length} products):`);
      found.forEach(p => console.log(`  - ${p.name}`));
    }
  }

  // Products not matched by any keyword
  const allKeywordRe = new RegExp(Object.keys(keywords).join('|'), 'i');
  const unmatched = prodRes.rows.filter(p => !allKeywordRe.test(p.name));
  if (unmatched.length) {
    console.log(`\n[UNMATCHED] (${unmatched.length} products):`);
    unmatched.forEach(p => console.log(`  - ${p.name}`));
  }

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
