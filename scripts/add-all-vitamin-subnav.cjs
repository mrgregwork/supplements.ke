require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VITAMINS_NAV_ID = 'aea5ce5d-becc-4884-82f6-8fcf12cccb23';

// All vitamin subcategories that have 3+ products, in SEO-priority order
const items = [
  { label: 'Vitamin C',          href: '/vitamins/vitamin-c/',          sortOrder: 5  },
  { label: 'Vitamin D',          href: '/vitamins/vitamin-d/',          sortOrder: 10 },
  { label: 'Multivitamins',      href: '/vitamins/multivitamins/',      sortOrder: 15 },
  { label: 'Vitamin B Complex',  href: '/vitamins/vitamin-b-complex/',  sortOrder: 20 },
  // B12, Women's, Men's already added (sort 25, 30, 35)
  { label: 'Vitamin K',          href: '/vitamins/vitamin-k/',          sortOrder: 40 },
];

async function main() {
  const existing = await pool.query(
    `SELECT href FROM navigation_items WHERE parent_id = $1`,
    [VITAMINS_NAV_ID]
  );
  const existingHrefs = new Set(existing.rows.map(r => r.href));

  for (const item of items) {
    if (existingHrefs.has(item.href)) {
      console.log(`⚠ Already exists: ${item.label}`);
      continue;
    }
    const result = await pool.query(
      `INSERT INTO navigation_items (label, href, parent_id, sort_order, is_active, open_in_new_tab, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, false, NOW(), NOW()) RETURNING id`,
      [item.label, item.href, VITAMINS_NAV_ID, item.sortOrder]
    );
    console.log(`✓ Added: ${item.label} → ${item.href} (${result.rows[0].id})`);
  }

  console.log('\n--- Final Vitamins dropdown ---');
  const final = await pool.query(
    `SELECT label, href, sort_order FROM navigation_items
     WHERE id = $1 OR parent_id = $1
     ORDER BY sort_order, label`,
    [VITAMINS_NAV_ID]
  );
  final.rows.forEach(r => console.log(`  [${r.sort_order}] ${r.label} → ${r.href}`));

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
