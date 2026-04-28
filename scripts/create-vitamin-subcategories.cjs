require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VITAMINS_CATEGORY_ID = 'e8dc75a1-cc56-412b-a562-bfe495800289';

const newSubcategories = [
  {
    slug: 'vitamin-b12',
    name: 'Vitamin B12',
    description: 'Vitamin B12 (methylcobalamin) supplements for energy, nerve health, and cognitive function. Essential for vegans and those with absorption issues.',
    seoTitle: 'Vitamin B12 Supplements Kenya — Methylcobalamin Price',
    seoDescription: 'Buy Vitamin B12 methylcobalamin supplements in Kenya. Best price on Jarrow, Life Extension B12 for energy and nerve support.',
    sortOrder: 20,
    // Products to reassign (matched by name fragment)
    productNames: [
      'Vitamin B12 Methylcobalamin',
      'BioActive Folate & Vitamin B12',
      'Jarrow Methyl B-12 Lemon',
      'Jarrow Methyl B-12 & Methyl Folate Lemon',
    ],
  },
  {
    slug: 'womens-vitamins',
    name: "Women's Vitamins",
    description: "Multivitamins and supplements formulated for women's health, hormonal balance, energy, and beauty support.",
    seoTitle: "Women's Vitamins Kenya — Best Multivitamins for Women Price",
    seoDescription: "Buy women's multivitamins in Kenya. OLLY, One A Day, Silver Women 50+ — best price on women's vitamins.",
    sortOrder: 30,
    productNames: [
      "OLLY Women's Multivitamin Gummies, 200 ct.",
      "OLLY Women's Multivitamin Gummy 45 Day Supply - 90 Count",
      'One A Day Multivitamin for Women - Daily Vitamins 200 tablets',
      'One A Day Multivitamin for Women 50+',
      'Silver Women 50+ Multivitamin, 275 Tablets',
    ],
  },
  {
    slug: 'mens-vitamins',
    name: "Men's Vitamins",
    description: "Multivitamins and supplements formulated for men's health, energy, prostate support, and active lifestyles.",
    seoTitle: "Men's Vitamins Kenya — Best Multivitamins for Men Price",
    seoDescription: "Buy men's multivitamins in Kenya. Centrum Silver Men 50+, One A Day Men — best price on men's vitamins.",
    sortOrder: 35,
    productNames: [
      "Centrum Silver Men's 50+ Multivitamin 200 Tablets",
      'One A Day Multivitamin for Men',
      'One A Day Multivitamin for Men 300tablets',
    ],
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const sub of newSubcategories) {
    // Check if slug already exists under this category
    const existing = await pool.query(
      `SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2`,
      [VITAMINS_CATEGORY_ID, sub.slug]
    );

    let subcategoryId;

    if (existing.rows.length) {
      subcategoryId = existing.rows[0].id;
      console.log(`⚠ Subcategory already exists: ${sub.name} (${subcategoryId})`);
    } else {
      const result = await pool.query(
        `INSERT INTO subcategories (category_id, slug, name, description, seo_title, seo_description, sort_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [VITAMINS_CATEGORY_ID, sub.slug, sub.name, sub.description, sub.seoTitle, sub.seoDescription, sub.sortOrder]
      );
      subcategoryId = result.rows[0].id;
      console.log(`✓ Created subcategory: ${sub.name} (${subcategoryId})`);
      created++;
    }

    // Reassign matching products
    for (const productName of sub.productNames) {
      const updateResult = await pool.query(
        `UPDATE products
         SET subcategory_id = $1, subcategory_slug = $2, updated_at = NOW()
         WHERE name = $3 AND category_id = $4
         RETURNING name`,
        [subcategoryId, sub.slug, productName, VITAMINS_CATEGORY_ID]
      );

      if (updateResult.rows.length) {
        console.log(`  → Moved: ${productName}`);
        updated++;
      } else {
        console.log(`  ✗ Not found: ${productName}`);
      }
    }
  }

  console.log(`\nDone. Created ${created} subcategories, reassigned ${updated} products.`);

  // Verify final state
  console.log('\n--- Verification: subcategory product counts ---');
  const counts = await pool.query(
    `SELECT s.name, s.slug, COUNT(p.id) as product_count
     FROM subcategories s
     LEFT JOIN products p ON p.subcategory_id = s.id AND p.category_id = $1
     WHERE s.category_id = $1
     GROUP BY s.id, s.name, s.slug
     ORDER BY s.sort_order, s.name`,
    [VITAMINS_CATEGORY_ID]
  );
  counts.rows.forEach(r => {
    const flag = r.product_count < 3 ? ' ⚠ below minimum' : '';
    console.log(`  ${r.name} (${r.slug}): ${r.product_count} products${flag}`);
  });

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
