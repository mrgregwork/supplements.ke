// Generic product-description applier.
// Reads scripts/data/<file>.json (default: life-extension-descriptions.json),
// each entry { slug, short, long, seoTitle, seoDescription }, and updates
// products.description / long_description / seo_title / seo_description.
//
// Usage:
//   node scripts/apply-product-descriptions.cjs
//   node scripts/apply-product-descriptions.cjs --file=brand-foo.json --dry
//   node scripts/apply-product-descriptions.cjs --only=mega-epa-dha-omega-3,super-omega-3-...

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function arg(name, def) {
  const a = process.argv.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
}

const FILE = arg('file', 'life-extension-descriptions.json');
const DRY  = process.argv.includes('--dry');
const ONLY = (arg('only', '') || '').split(',').map(s => s.trim()).filter(Boolean);

async function main() {
  const filePath = path.join(__dirname, 'data', FILE);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updated = 0, missing = 0, skipped = 0;

  for (const e of entries) {
    if (ONLY.length && !ONLY.includes(e.slug)) { skipped++; continue; }
    if (!e.slug || !e.short || !e.long) {
      console.log(`  ! incomplete entry: ${JSON.stringify(e).slice(0,80)}…`);
      continue;
    }
    if (DRY) {
      console.log(`  ~ would update: ${e.slug}`);
      continue;
    }
    const r = await pool.query(
      `UPDATE products
         SET description=$1, long_description=$2, seo_title=$3, seo_description=$4, updated_at=NOW()
       WHERE slug=$5
       RETURNING id, name`,
      [e.short, e.long, e.seoTitle || null, e.seoDescription || null, e.slug]
    );
    if (!r.rows.length) {
      console.log(`  ! no product found for slug: ${e.slug}`);
      missing++;
    } else {
      console.log(`  ✓ ${r.rows[0].name}`);
      updated++;
    }
  }

  console.log(`\n${updated} updated, ${missing} missing, ${skipped} skipped (--only filter).`);
  await pool.end();
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); });
