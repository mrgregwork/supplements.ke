require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const items = [
  { label: 'Vitamins',          href: '/vitamins/',          sort: 1 },
  { label: 'Protein',           href: '/protein/',           sort: 2 },
  { label: 'Weight Management', href: '/weight-management/', sort: 4 },
  { label: "Women's Health",    href: '/womens-health/',     sort: 5 },
];

async function main() {
  // Make sure Collagen sits at position 3
  await pool.query(
    "UPDATE navigation_items SET sort_order = 3 WHERE LOWER(label) = 'collagen' AND parent_id IS NULL"
  );

  for (const item of items) {
    const { rows } = await pool.query(
      'SELECT id FROM navigation_items WHERE label = $1 AND parent_id IS NULL',
      [item.label]
    );
    if (rows.length) {
      console.log(`SKIP (exists): ${item.label}`);
      continue;
    }
    await pool.query(
      `INSERT INTO navigation_items (id, label, href, parent_id, sort_order, is_active, open_in_new_tab, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NULL, $3, true, false, NOW(), NOW())`,
      [item.label, item.href, item.sort]
    );
    console.log(`ADDED: ${item.label} → ${item.href}`);
  }

  const { rows } = await pool.query(
    'SELECT label, href, sort_order FROM navigation_items WHERE parent_id IS NULL ORDER BY sort_order'
  );
  console.log('\nTop-level nav:');
  rows.forEach(r => console.log(`  ${r.sort_order}. ${r.label}  → ${r.href}`));

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
