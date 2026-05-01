require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── EXISTING IDs (from query) ─────────────────────────────────────────────
const EXISTING = {
  collagen:            '9d63c656-32bb-4c1a-846f-91a839a6bcb8',
  'food-supplements':  '6c6d4a0a-c5ee-4033-9849-099f47ecf68c',
  'mens-health':       '701a6653-4519-4957-925e-2a3a183731c5',
  minerals:            'ba72a5e5-a14e-4384-ab11-537e0c441e90',
  'probiotics-gut-health': '191ee401-a623-4594-915a-d0ce45a7b488',
  protein:             '24a89b52-cdee-4a3c-8d72-20c09348be08',
  'specialty-supplements': 'ad130024-236a-436d-bcbb-a2aa22324742',
  vitamins:            'e8dc75a1-cc56-412b-a562-bfe495800289',
  'weight-management': '820c3193-6f2c-42e3-9f60-feb1e01615d6',
  'womens-health':     'a142641a-f123-41f5-b4d3-a2654f922d87',
};

// ─── NEW CATEGORIES TO CREATE ─────────────────────────────────────────────
const NEW_CATEGORIES = [
  {
    slug: 'herbal-supplements',
    name: 'Herbal & Natural Supplements',
    description: 'Plant-based and herbal supplements including ashwagandha, turmeric, moringa and adaptogens.',
    seoTitle: 'Herbal & Natural Supplements Kenya | Best Price',
    seoDescription: 'Buy herbal and natural supplements in Kenya. Ashwagandha, turmeric, moringa, adaptogens and more.',
    sortOrder: 35,
  },
  {
    slug: 'health-goals',
    name: 'Health Goal Supplements',
    description: 'Supplements targeted at specific health goals — immunity, energy, brain health, sleep, heart, and more.',
    seoTitle: 'Health Goal Supplements Kenya | Immunity, Energy, Brain, Sleep',
    seoDescription: 'Buy supplements by health goal in Kenya. Immunity, energy, brain & memory, sleep, heart health and more.',
    sortOrder: 55,
  },
  {
    slug: 'beauty-supplements',
    name: 'Beauty Supplements',
    description: 'Supplements for skin, hair, nails and anti-aging support.',
    seoTitle: 'Beauty Supplements Kenya | Skin, Hair & Nail Supplements Price',
    seoDescription: 'Buy beauty supplements in Kenya. Skin supplements, hair growth, nail support and anti-aging formulas.',
    sortOrder: 60,
  },
  {
    slug: 'omega-fatty-acids',
    name: 'Omega & Fatty Acids',
    description: 'Omega-3, fish oil, cod liver oil and essential fatty acid supplements.',
    seoTitle: 'Omega-3 & Fish Oil Supplements Kenya | Best Price',
    seoDescription: 'Buy omega-3, fish oil and cod liver oil supplements in Kenya. Best price on essential fatty acids.',
    sortOrder: 70,
  },
  {
    slug: 'kids-family',
    name: 'Kids & Family Supplements',
    description: 'Vitamins and supplements for children, teens and the whole family.',
    seoTitle: "Kids & Family Supplements Kenya | Children's Vitamins Price",
    seoDescription: "Buy children's and family supplements in Kenya. Kids' multivitamins, immunity, brain development and teen supplements.",
    sortOrder: 80,
  },
  // NOINDEX — delivery form & lifestyle filters
  {
    slug: 'supplement-forms',
    name: 'Supplement Forms',
    description: 'noindex',  // signals noindex to the template
    seoTitle: 'Supplement Forms | Tablets, Capsules, Gummies, Powders',
    seoDescription: 'Browse supplements by form: tablets, capsules, softgels, gummies, powders, liquids.',
    sortOrder: 200,
  },
  {
    slug: 'lifestyle-supplements',
    name: 'Lifestyle & Dietary Preferences',
    description: 'noindex',
    seoTitle: 'Lifestyle Supplements | Vegan, Halal, Organic, Gluten-Free',
    seoDescription: 'Browse supplements by dietary preference: vegan, vegetarian, halal, organic, sugar-free, gluten-free.',
    sortOrder: 210,
  },
];

// ─── SUBCATEGORIES: existing-category slug → new subs ────────────────────
const NEW_SUBCATEGORIES = {
  vitamins: [
    { slug: 'postnatal-vitamins',      name: 'Postnatal Vitamins',        sortOrder: 40 },
    { slug: 'senior-vitamins',         name: '50+ / Senior Vitamins',      sortOrder: 45 },
    { slug: 'immunity-vitamins',       name: 'Immunity Vitamins',          sortOrder: 50 },
    { slug: 'energy-vitamins',         name: 'Energy Vitamins',            sortOrder: 55 },
    { slug: 'skin-hair-nails-vitamins',name: 'Skin, Hair & Nails Vitamins',sortOrder: 60 },
    { slug: 'bone-health-vitamins',    name: 'Bone Health Vitamins',       sortOrder: 65 },
  ],
  minerals: [
    { slug: 'calcium',       name: 'Calcium',        sortOrder: 5  },
    { slug: 'potassium',     name: 'Potassium',       sortOrder: 20 },
    { slug: 'selenium',      name: 'Selenium',        sortOrder: 25 },
    { slug: 'iodine',        name: 'Iodine',          sortOrder: 30 },
    { slug: 'trace-minerals',name: 'Trace Minerals',  sortOrder: 35 },
    { slug: 'electrolytes',  name: 'Electrolytes',    sortOrder: 40 },
  ],
  protein: [
    { slug: 'plant-protein',      name: 'Plant Protein',        sortOrder: 10 },
    { slug: 'mass-gainers',       name: 'Mass Gainers',          sortOrder: 15 },
    { slug: 'protein-blends',     name: 'Protein Blends',        sortOrder: 20 },
    { slug: 'pre-workout',        name: 'Pre-Workout',           sortOrder: 25 },
    { slug: 'post-workout',       name: 'Post-Workout Recovery', sortOrder: 30 },
    { slug: 'bcaa-eaa',           name: 'BCAA / EAA',            sortOrder: 35 },
    { slug: 'performance-boosters', name: 'Performance Boosters', sortOrder: 40 },
    { slug: 'energy-boosters',    name: 'Energy Boosters',       sortOrder: 45 },
  ],
  'weight-management': [
    { slug: 'weight-loss-supplements', name: 'Weight Loss Supplements', sortOrder: 5  },
    { slug: 'fat-burners',             name: 'Fat Burners',              sortOrder: 10 },
    { slug: 'appetite-suppressants',   name: 'Appetite Suppressants',    sortOrder: 15 },
    { slug: 'metabolism-boosters',     name: 'Metabolism Boosters',      sortOrder: 20 },
    { slug: 'weight-gain-supplements', name: 'Weight Gain Supplements',  sortOrder: 25 },
  ],
  'womens-health': [
    { slug: 'postnatal-recovery',  name: 'Postnatal Recovery',  sortOrder: 10 },
    { slug: 'menopause-support',   name: 'Menopause Support',   sortOrder: 20 },
    { slug: 'iron-support-women',  name: 'Iron Support for Women', sortOrder: 25 },
  ],
  'mens-health': [
    { slug: 'testosterone-support', name: 'Testosterone Support', sortOrder: 10 },
    { slug: 'prostate-health',      name: 'Prostate Health',       sortOrder: 15 },
    { slug: 'mens-energy-stamina',  name: 'Energy & Stamina',      sortOrder: 20 },
    { slug: 'muscle-support',       name: 'Muscle Support',        sortOrder: 25 },
  ],
  'probiotics-gut-health': [
    { slug: 'prebiotics',          name: 'Prebiotics',          sortOrder: 10 },
    { slug: 'digestive-enzymes',   name: 'Digestive Enzymes',   sortOrder: 15 },
    { slug: 'gut-repair',          name: 'Gut Repair Supplements', sortOrder: 20 },
  ],
  'specialty-supplements': [
    { slug: 'detox-cleanse',        name: 'Detox & Cleanse',         sortOrder: 20 },
    { slug: 'antioxidants',         name: 'Antioxidants',             sortOrder: 25 },
    { slug: 'anti-inflammatory',    name: 'Anti-Inflammatory',        sortOrder: 30 },
    { slug: 'immune-booster-packs', name: 'Immune Booster Packs',    sortOrder: 35 },
    { slug: 'wellness-bundles',     name: 'Wellness Bundles',         sortOrder: 40 },
    { slug: 'liver-support',        name: 'Liver Support',            sortOrder: 45 },
    { slug: 'kidney-support',       name: 'Kidney Support',           sortOrder: 50 },
    { slug: 'eye-health',           name: 'Eye Health',               sortOrder: 55 },
    { slug: 'heart-health',         name: 'Heart Health',             sortOrder: 60 },
    { slug: 'stress-anxiety',       name: 'Stress & Anxiety Support', sortOrder: 65 },
  ],
  // New categories — subs defined below
  'herbal-supplements': [
    { slug: 'ashwagandha',           name: 'Ashwagandha',             sortOrder: 5  },
    { slug: 'turmeric-curcumin',     name: 'Turmeric / Curcumin',     sortOrder: 10 },
    { slug: 'moringa',               name: 'Moringa',                  sortOrder: 15 },
    { slug: 'ginseng',               name: 'Ginseng',                  sortOrder: 20 },
    { slug: 'garlic-supplements',    name: 'Garlic Supplements',       sortOrder: 25 },
    { slug: 'aloe-vera',             name: 'Aloe Vera Supplements',    sortOrder: 30 },
    { slug: 'ginger-supplements',    name: 'Ginger Supplements',       sortOrder: 35 },
    { slug: 'green-tea-extract',     name: 'Green Tea Extract',        sortOrder: 40 },
    { slug: 'adaptogens',            name: 'Adaptogens',               sortOrder: 45 },
    { slug: 'plant-based',           name: 'Plant-Based Supplements',  sortOrder: 50 },
  ],
  'health-goals': [
    { slug: 'immunity-support',      name: 'Immunity Support',         sortOrder: 5  },
    { slug: 'energy-fatigue',        name: 'Energy & Fatigue',         sortOrder: 10 },
    { slug: 'brain-memory',          name: 'Brain & Memory',           sortOrder: 15 },
    { slug: 'stress-anxiety-support',name: 'Stress & Anxiety',         sortOrder: 20 },
    { slug: 'sleep-support',         name: 'Sleep Support',            sortOrder: 25 },
    { slug: 'heart-health-goal',     name: 'Heart Health',             sortOrder: 30 },
    { slug: 'digestive-health-goal', name: 'Digestive Health',         sortOrder: 35 },
    { slug: 'bone-joint-health',     name: 'Bone & Joint Health',      sortOrder: 40 },
    { slug: 'eye-health-goal',       name: 'Eye Health',               sortOrder: 45 },
    { slug: 'liver-support-goal',    name: 'Liver Support',            sortOrder: 50 },
    { slug: 'kidney-support-goal',   name: 'Kidney Support',           sortOrder: 55 },
  ],
  'beauty-supplements': [
    { slug: 'skin-supplements',        name: 'Skin Supplements',         sortOrder: 5  },
    { slug: 'hair-growth-supplements', name: 'Hair Growth Supplements',  sortOrder: 10 },
    { slug: 'nail-support',            name: 'Nail Support Supplements', sortOrder: 15 },
    { slug: 'anti-aging',              name: 'Anti-Aging Supplements',   sortOrder: 20 },
  ],
  'omega-fatty-acids': [
    { slug: 'omega-3',         name: 'Omega-3',          sortOrder: 5  },
    { slug: 'fish-oil',        name: 'Fish Oil',          sortOrder: 10 },
    { slug: 'cod-liver-oil',   name: 'Cod Liver Oil',     sortOrder: 15 },
    { slug: 'omega-3-6-9',     name: 'Omega 3-6-9',       sortOrder: 20 },
    { slug: 'dha-supplements', name: 'DHA Supplements',   sortOrder: 25 },
  ],
  'kids-family': [
    { slug: 'kids-multivitamins',       name: "Kids' Multivitamins",        sortOrder: 5  },
    { slug: 'kids-immunity',            name: "Kids' Immunity Supplements", sortOrder: 10 },
    { slug: 'kids-brain-development',   name: 'Kids Brain Development',     sortOrder: 15 },
    { slug: 'teen-supplements',         name: 'Teen Supplements',           sortOrder: 20 },
    { slug: 'family-wellness',          name: 'Family Wellness',            sortOrder: 25 },
  ],
  'supplement-forms': [
    { slug: 'tablet-supplements',        name: 'Tablets',       sortOrder: 5  },
    { slug: 'capsule-supplements',       name: 'Capsules',      sortOrder: 10 },
    { slug: 'softgel-supplements',       name: 'Softgels',      sortOrder: 15 },
    { slug: 'gummy-supplements',         name: 'Gummies',       sortOrder: 20 },
    { slug: 'powder-supplements',        name: 'Powders',       sortOrder: 25 },
    { slug: 'liquid-supplements',        name: 'Liquids',       sortOrder: 30 },
    { slug: 'effervescent-supplements',  name: 'Effervescent',  sortOrder: 35 },
  ],
  'lifestyle-supplements': [
    { slug: 'vegan-supplements',       name: 'Vegan Supplements',       sortOrder: 5  },
    { slug: 'vegetarian-supplements',  name: 'Vegetarian Supplements',  sortOrder: 10 },
    { slug: 'halal-supplements',       name: 'Halal Supplements',       sortOrder: 15 },
    { slug: 'organic-supplements',     name: 'Organic Supplements',     sortOrder: 20 },
    { slug: 'sugar-free-supplements',  name: 'Sugar-Free Supplements',  sortOrder: 25 },
    { slug: 'gluten-free-supplements', name: 'Gluten-Free Supplements', sortOrder: 30 },
    { slug: 'non-gmo-supplements',     name: 'Non-GMO Supplements',     sortOrder: 35 },
  ],
};

async function upsertCategory(slug, fields) {
  const existing = await pool.query(`SELECT id FROM categories WHERE slug = $1`, [slug]);
  if (existing.rows.length) {
    console.log(`  ⚠ Category exists: ${slug}`);
    return existing.rows[0].id;
  }
  const result = await pool.query(
    `INSERT INTO categories (slug, name, description, seo_title, seo_description, sort_order, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW()) RETURNING id`,
    [slug, fields.name, fields.description || '', fields.seoTitle || '', fields.seoDescription || '', fields.sortOrder || 0]
  );
  console.log(`  ✓ Created category: ${slug}`);
  return result.rows[0].id;
}

async function upsertSubcategory(categoryId, slug, name, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2`,
    [categoryId, slug]
  );
  if (existing.rows.length) return null; // already exists, silent skip
  await pool.query(
    `INSERT INTO subcategories (category_id, slug, name, sort_order, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,true,NOW(),NOW())`,
    [categoryId, slug, name, sortOrder]
  );
  return true;
}

async function main() {
  console.log('\n=== CREATING NEW CATEGORIES ===');
  const categoryIds = { ...EXISTING };

  for (const cat of NEW_CATEGORIES) {
    const id = await upsertCategory(cat.slug, cat);
    categoryIds[cat.slug] = id;
  }

  console.log('\n=== CREATING SUBCATEGORIES ===');
  let created = 0, skipped = 0;

  for (const [catSlug, subs] of Object.entries(NEW_SUBCATEGORIES)) {
    const catId = categoryIds[catSlug];
    if (!catId) { console.log(`  ✗ No ID for category: ${catSlug}`); continue; }
    for (const sub of subs) {
      const result = await upsertSubcategory(catId, sub.slug, sub.name, sub.sortOrder);
      if (result) { console.log(`  ✓ ${catSlug}/${sub.slug}`); created++; }
      else skipped++;
    }
  }

  console.log(`\n  Created: ${created} subcategories, skipped (already exist): ${skipped}`);

  // ─── FINAL SUMMARY ──────────────────────────────────────────────────────
  console.log('\n=== FINAL STATE ===');
  const cats = await pool.query(`SELECT id, slug, name FROM categories ORDER BY sort_order, name`);
  for (const c of cats.rows) {
    const subs = await pool.query(`SELECT COUNT(*) FROM subcategories WHERE category_id = $1`, [c.id]);
    console.log(`  ${c.slug.padEnd(30)} ${subs.rows[0].count} subcategories`);
  }

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
