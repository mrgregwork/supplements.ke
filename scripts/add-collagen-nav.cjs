require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const collagenSubs = [
  { label: 'Collagen Powder',          href: '/collagen/collagen-powder/' },
  { label: 'Marine Collagen',          href: '/collagen/marine-collagen/' },
  { label: 'Collagen Tablets',         href: '/collagen/collagen-tablets/' },
  { label: 'Collagen Gummies',         href: '/collagen/collagen-gummies/' },
  { label: 'Flavored Collagen',        href: '/collagen/flavored-collagen/' },
  { label: 'Beauty Collagen',          href: '/collagen/beauty-collagen/' },
  { label: 'Best Collagen for Skin',   href: '/collagen/best-collagen-for-skin/' },
  { label: 'Collagen Peptides',        href: '/collagen/collagen-peptides/' },
  { label: 'Collagen Capsules',        href: '/collagen/collagen-capsules/' },
];

async function main() {
  // Find or create the Collagen parent nav item
  let { rows } = await pool.query(
    "SELECT id FROM navigation_items WHERE LOWER(label) = 'collagen' AND parent_id IS NULL LIMIT 1"
  );

  let parentId;
  if (rows.length) {
    parentId = rows[0].id;
    console.log(`Found existing Collagen nav item: ${parentId}`);
  } else {
    // Get max sort_order to place Collagen at the end
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max FROM navigation_items WHERE parent_id IS NULL'
    );
    const nextOrder = maxRows[0].max + 1;

    const { rows: created } = await pool.query(
      `INSERT INTO navigation_items (id, label, href, parent_id, sort_order, is_active, open_in_new_tab, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Collagen', '/collagen/', NULL, $1, true, false, NOW(), NOW())
       RETURNING id`,
      [nextOrder]
    );
    parentId = created[0].id;
    console.log(`Created Collagen nav item: ${parentId}`);
  }

  // Remove existing children so we can re-add cleanly
  const { rowCount: deleted } = await pool.query(
    'DELETE FROM navigation_items WHERE parent_id = $1',
    [parentId]
  );
  if (deleted > 0) console.log(`Removed ${deleted} existing child items`);

  // Insert subcategory nav items as children
  for (let i = 0; i < collagenSubs.length; i++) {
    const sub = collagenSubs[i];
    await pool.query(
      `INSERT INTO navigation_items (id, label, href, parent_id, sort_order, is_active, open_in_new_tab, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, false, NOW(), NOW())`,
      [sub.label, sub.href, parentId, i + 1]
    );
    console.log(`  Added: ${sub.label} → ${sub.href}`);
  }

  // Show final state
  const { rows: all } = await pool.query(
    `SELECT label, href FROM navigation_items WHERE parent_id = $1 ORDER BY sort_order`,
    [parentId]
  );
  console.log(`\nCollagen dropdown (${all.length} items):`);
  all.forEach(r => console.log(`  - ${r.label}  → ${r.href}`));

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
