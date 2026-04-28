require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Create "All Supplements" top-level nav item (mega-menu hub)
  let allSuppsId;
  const existing = await pool.query(`SELECT id FROM navigation_items WHERE href = '/all-supplements/'`);
  if (existing.rows.length) {
    allSuppsId = existing.rows[0].id;
    console.log(`⚠ All Supplements nav already exists (${allSuppsId})`);
  } else {
    const result = await pool.query(
      `INSERT INTO navigation_items (label, href, parent_id, sort_order, is_active, open_in_new_tab, description, created_at, updated_at)
       VALUES ('All Supplements', '/all-supplements/', NULL, 0, true, false, 'mega-menu', NOW(), NOW())
       RETURNING id`
    );
    allSuppsId = result.rows[0].id;
    console.log(`✓ Created "All Supplements" nav (${allSuppsId})`);
  }

  // Categories to add as nav children, in display order
  // description field carries the section group label for mega menu rendering
  const navChildren = [
    // Vitamins group
    { label: 'Vitamins',                    href: '/vitamins/',               sortOrder: 10, group: 'Vitamins' },
    // Minerals
    { label: 'Minerals',                    href: '/minerals/',               sortOrder: 20, group: 'Minerals & Omegas' },
    { label: 'Omega & Fatty Acids',         href: '/omega-fatty-acids/',      sortOrder: 25, group: 'Minerals & Omegas' },
    // Herbal
    { label: 'Herbal & Natural',            href: '/herbal-supplements/',     sortOrder: 30, group: 'Herbal' },
    // Fitness
    { label: 'Protein & Fitness',           href: '/protein/',                sortOrder: 40, group: 'Fitness' },
    { label: 'Weight Management',           href: '/weight-management/',      sortOrder: 45, group: 'Fitness' },
    // Health Goals
    { label: 'Health Goals',               href: '/health-goals/',           sortOrder: 50, group: 'Health Goals' },
    { label: 'Specialty Supplements',      href: '/specialty-supplements/',  sortOrder: 55, group: 'Health Goals' },
    // Beauty
    { label: 'Beauty Supplements',         href: '/beauty-supplements/',     sortOrder: 60, group: 'Beauty & Collagen' },
    { label: 'Collagen',                   href: '/collagen/',               sortOrder: 65, group: 'Beauty & Collagen' },
    // Gut & Digestive
    { label: 'Probiotics & Gut Health',    href: '/probiotics-gut-health/',  sortOrder: 70, group: 'Gut & Digestive' },
    // Family / Gender
    { label: "Kids & Family",              href: '/kids-family/',            sortOrder: 80, group: 'By Person' },
    { label: "Women's Health",             href: '/womens-health/',          sortOrder: 85, group: 'By Person' },
    { label: "Men's Health",               href: '/mens-health/',            sortOrder: 90, group: 'By Person' },
    // Form (noindex)
    { label: 'By Form',                    href: '/supplement-forms/',       sortOrder: 100, group: 'Browse By' },
    { label: 'By Lifestyle',               href: '/lifestyle-supplements/',  sortOrder: 105, group: 'Browse By' },
  ];

  let added = 0, skipped = 0;
  for (const item of navChildren) {
    const ex = await pool.query(`SELECT id FROM navigation_items WHERE parent_id = $1 AND href = $2`, [allSuppsId, item.href]);
    if (ex.rows.length) { skipped++; continue; }
    await pool.query(
      `INSERT INTO navigation_items (label, href, parent_id, sort_order, is_active, open_in_new_tab, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,true,false,$5,NOW(),NOW())`,
      [item.label, item.href, allSuppsId, item.sortOrder, item.group]
    );
    console.log(`  ✓ ${item.label} → ${item.href}`);
    added++;
  }

  console.log(`\nAdded ${added} nav children, skipped ${skipped} existing.`);
  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
