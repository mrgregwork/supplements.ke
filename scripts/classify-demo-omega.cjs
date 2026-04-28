// Demo run: classify the entire 400-product catalog into the omega-fatty-acids
// top-level category and its subcategories (omega-3, dha-supplements, fish-oil,
// cod-liver-oil, omega-3-6-9, krill, flaxseed). Preview only — no DB writes.
//
// Logic:
//  - Word-boundary regex so "deliver" doesn't match "liver"
//  - Searches name + description + brand + tags
//  - Subcategory is most-specific match wins (cod-liver > fish-oil > omega-3)
//  - Top-level inclusion is OR of all subs
//
// Output: prints proposed (product → top-level + subcategory) assignments,
// plus products already correctly placed and any that would be skipped.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Word-boundary helpers — \b alone doesn't help with hyphenated tokens,
// so we wrap in (^|\W) ... (\W|$) lookarounds.
function rx(...phrases) {
  const escaped = phrases.map(p => p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^a-z0-9])(?:${escaped.join('|')})(?=$|[^a-z0-9])`, 'i');
}

// Subcategory rules, ordered most-specific first. First match wins.
const OMEGA_SUBCAT_RULES = [
  { slug: 'cod-liver-oil',   regex: rx('cod liver oil', 'cod-liver-oil', 'cod liver') },
  { slug: 'krill-oil',       regex: rx('krill oil', 'krill') },
  { slug: 'flaxseed-oil',    regex: rx('flaxseed', 'flax seed', 'flax oil', 'linseed') },
  { slug: 'omega-3-6-9',     regex: rx('omega 3-6-9', 'omega 3 6 9', 'omega-3-6-9', '3-6-9', 'omega complex') },
  { slug: 'dha-supplements', regex: rx('dha') },                          // matched only if not also omega-3 / fish oil specific
  { slug: 'fish-oil',        regex: rx('fish oil', 'fish-oil') },
  { slug: 'omega-3',         regex: rx('omega 3', 'omega-3', 'omega3', 'epa', 'epa/dha', 'epa & dha') },
];

// Inclusion in top-level omega-fatty-acids: any of the above patterns OR these signal terms.
const OMEGA_INCLUDE = rx(
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
  const hay = [
    p.name || '',
    p.description || '',
    p.brand || '',
    Array.isArray(p.tags) ? p.tags.join(' ') : ''
  ].join(' \n ');

  if (!OMEGA_INCLUDE.test(hay)) return null;

  // Find best subcategory
  let sub = null;
  for (const rule of OMEGA_SUBCAT_RULES) {
    if (rule.regex.test(hay)) { sub = rule.slug; break; }
  }
  return { sub: sub || 'omega-3' };  // sensible default
}

async function main() {
  const omega = (await pool.query(`SELECT id, slug FROM categories WHERE slug = 'omega-fatty-acids'`)).rows[0];
  if (!omega) {
    console.error('omega-fatty-acids category not found');
    return pool.end();
  }
  const omegaSubs = (await pool.query(`SELECT id, slug, name FROM subcategories WHERE category_id = $1`, [omega.id])).rows;
  const subBySlug = Object.fromEntries(omegaSubs.map(s => [s.slug, s]));

  const products = (await pool.query(`
    SELECT id, slug, name, description, brand, tags, category_id, subcategory_id, additional_category_ids,
           category_slug, subcategory_slug
    FROM products
  `)).rows;

  const matches = [];
  for (const p of products) {
    const r = classify(p);
    if (r) matches.push({ product: p, sub: r.sub });
  }

  console.log(`\nScanned ${products.length} products.`);
  console.log(`Proposed for omega-fatty-acids: ${matches.length}\n`);

  // Group by subcategory for readability
  const groups = {};
  for (const m of matches) {
    (groups[m.sub] ||= []).push(m);
  }

  for (const slug of Object.keys(groups).sort()) {
    const rows = groups[slug];
    const sub = subBySlug[slug];
    const subName = sub ? sub.name : `(no subcategory "${slug}" exists yet)`;
    console.log(`\n── ${slug}  →  ${subName}  (${rows.length} products) ──`);
    rows.forEach(({ product: p }) => {
      const currentTop = p.category_slug || '(none)';
      const currentSub = p.subcategory_slug || '(none)';
      const alreadyOmega = currentTop === 'omega-fatty-acids' || (Array.isArray(p.additional_category_ids) && p.additional_category_ids.includes(omega.id));
      const tag = alreadyOmega ? '✓ already' : '+ would add';
      console.log(`  ${tag.padEnd(11)}  ${p.name}`);
      console.log(`              currently: ${currentTop} / ${currentSub}    brand: ${p.brand || '-'}`);
    });
  }

  // Subcategories that have no proposals (these may need keyword tweaks or are genuinely empty)
  const emptySubs = omegaSubs.filter(s => !groups[s.slug]).map(s => s.slug);
  if (emptySubs.length) {
    console.log(`\nNo matches found for subcategories: ${emptySubs.join(', ')}`);
  }
  // Subcategories proposed in groups that don't exist as DB rows
  const orphanSubs = Object.keys(groups).filter(s => !subBySlug[s]);
  if (orphanSubs.length) {
    console.log(`Note: classifier proposes new subcategories not yet in DB: ${orphanSubs.join(', ')}`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
