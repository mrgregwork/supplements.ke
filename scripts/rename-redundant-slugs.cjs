// Renames subcategory slugs that repeat words from the parent category
// (keyword stuffing). Updates the denormalized products.subcategory_slug.
// No redirect map: the site is pre-launch, so old URLs simply 404 — there is
// no public traffic to preserve.
//
// Idempotent: if the new slug already exists in DB, the rename is skipped.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// {parentCategorySlug: {oldSubSlug: newSubSlug}}
const RENAMES = {
  'health-goals': {
    'kidney-support-goal':   'kidney-support',
    'liver-support-goal':    'liver-support',
    'eye-health-goal':       'eye-health',
    'heart-health-goal':     'heart-health',
    'digestive-health-goal': 'digestive-health',
  },
  'omega-fatty-acids': {
    'dha-supplements': 'dha',
  },
  'mens-health': {
    'mens-energy-stamina': 'energy-stamina',
    'mens-multivitamins':  'multivitamins',
  },
  'womens-health': {
    'womens-multivitamins': 'multivitamins',
    'iron-support-women':   'iron-support',
    'prenatal-vitamins':    'prenatal',
    'postnatal-recovery':   'postnatal',
  },
  'vitamins': {
    'mens-vitamins':              'mens',
    'womens-vitamins':            'womens',
    'kids-supplements':           'kids',
    'senior-vitamins':            'senior',
    'postnatal-vitamins':         'postnatal',
    'energy-vitamins':            'energy',
    'immunity-vitamins':          'immunity',
    'bone-health-vitamins':       'bone-health',
    'skin-hair-nails-vitamins':   'skin-hair-nails',
  },
  'kids-family': {
    'kids-multivitamins':      'multivitamins',
    'kids-immunity':           'immunity',
    'kids-brain-development':  'brain-development',
    'teen-supplements':        'teen',
  },
  'lifestyle-supplements': {
    'organic-supplements':     'organic',
    'vegan-supplements':       'vegan',
    'vegetarian-supplements':  'vegetarian',
    'halal-supplements':       'halal',
    'sugar-free-supplements':  'sugar-free',
    'gluten-free-supplements': 'gluten-free',
    'non-gmo-supplements':     'non-gmo',
  },
  'supplement-forms': {
    'capsule-supplements':      'capsules',
    'tablet-supplements':       'tablets',
    'gummy-supplements':        'gummies',
    'softgel-supplements':      'softgels',
    'powder-supplements':       'powders',
    'liquid-supplements':       'liquids',
    'effervescent-supplements': 'effervescent',
  },
  'beauty-supplements': {
    'skin-supplements':        'skin',
    'hair-growth-supplements': 'hair-growth',
  },
  'herbal-supplements': {
    'garlic-supplements': 'garlic',
    'ginger-supplements': 'ginger',
  },
  'specialty-supplements': {
    'sleep-supplements':  'sleep',
    'herbal-supplements': 'herbal',
  },
  'weight-management': {
    'weight-loss-supplements': 'weight-loss',
    'weight-gain-supplements': 'weight-gain',
  },
};

async function main() {
  const cats = (await pool.query(`SELECT id, slug FROM categories`)).rows;
  const catBySlug = Object.fromEntries(cats.map(c => [c.slug, c]));

  let renamed = 0, skipped = 0;

  for (const [catSlug, slugMap] of Object.entries(RENAMES)) {
    const cat = catBySlug[catSlug];
    if (!cat) { console.log(`  ! parent category not found: ${catSlug}`); continue; }

    for (const [oldSlug, newSlug] of Object.entries(slugMap)) {
      const old = await pool.query(`SELECT id FROM subcategories WHERE category_id=$1 AND slug=$2`, [cat.id, oldSlug]);
      if (!old.rows.length) { skipped++; continue; }
      const conflict = await pool.query(`SELECT id FROM subcategories WHERE category_id=$1 AND slug=$2`, [cat.id, newSlug]);
      if (conflict.rows.length) {
        console.log(`  ! conflict: ${catSlug}/${newSlug} already exists, cannot rename ${oldSlug}`);
        skipped++;
        continue;
      }
      await pool.query(`UPDATE subcategories SET slug=$1, updated_at=NOW() WHERE id=$2`, [newSlug, old.rows[0].id]);
      await pool.query(
        `UPDATE products SET subcategory_slug=$1, updated_at=NOW() WHERE subcategory_id=$2`,
        [newSlug, old.rows[0].id]
      );
      await pool.query(
        `UPDATE navigation_items SET href=$1, updated_at=NOW() WHERE href=$2`,
        [`/${catSlug}/${newSlug}/`, `/${catSlug}/${oldSlug}/`]
      );
      console.log(`  ✓ ${catSlug}/${oldSlug}  →  ${catSlug}/${newSlug}`);
      renamed++;
    }
  }

  console.log(`\n${renamed} renamed, ${skipped} skipped.`);

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
