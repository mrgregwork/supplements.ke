// Audits every category & subcategory and reports product counts.
// Counts products via primary categoryId/subcategoryId AND additional_category_ids.
// Surfaces buckets with < THRESHOLD products as candidates for keyword auto-tagging.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const THIN_THRESHOLD = 3;

// Slug -> keywords used to auto-tag matching products by name/description.
// Add/edit here, not in code, when you find missing matches.
const KEYWORD_MAP = {
  // Lifestyle
  'organic-supplements':       ['organic'],
  'vegan-supplements':         ['vegan', 'plant-based', 'plant based'],
  'halal-supplements':         ['halal'],
  'sugar-free-supplements':    ['sugar free', 'sugar-free', 'no sugar', 'zero sugar'],
  'gluten-free-supplements':   ['gluten free', 'gluten-free'],
  'non-gmo-supplements':       ['non gmo', 'non-gmo', 'no gmo'],
  'kosher-supplements':        ['kosher'],

  // Forms
  'tablet-supplements':        ['tablet', 'tablets'],
  'capsule-supplements':       ['capsule', 'capsules'],
  'softgel-supplements':       ['softgel', 'soft gel', 'softgels'],
  'gummy-supplements':         ['gummy', 'gummies'],
  'liquid-supplements':        ['liquid', 'syrup', 'drops'],
  'powder-supplements':        ['powder'],
  'chewable-supplements':      ['chewable'],
  'effervescent-supplements':  ['effervescent', 'fizzy'],
  'spray-supplements':         ['spray'],
  'gummy-vitamins':            ['gummy', 'gummies'],
  'liquid-vitamins':           ['liquid vitamin', 'vitamin liquid', 'drops'],
  'vitamin-tablets':           ['tablet'],
  'vitamin-capsules':          ['capsule'],
  'vitamin-softgels':          ['softgel'],

  // Vitamins (subcategories)
  'vitamin-a':                 ['vitamin a', 'retinol', 'beta carotene', 'beta-carotene'],
  'vitamin-b':                 ['vitamin b', 'b-complex', 'b complex', 'thiamine', 'riboflavin', 'niacin', 'b6', 'b12', 'folate', 'biotin'],
  'vitamin-b12':               ['vitamin b12', 'b12', 'cobalamin', 'methylcobalamin'],
  'vitamin-c':                 ['vitamin c', 'ascorbic'],
  'vitamin-d':                 ['vitamin d', 'd3', 'cholecalciferol'],
  'vitamin-d3':                ['vitamin d3', 'd3', 'cholecalciferol'],
  'vitamin-e':                 ['vitamin e', 'tocopherol'],
  'vitamin-k':                 ['vitamin k', 'k2', 'menaquinone'],
  'multivitamins':             ['multivitamin', 'multi-vitamin', 'multi vitamin'],
  'prenatal-vitamins':         ['prenatal'],

  // Minerals
  'calcium':                   ['calcium'],
  'iron':                      ['iron', 'ferrous'],
  'magnesium':                 ['magnesium'],
  'zinc':                      ['zinc'],
  'selenium':                  ['selenium'],
  'potassium':                 ['potassium'],
  'iodine':                    ['iodine'],

  // Omegas
  'omega-3':                   ['omega 3', 'omega-3', 'omega3', 'fish oil', 'epa', 'dha'],
  'omega-6':                   ['omega 6', 'omega-6', 'evening primrose', 'borage'],
  'omega-9':                   ['omega 9', 'omega-9'],
  'fish-oil':                  ['fish oil'],
  'krill-oil':                 ['krill'],
  'flaxseed-oil':              ['flax', 'flaxseed', 'linseed'],

  // Collagen
  'marine-collagen':           ['marine collagen'],
  'bovine-collagen':           ['bovine collagen'],
  'collagen-peptides':         ['collagen peptide', 'hydrolyzed collagen'],
  'type-1-collagen':           ['type 1 collagen', 'type i collagen'],
  'type-2-collagen':           ['type 2 collagen', 'type ii collagen'],
  'type-3-collagen':           ['type 3 collagen', 'type iii collagen'],

  // Beauty
  'hair-supplements':          ['hair', 'biotin'],
  'skin-supplements':          ['skin', 'collagen', 'hyaluronic'],
  'nails-supplements':         ['nail', 'nails'],

  // Protein
  'whey-protein':              ['whey'],
  'casein-protein':            ['casein'],
  'plant-protein':             ['plant protein', 'pea protein', 'soy protein', 'rice protein'],
  'mass-gainer':               ['mass gainer', 'weight gainer'],
  'bcaa':                      ['bcaa', 'branched chain'],
  'creatine':                  ['creatine'],

  // Health goals
  'immune-support':            ['immune', 'immunity'],
  'heart-health':              ['heart', 'cardio', 'cardiovascular'],
  'brain-health':              ['brain', 'cognitive', 'memory', 'focus', 'nootropic'],
  'joint-health':              ['joint', 'glucosamine', 'chondroitin', 'msm'],
  'bone-health':               ['bone', 'osteo'],
  'energy-support':            ['energy', 'fatigue'],
  'sleep-support':             ['sleep', 'melatonin', 'magnesium glycinate'],
  'stress-support':            ['stress', 'anxiety', 'ashwagandha', 'rhodiola', 'l-theanine'],
  'liver-support':             ['liver', 'milk thistle'],
  'eye-health':                ['eye', 'lutein', 'zeaxanthin'],

  // Gut
  'probiotics':                ['probiotic'],
  'prebiotics':                ['prebiotic'],
  'digestive-enzymes':         ['enzyme', 'digestive'],
  'fiber-supplements':         ['fiber', 'psyllium'],

  // Herbal
  'turmeric-curcumin':         ['turmeric', 'curcumin'],
  'ginseng':                   ['ginseng'],
  'ashwagandha':               ['ashwagandha'],
  'moringa':                   ['moringa'],
  'spirulina':                 ['spirulina'],
  'chlorella':                 ['chlorella'],
  'green-tea':                 ['green tea', 'egcg'],
  'garlic':                    ['garlic', 'allicin'],
  'echinacea':                 ['echinacea'],
  'milk-thistle':              ['milk thistle', 'silymarin'],

  // Kids/family
  'kids-vitamins':             ['kid', 'children', 'baby', 'infant', 'junior'],
  'prenatal':                  ['prenatal', 'pregnancy'],
  'senior-supplements':        ['senior', 'mature adult'],

  // Gendered
  'mens-multivitamin':         ['men multivitamin', 'mens multivitamin', "men's multivitamin"],
  'womens-multivitamin':       ['women multivitamin', 'womens multivitamin', "women's multivitamin"],
  'mens-testosterone':         ['testosterone', 'tribulus', 'fenugreek'],
  'womens-hormonal':           ['hormonal', 'menopause', 'menstrual'],

  // Specialty / other
  'amino-acids':               ['amino acid', 'l-glutamine', 'l-arginine', 'l-carnitine'],
  'antioxidants':              ['antioxidant', 'resveratrol', 'coq10', 'glutathione', 'astaxanthin'],
  'coq10':                     ['coq10', 'co-q10', 'coenzyme q10'],
};

function deriveDefaultKeywords(slug, name) {
  // Last-resort fallback if slug not in KEYWORD_MAP: use slug words and name as the keyword.
  const fromSlug = slug.replace(/-supplements?$/, '').replace(/-/g, ' ').trim();
  const out = new Set();
  if (fromSlug && fromSlug.length > 2) out.add(fromSlug);
  if (name) out.add(name.toLowerCase().replace(/\s+supplements?$/, '').trim());
  return Array.from(out).filter(k => k && k.length > 2);
}

function keywordsFor(slug, name) {
  return KEYWORD_MAP[slug] || deriveDefaultKeywords(slug, name);
}

async function main() {
  const cats = (await pool.query(`SELECT id, slug, name, is_active FROM categories ORDER BY name`)).rows;
  const subs = (await pool.query(`SELECT id, category_id, slug, name, is_active FROM subcategories ORDER BY name`)).rows;
  const products = (await pool.query(`SELECT id, name, description, category_id, subcategory_id, additional_category_ids, additional_subcategory_ids FROM products`)).rows;

  console.log(`\nTotal products: ${products.length}`);
  console.log(`Total categories: ${cats.length}, subcategories: ${subs.length}\n`);

  // Count for category: primary categoryId match OR additional_category_ids contains it
  function countCategory(catId) {
    return products.filter(p =>
      p.category_id === catId ||
      (Array.isArray(p.additional_category_ids) && p.additional_category_ids.includes(catId))
    ).length;
  }
  function countSubcategory(subId) {
    return products.filter(p =>
      p.subcategory_id === subId ||
      (Array.isArray(p.additional_subcategory_ids) && p.additional_subcategory_ids.includes(subId))
    ).length;
  }

  // Estimate how many products would match keywords (informational)
  function estimateKeywordMatches(keywords) {
    if (!keywords.length) return 0;
    const lc = keywords.map(k => k.toLowerCase());
    return products.filter(p => {
      const hay = `${p.name || ''} ${p.description || ''}`.toLowerCase();
      return lc.some(k => hay.includes(k));
    }).length;
  }

  const thinCats = [];
  const thinSubs = [];

  console.log(`=== CATEGORIES (${cats.length}) ===`);
  cats.forEach(c => {
    const n = countCategory(c.id);
    const flag = n < THIN_THRESHOLD ? '⚠ THIN' : '  OK  ';
    console.log(`  ${flag}  ${String(n).padStart(3)} products  ${c.slug}  "${c.name}"  active:${c.is_active}`);
    if (n < THIN_THRESHOLD) {
      const kw = keywordsFor(c.slug, c.name);
      const est = estimateKeywordMatches(kw);
      thinCats.push({ ...c, count: n, keywords: kw, estMatches: est });
    }
  });

  console.log(`\n=== SUBCATEGORIES (${subs.length}) ===`);
  // Group by parent for readability
  const catById = Object.fromEntries(cats.map(c => [c.id, c]));
  subs.forEach(s => {
    const n = countSubcategory(s.id);
    const flag = n < THIN_THRESHOLD ? '⚠ THIN' : '  OK  ';
    const parent = catById[s.category_id]?.slug || '?';
    console.log(`  ${flag}  ${String(n).padStart(3)} products  ${parent}/${s.slug}  "${s.name}"`);
    if (n < THIN_THRESHOLD) {
      const kw = keywordsFor(s.slug, s.name);
      const est = estimateKeywordMatches(kw);
      thinSubs.push({ ...s, count: n, keywords: kw, estMatches: est, parentSlug: parent });
    }
  });

  console.log(`\n\n=== THIN CATEGORIES (<${THIN_THRESHOLD} products) ===`);
  console.log(`Found ${thinCats.length} thin top-level categories.`);
  thinCats.forEach(c => {
    console.log(`  ${c.slug}: has ${c.count}, keyword scan would match ~${c.estMatches}`);
    console.log(`    keywords: [${c.keywords.join(', ')}]`);
  });

  console.log(`\n=== THIN SUBCATEGORIES (<${THIN_THRESHOLD} products) ===`);
  console.log(`Found ${thinSubs.length} thin subcategories.`);
  thinSubs.forEach(s => {
    console.log(`  ${s.parentSlug}/${s.slug}: has ${s.count}, keyword scan would match ~${s.estMatches}`);
    console.log(`    keywords: [${s.keywords.join(', ')}]`);
  });

  console.log(`\n=== SUMMARY ===`);
  console.log(`Thin categories:    ${thinCats.length}`);
  console.log(`Thin subcategories: ${thinSubs.length}`);
  const fixable = thinCats.filter(c => c.estMatches >= THIN_THRESHOLD).length
                + thinSubs.filter(s => s.estMatches >= THIN_THRESHOLD).length;
  console.log(`Auto-fixable via keyword tagging: ~${fixable} buckets (estimated matches >= ${THIN_THRESHOLD})`);

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
