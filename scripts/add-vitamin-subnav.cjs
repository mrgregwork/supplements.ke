require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Show all current nav items so we can find the Vitamins parent
  const all = await pool.query(`SELECT id, label, href, parent_id, sort_order, is_active FROM navigation_items ORDER BY sort_order, label`);
  console.log('\nAll navigation items:');
  all.rows.forEach(r => {
    const parent = r.parent_id ? ` (child of ${r.parent_id})` : '';
    console.log(`  [${r.sort_order}] ${r.label} → ${r.href} | id: ${r.id}${parent} | active: ${r.is_active}`);
  });

  // Find the Vitamins parent nav item
  const vitaminsNav = all.rows.find(r => r.href === '/vitamins/' && !r.parent_id);
  if (!vitaminsNav) {
    console.log('\n✗ No Vitamins top-level nav item found at /vitamins/ — check href above');
    await pool.end();
    return;
  }
  console.log(`\n✓ Vitamins nav parent: ${vitaminsNav.label} (${vitaminsNav.id})`);

  // New subcategory nav items to add
  const newItems = [
    { label: 'Vitamin B12', href: '/vitamins/vitamin-b12/', sortOrder: 25 },
    { label: "Women's Vitamins", href: '/vitamins/womens-vitamins/', sortOrder: 30 },
    { label: "Men's Vitamins", href: '/vitamins/mens-vitamins/', sortOrder: 35 },
  ];

  for (const item of newItems) {
    // Check if already exists
    const existing = all.rows.find(r => r.href === item.href);
    if (existing) {
      console.log(`⚠ Already exists: ${item.label} (${existing.id})`);
      continue;
    }

    const result = await pool.query(
      `INSERT INTO navigation_items (label, href, parent_id, sort_order, is_active, open_in_new_tab, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, false, NOW(), NOW())
       RETURNING id`,
      [item.label, item.href, vitaminsNav.id, item.sortOrder]
    );
    console.log(`✓ Added: ${item.label} → ${item.href} (${result.rows[0].id})`);
  }

  // Final state verification
  console.log('\n--- Final Vitamins nav structure ---');
  const final = await pool.query(
    `SELECT label, href, sort_order FROM navigation_items WHERE id = $1 OR parent_id = $1 ORDER BY sort_order, label`,
    [vitaminsNav.id]
  );
  final.rows.forEach(r => console.log(`  [${r.sort_order}] ${r.label} → ${r.href}`));

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
