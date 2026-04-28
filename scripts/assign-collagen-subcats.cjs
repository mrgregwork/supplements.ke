require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows: [cat] } = await pool.query(
    "SELECT id FROM categories WHERE LOWER(name) = 'collagen' LIMIT 1"
  );
  if (!cat) { console.error('Collagen category not found'); process.exit(1); }
  const catId = cat.id;

  const { rows: subcats } = await pool.query(
    'SELECT id, slug FROM subcategories WHERE category_id = $1',
    [catId]
  );
  const subId = {};
  subcats.forEach(s => { subId[s.slug] = s.id; });
  console.log('Subcategories:', Object.keys(subId).join(', '));

  // -------------------------------------------------------
  // Rules run in ASCENDING priority — later rules OVERWRITE.
  //
  // User's rule: anything that is NOT a capsule, tablet, or
  // gummy IS a collagen powder — so collagen-powder is the
  // catch-all for every non-solid product.
  //
  // Specific powder sub-types (marine, flavored, beauty, skin,
  // peptides) override the default collagen-powder assignment.
  // Solid forms (capsule, tablet, gummy) always win last.
  // -------------------------------------------------------
  const rules = [

    // ── Step 0: assign EVERYTHING to collagen-powder by default ─────────────
    {
      slug: 'collagen-powder',
      note: 'Default for all collagen — non-solids stay here',
      condition: `1=1`   // matches every row
    },

    // ── Tier 1: specific powder sub-types override the default ───────────────
    {
      slug: 'collagen-peptides',
      // Only products whose PRIMARY name is "peptides" but do NOT say "powder"
      // (if the name says "powder" the user considers it collagen-powder)
      note: 'Hydrolyzed peptide products not labelled "powder"',
      condition: `name ILIKE '%peptide%' AND name NOT ILIKE '%powder%'`
    },
    {
      slug: 'best-collagen-for-skin',
      note: 'Skin-specific formulas',
      condition: `   name ILIKE '%skin complex%'
                  OR name ILIKE '%glowing%'
                  OR (name ILIKE '%advanced%' AND name ILIKE '%collagen%' AND name NOT ILIKE '%marine%')`
    },
    {
      slug: 'beauty-collagen',
      note: 'Beauty blends — hair, HA, vitamin-C formulas',
      condition: `   name ILIKE '%hair complex%'
                  OR name ILIKE '%undeniable beauty%'
                  OR (name ILIKE '%hyaluronic%'   AND name NOT ILIKE '%marine%')
                  OR (name ILIKE '%vitamin c%' AND name ILIKE '%collagen%'
                      AND name NOT ILIKE '%marine%' AND name NOT ILIKE '%tablet%')`
    },
    {
      slug: 'flavored-collagen',
      note: 'Named flavour in title',
      condition: `   name ILIKE '%lemon%'
                  OR name ILIKE '%vanilla%'
                  OR name ILIKE '%strawberry%'
                  OR name ILIKE '%matcha%'
                  OR name ILIKE '%chocolate%'
                  OR name ILIKE '%berry%'
                  OR name ILIKE '%peach%'
                  OR name ILIKE '%mango%'`
    },
    {
      slug: 'marine-collagen',
      note: 'Fish / marine source',
      condition: `name ILIKE '%marine collagen%'`
    },

    // ── Tier 2: solid form — always beats any powder sub-type ────────────────
    {
      slug: 'collagen-capsules',
      note: 'Capsule format',
      condition: `name ILIKE '%capsule%'`
    },
    {
      slug: 'collagen-tablets',
      note: 'Tablet / pill / type-2 joint collagen',
      condition: `   name ILIKE '%tablet%'
                  OR name ILIKE '% pill%'
                  OR name ILIKE '%type ii%'
                  OR name ILIKE '%type 2%'`
    },
    {
      slug: 'collagen-gummies',
      note: 'Gummy format — highest priority',
      condition: `name ILIKE '%gum%'`
    },
  ];

  for (const rule of rules) {
    const subcat = subId[rule.slug];
    if (!subcat) { console.warn(`  WARN: subcategory not found: ${rule.slug}`); continue; }

    const res = await pool.query(
      `UPDATE products SET subcategory_id = $1, updated_at = NOW()
       WHERE category_id = $2 AND (${rule.condition})`,
      [subcat, catId]
    );
    const icon = res.rowCount > 0 ? '✓' : '○';
    console.log(`  ${icon} ${res.rowCount.toString().padStart(3)} → ${rule.slug.padEnd(25)} (${rule.note})`);
  }

  const { rows: counts } = await pool.query(`
    SELECT s.name AS subcat, COUNT(p.id) AS cnt
    FROM subcategories s
    LEFT JOIN products p ON p.subcategory_id = s.id AND p.category_id = $1
    WHERE s.category_id = $1
    GROUP BY s.name
    ORDER BY cnt DESC, s.name
  `, [catId]);

  console.log('\n=== Final distribution ===');
  counts.forEach(r => {
    const bar = '█'.repeat(Math.round(Number(r.cnt) / 4));
    console.log(`  ${r.cnt.toString().padStart(3)}  ${r.subcat.padEnd(28)} ${bar}`);
  });

  const { rows: [{ unassigned }] } = await pool.query(
    `SELECT COUNT(*) AS unassigned FROM products WHERE category_id = $1 AND subcategory_id IS NULL`,
    [catId]
  );
  if (Number(unassigned) > 0) {
    console.log(`\n  ⚠  ${unassigned} products still unassigned`);
  } else {
    console.log('\n  ✓ All collagen products assigned.');
  }

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
