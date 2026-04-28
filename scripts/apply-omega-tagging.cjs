// Applies the omega-fatty-acids classification:
//  - Creates missing subcategories (krill-oil, flaxseed-oil) if not present
//  - Adds the omega category id to each matching product's additional_category_ids
//  - For products whose primary category is generic (food-supplements) AND have no
//    subcategory yet, also sets subcategory_id to the matched omega subcategory.
//    (Doesn't reassign primary category — keeps the human-uploaded primary intact
//    unless a follow-up pass decides otherwise.)
//
// Idempotent: safe to re-run.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function rx(...phrases) {
  const escaped = phrases.map(p => p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^a-z0-9])(?:${escaped.join('|')})(?=$|[^a-z0-9])`, 'i');
}

// Reordered: more-specific FORMS first (cod-liver, krill, flaxseed, 3-6-9, fish-oil),
// then by ingredient (omega-3 / dha as fallback).
const SUBCAT_RULES = [
  { slug: 'cod-liver-oil',   name: 'Cod Liver Oil',   regex: rx('cod liver oil', 'cod-liver-oil', 'cod liver') },
  { slug: 'krill-oil',       name: 'Krill Oil',       regex: rx('krill oil', 'krill') },
  { slug: 'flaxseed-oil',    name: 'Flaxseed Oil',    regex: rx('flaxseed', 'flax seed', 'flax oil', 'linseed') },
  { slug: 'omega-3-6-9',     name: 'Omega 3-6-9',     regex: rx('omega 3-6-9', 'omega 3 6 9', 'omega-3-6-9', '3-6-9', 'omega complex') },
  { slug: 'fish-oil',        name: 'Fish Oil',        regex: rx('fish oil', 'fish-oil') },
  { slug: 'omega-3',         name: 'Omega-3',         regex: rx('omega 3', 'omega-3', 'omega3', 'epa', 'epa/dha', 'epa & dha') },
  { slug: 'dha-supplements', name: 'DHA Supplements', regex: rx('dha') },
];

const INCLUDE = rx(
  'omega 3', 'omega-3', 'omega3',
  'omega 6', 'omega-6',
  'omega 9', 'omega-9',
  'omega complex',
  'fish oil', 'fish-oil', 'cod liver', 'cod-liver',
  'krill', 'flaxseed', 'flax seed', 'linseed',
  'epa', 'dha',
  'fatty acid', 'fatty-acid', 'essential fatty'
);

function classify(p) {
  const hay = [p.name || '', p.description || '', p.brand || '', Array.isArray(p.tags) ? p.tags.join(' ') : ''].join(' \n ');
  if (!INCLUDE.test(hay)) return null;
  for (const rule of SUBCAT_RULES) {
    if (rule.regex.test(hay)) return rule.slug;
  }
  return 'omega-3';
}

async function ensureSubcategory(categoryId, slug, name, sortOrder) {
  const ex = await pool.query(`SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2`, [categoryId, slug]);
  if (ex.rows.length) return ex.rows[0].id;
  const r = await pool.query(
    `INSERT INTO subcategories (category_id, slug, name, sort_order, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id`,
    [categoryId, slug, name, sortOrder]
  );
  console.log(`  + created subcategory: ${slug}`);
  return r.rows[0].id;
}

async function main() {
  const omega = (await pool.query(`SELECT id FROM categories WHERE slug = 'omega-fatty-acids'`)).rows[0];
  if (!omega) { console.error('omega-fatty-acids category missing'); return pool.end(); }

  // Ensure all rule subcategories exist
  console.log('Ensuring subcategories exist...');
  const subIdBySlug = {};
  for (let i = 0; i < SUBCAT_RULES.length; i++) {
    const r = SUBCAT_RULES[i];
    subIdBySlug[r.slug] = await ensureSubcategory(omega.id, r.slug, r.name, (i + 1) * 10);
  }

  // Classify
  const products = (await pool.query(`
    SELECT id, name, description, brand, tags, category_id, subcategory_id,
           additional_category_ids, category_slug, subcategory_slug
    FROM products
  `)).rows;

  let added = 0, alreadyOmega = 0, subAssigned = 0;

  for (const p of products) {
    const subSlug = classify(p);
    if (!subSlug) continue;
    const subId = subIdBySlug[subSlug];

    const existing = Array.isArray(p.additional_category_ids) ? p.additional_category_ids : [];
    const isPrimaryOmega = p.category_id === omega.id;
    const isAlreadyAdditional = existing.includes(omega.id);

    let newAdditional = existing;
    if (!isPrimaryOmega && !isAlreadyAdditional) {
      newAdditional = [...existing, omega.id];
    } else {
      alreadyOmega++;
    }

    // For subcategory: only set if product currently has no subcategory_id
    // (don't override the human's primary subcategory choice; this is additive logic
    // for now — when a product is shown on /omega-fatty-acids/<sub>/ we'll need a
    // separate mechanism, since subcategory_id is single-value. See note below.)
    let newSubId = p.subcategory_id;
    let newSubSlug = p.subcategory_slug;
    if (!p.subcategory_id) {
      newSubId = subId;
      newSubSlug = subSlug;
      subAssigned++;
    }

    const changed = (newAdditional !== existing) || (newSubId !== p.subcategory_id);
    if (!changed) continue;

    await pool.query(
      `UPDATE products SET additional_category_ids = $1::jsonb, subcategory_id = $2, subcategory_slug = $3, updated_at = NOW() WHERE id = $4`,
      [JSON.stringify(newAdditional), newSubId, newSubSlug, p.id]
    );
    added++;
    console.log(`  + tagged: ${p.name}  →  omega-fatty-acids/${subSlug}`);
  }

  console.log(`\nDone. ${added} products tagged. ${alreadyOmega} already in omega. ${subAssigned} got new subcategory_id.`);
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
