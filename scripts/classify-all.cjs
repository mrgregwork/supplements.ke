// Comprehensive classifier — rebuilds every product's category/subcategory placement
// based on name + description + brand. Word-boundary matching to avoid false hits.
//
// Two modes:
//   node scripts/classify-all.cjs            → preview, no DB writes (default)
//   node scripts/classify-all.cjs --apply    → writes additional_category_ids,
//                                              tags, and (only when missing)
//                                              subcategory_id
//
// Behavior:
//   - Top-level categories: tagged into additional_category_ids (additive, never removes
//     a human's primary category). Primary category is left alone unless --replace-primary.
//   - Subcategory: only set when product currently has none.
//   - Tags: written for filter UI (form_*, lifestyle_*, audience_*, goal_*).
//   - Idempotent.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const APPLY = process.argv.includes('--apply');
const REPLACE_PRIMARY = process.argv.includes('--replace-primary');

function rx(...phrases) {
  const escaped = phrases.map(p => p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^a-z0-9])(?:${escaped.join('|')})(?=$|[^a-z0-9])`, 'i');
}

// ───────────────────────── DETECTORS ─────────────────────────
// Each entry: tag → regex. Tag becomes a `tag_xxx` on the product, and may map
// to category/subcategory below.

const FORM = {
  gummy:        rx('gummy', 'gummies'),
  tablet:       rx('tablet', 'tablets', 'caplet', 'caplets'),
  capsule:      rx('capsule', 'capsules', 'vegcaps', 'veg caps', 'veggie caps'),
  softgel:      rx('softgel', 'softgels', 'soft gel', 'soft gels', 'soft-gel'),
  powder:       rx('powder', 'powdered', 'unflavored powder'),
  liquid:       rx('liquid', 'syrup', 'drops', 'oral spray', 'tincture'),
  effervescent: rx('effervescent', 'fizzy'),
  chewable:     rx('chewable', 'chewables'),
};

const LIFESTYLE = {
  organic:     rx('organic', 'usda organic'),
  vegan:       rx('vegan', 'plant-based', 'plant based'),
  vegetarian:  rx('vegetarian'),
  halal:       rx('halal'),
  glutenFree:  rx('gluten free', 'gluten-free'),
  sugarFree:   rx('sugar free', 'sugar-free', 'no sugar', 'zero sugar', 'unsweetened'),
  nonGmo:      rx('non gmo', 'non-gmo', 'no gmo'),
  kosher:      rx('kosher'),
};

const AUDIENCE = {
  kids:     rx('kids', 'kid', 'children', "children's", 'child', 'baby', 'infant', 'junior', 'for kids'),
  teen:     rx('teen', 'teens', 'teenager'),
  women:    rx('women', "women's", 'woman', 'female'),
  men:      rx('men', "men's", 'male'),
  prenatal: rx('prenatal', 'pregnancy'),
  postnatal:rx('postnatal', 'post-natal'),
  senior:   rx('senior', '50+', 'mature adult', 'mature adults'),
};

// Ingredient detectors (each returns true for the haystack)
const INGREDIENT = {
  // Vitamins
  vitaminA:    rx('vitamin a', 'retinol', 'beta carotene', 'beta-carotene'),
  vitaminBComplex: rx('b-complex', 'b complex', 'vitamin b complex'),
  vitaminB1:   rx('vitamin b1', 'thiamine', 'thiamin'),
  vitaminB2:   rx('vitamin b2', 'riboflavin'),
  vitaminB3:   rx('vitamin b3', 'niacin', 'niacinamide'),
  vitaminB6:   rx('vitamin b6', 'pyridoxine'),
  vitaminB9:   rx('folate', 'folic acid'),
  vitaminB12:  rx('vitamin b12', 'b-12', 'b 12', 'cobalamin', 'methylcobalamin', 'cyanocobalamin'),
  vitaminC:    rx('vitamin c', 'ascorbic', 'ascorbate'),
  vitaminD:    rx('vitamin d', 'd3', 'd 3', 'cholecalciferol'),
  vitaminE:    rx('vitamin e', 'tocopherol'),
  vitaminK:    rx('vitamin k', 'k2', 'menaquinone', 'phylloquinone'),
  multivitamin:rx('multivitamin', 'multi-vitamin', 'multi vitamin', 'multi  vitamin'),

  // Minerals
  calcium:     rx('calcium'),
  iron:        rx('iron', 'ferrous', 'ferric'),
  magnesium:   rx('magnesium'),
  zinc:        rx('zinc'),
  selenium:    rx('selenium'),
  potassium:   rx('potassium'),
  iodine:      rx('iodine', 'kelp'),
  electrolyte: rx('electrolyte', 'electrolytes'),
  traceMineral:rx('trace mineral', 'trace minerals'),

  // Omegas (already populated, but for cross-reference)
  omega3:      rx('omega 3', 'omega-3', 'omega3', 'epa', 'dha'),
  fishOil:     rx('fish oil', 'fish-oil'),
  codLiver:    rx('cod liver'),
  krill:       rx('krill'),
  flaxseed:    rx('flaxseed', 'flax seed', 'flax oil', 'linseed'),

  // Collagen
  collagen:        rx('collagen'),
  marineCollagen:  rx('marine collagen'),
  bovineCollagen:  rx('bovine collagen'),
  hydrolyzedCollagen: rx('hydrolyzed collagen', 'collagen peptide'),

  // Protein
  whey:        rx('whey'),
  casein:      rx('casein'),
  plantProtein:rx('pea protein', 'soy protein', 'rice protein', 'plant protein'),
  massGainer:  rx('mass gainer', 'weight gainer'),
  bcaa:        rx('bcaa', 'eaa', 'branched chain'),
  creatine:    rx('creatine'),
  preWorkout:  rx('pre-workout', 'pre workout', 'preworkout'),
  postWorkout: rx('post-workout', 'post workout', 'recovery shake'),

  // Herbals
  ashwagandha: rx('ashwagandha', 'withania'),
  turmeric:    rx('turmeric', 'curcumin'),
  ginseng:     rx('ginseng'),
  moringa:     rx('moringa'),
  spirulina:   rx('spirulina'),
  chlorella:   rx('chlorella'),
  greenTea:    rx('green tea', 'egcg'),
  garlic:      rx('garlic', 'allicin'),
  ginger:      rx('ginger'),
  echinacea:   rx('echinacea'),
  milkThistle: rx('milk thistle', 'silymarin'),
  aloe:        rx('aloe vera'),
  adaptogen:   rx('adaptogen', 'adaptogens', 'rhodiola'),

  // Probiotics / gut
  probiotic:   rx('probiotic', 'probiotics', 'lactobacillus', 'bifido'),
  prebiotic:   rx('prebiotic', 'prebiotics', 'inulin', 'fos'),
  digestiveEnzyme: rx('digestive enzyme', 'digestive enzymes', 'protease', 'amylase', 'lipase', 'bromelain', 'papain'),
  fiber:       rx('fiber', 'psyllium'),

  // Specialty / antioxidants
  resveratrol: rx('resveratrol'),
  coq10:       rx('coq10', 'co-q10', 'coenzyme q10', 'ubiquinol'),
  glutathione: rx('glutathione'),
  astaxanthin: rx('astaxanthin'),
  hyaluronic:  rx('hyaluronic'),
  biotin:      rx('biotin'),
  glucosamine: rx('glucosamine'),
  chondroitin: rx('chondroitin'),
  msm:         rx('\\bmsm\\b', 'methylsulfonylmethane'),
  melatonin:   rx('melatonin'),
  lutein:      rx('lutein', 'zeaxanthin'),

  // Hormonal
  testosterone:rx('testosterone', 'tribulus', 'fenugreek', 'tongkat'),
  menopause:   rx('menopause', 'black cohosh'),
  prostate:    rx('prostate', 'saw palmetto'),

  // Organ / system support
  kidney:      rx('kidney', 'renal', 'cranberry', 'uva ursi', 'urinary'),
  thermogenic: rx('thermogenic', 'fat burner', 'fat-burner', 'caffeine anhydrous', 'green coffee', 'l-carnitine', 'cla'),
  appetite:    rx('appetite suppressant', 'appetite control', 'glucomannan', 'garcinia'),
};

// Health goal markers
const GOAL = {
  immune:     rx('immune', 'immunity', 'immune support', 'immune system'),
  sleep:      rx('sleep', 'insomnia', 'restful'),
  stress:     rx('stress', 'anxiety', 'calm', 'relaxation', 'mood'),
  energy:     rx('energy', 'fatigue', 'vitality', 'stamina'),
  brain:      rx('brain', 'cognitive', 'memory', 'focus', 'nootropic', 'mental'),
  heart:      rx('heart health', 'cardio', 'cardiovascular', 'cholesterol', 'blood pressure'),
  joint:      rx('joint', 'joints'),
  bone:       rx('bone health', 'osteo', 'bone density'),
  liver:      rx('liver support', 'liver health', 'liver detox', 'liver function'),
  kidney:     rx('kidney support', 'kidney health'),
  eye:        rx('eye health', 'vision', 'macular'),
  detox:      rx('detox', 'cleanse', 'cleansing'),
  hair:       rx('hair growth', 'hair health'),
  skin:       rx('skin health', 'skin care', 'glowing skin', 'beauty'),
  nail:       rx('nail health', 'nail support', 'strong nails'),
  antiAging:  rx('anti-aging', 'anti aging', 'youthful', 'wrinkle'),
  weightLoss: rx('weight loss', 'fat burner', 'fat-burner', 'slim'),
  weightGain: rx('weight gain', 'mass gain'),
  appetite:   rx('appetite suppressant', 'appetite control'),
  hormonal:   rx('hormonal balance', 'hormone balance', 'menstrual'),
};

function detectAll(haystack) {
  const detected = { form: [], lifestyle: [], audience: [], ingredient: [], goal: [] };
  for (const [k, r] of Object.entries(FORM))      if (r.test(haystack)) detected.form.push(k);
  for (const [k, r] of Object.entries(LIFESTYLE)) if (r.test(haystack)) detected.lifestyle.push(k);
  for (const [k, r] of Object.entries(AUDIENCE))  if (r.test(haystack)) detected.audience.push(k);
  for (const [k, r] of Object.entries(INGREDIENT))if (r.test(haystack)) detected.ingredient.push(k);
  for (const [k, r] of Object.entries(GOAL))      if (r.test(haystack)) detected.goal.push(k);
  return detected;
}

// ───────────────────────── ROUTING ─────────────────────────
// Map detected signals to a list of {category, subcategory?} placements.
// One product can map to multiple categories.

function placementsFor(d, productName) {
  const out = [];
  const ing = new Set(d.ingredient);
  const aud = new Set(d.audience);
  const life = new Set(d.lifestyle);
  const form = new Set(d.form);
  const goal = new Set(d.goal);

  // VITAMINS
  const hasVitamin = ing.has('vitaminA') || ing.has('vitaminBComplex') || ing.has('vitaminB1') ||
    ing.has('vitaminB2') || ing.has('vitaminB3') || ing.has('vitaminB6') || ing.has('vitaminB9') ||
    ing.has('vitaminB12') || ing.has('vitaminC') || ing.has('vitaminD') || ing.has('vitaminE') ||
    ing.has('vitaminK') || ing.has('multivitamin');
  if (hasVitamin) {
    let sub = null;
    if (ing.has('vitaminBComplex')) sub = 'vitamin-b-complex';
    else if (ing.has('vitaminB12')) sub = 'vitamin-b12';
    else if (ing.has('vitaminC'))   sub = 'vitamin-c';
    else if (ing.has('vitaminD'))   sub = 'vitamin-d';
    else if (ing.has('vitaminK'))   sub = 'vitamin-k';
    else if (ing.has('multivitamin')) {
      if (aud.has('kids')) sub = 'kids';
      else if (aud.has('men')) sub = 'mens';
      else if (aud.has('women')) sub = 'womens';
      else if (aud.has('senior')) sub = 'senior';
      else sub = 'multivitamins';
    } else if (aud.has('kids')) sub = 'kids';
    else if (aud.has('senior')) sub = 'senior';
    else if (goal.has('skin') || goal.has('hair') || goal.has('nail')) sub = 'skin-hair-nails';
    else if (goal.has('immune')) sub = 'immunity';
    else if (goal.has('energy')) sub = 'energy';
    else if (goal.has('bone')) sub = 'bone-health';
    out.push({ cat: 'vitamins', sub });
  }

  // MINERALS
  const hasMineral = ing.has('calcium') || ing.has('iron') || ing.has('magnesium') ||
    ing.has('zinc') || ing.has('selenium') || ing.has('potassium') || ing.has('iodine') ||
    ing.has('electrolyte') || ing.has('traceMineral');
  if (hasMineral) {
    let sub = null;
    if (ing.has('calcium')) sub = 'calcium';
    else if (ing.has('iron')) sub = 'iron';
    else if (ing.has('magnesium')) sub = 'magnesium';
    else if (ing.has('zinc')) sub = 'zinc';
    else if (ing.has('selenium')) sub = 'selenium';
    else if (ing.has('potassium')) sub = 'potassium';
    else if (ing.has('iodine')) sub = 'iodine';
    else if (ing.has('electrolyte')) sub = 'electrolytes';
    else if (ing.has('traceMineral')) sub = 'trace-minerals';
    out.push({ cat: 'minerals', sub });
  }

  // OMEGA
  if (ing.has('omega3') || ing.has('fishOil') || ing.has('codLiver') || ing.has('krill') || ing.has('flaxseed')) {
    let sub = null;
    if (ing.has('codLiver')) sub = 'cod-liver-oil';
    else if (ing.has('krill')) sub = 'krill-oil';
    else if (ing.has('flaxseed')) sub = 'flaxseed-oil';
    else if (ing.has('fishOil')) sub = 'fish-oil';
    else sub = 'omega-3';
    out.push({ cat: 'omega-fatty-acids', sub });
    // DHA cross-tag if DHA mentioned but routed to fish-oil/omega-3
    if (/\bdha\b/i.test(productName) && sub !== 'omega-3' && sub !== 'fish-oil') {
      out.push({ cat: 'omega-fatty-acids', sub: 'dha' });
    }
  }

  // COLLAGEN
  if (ing.has('collagen')) {
    let sub = null;
    if (ing.has('marineCollagen')) sub = 'marine-collagen';
    else if (form.has('gummy')) sub = 'collagen-gummies';
    else if (form.has('powder')) sub = 'collagen-powder';
    else if (form.has('capsule')) sub = 'collagen-capsules';
    else if (form.has('tablet')) sub = 'collagen-tablets';
    else if (ing.has('hydrolyzedCollagen')) sub = 'collagen-peptides';
    out.push({ cat: 'collagen', sub });
  }

  // PROTEIN
  if (ing.has('whey') || ing.has('casein') || ing.has('plantProtein') || ing.has('massGainer') ||
      ing.has('bcaa') || ing.has('creatine') || ing.has('preWorkout') || ing.has('postWorkout') ||
      /\bprotein\b/i.test(productName)) {
    let sub = null;
    if (ing.has('creatine')) sub = 'creatine';
    else if (ing.has('bcaa')) sub = 'bcaa-eaa';
    else if (ing.has('massGainer')) sub = 'mass-gainers';
    else if (ing.has('preWorkout')) sub = 'pre-workout';
    else if (ing.has('postWorkout')) sub = 'post-workout';
    else if (ing.has('whey')) sub = 'whey-protein';
    else if (ing.has('plantProtein')) sub = 'plant-protein';
    else sub = 'protein-powder';
    out.push({ cat: 'protein', sub });
  }

  // HERBAL & NATURAL
  const hasHerbal = ing.has('ashwagandha') || ing.has('turmeric') || ing.has('ginseng') ||
    ing.has('moringa') || ing.has('spirulina') || ing.has('chlorella') || ing.has('greenTea') ||
    ing.has('garlic') || ing.has('ginger') || ing.has('echinacea') || ing.has('milkThistle') ||
    ing.has('aloe') || ing.has('adaptogen');
  if (hasHerbal) {
    let sub = null;
    if (ing.has('ashwagandha')) sub = 'ashwagandha';
    else if (ing.has('turmeric')) sub = 'turmeric-curcumin';
    else if (ing.has('ginseng')) sub = 'ginseng';
    else if (ing.has('moringa')) sub = 'moringa';
    else if (ing.has('greenTea')) sub = 'green-tea-extract';
    else if (ing.has('garlic')) sub = 'garlic';
    else if (ing.has('ginger')) sub = 'ginger';
    else if (ing.has('aloe')) sub = 'aloe-vera';
    else if (ing.has('adaptogen')) sub = 'adaptogens';
    out.push({ cat: 'herbal-supplements', sub });
  }

  // PROBIOTICS & GUT
  if (ing.has('probiotic') || ing.has('prebiotic') || ing.has('digestiveEnzyme') ||
      ing.has('fiber') || goal.has('detox')) {
    let sub = null;
    if (ing.has('probiotic')) sub = 'probiotics';
    else if (ing.has('prebiotic')) sub = 'prebiotics';
    else if (ing.has('digestiveEnzyme')) sub = 'digestive-enzymes';
    else sub = 'digestive-supplements';
    out.push({ cat: 'probiotics-gut-health', sub });
  }

  // BEAUTY (hair / skin / nails / collagen-for-beauty / biotin / hyaluronic)
  if (goal.has('hair') || goal.has('skin') || goal.has('nail') || goal.has('antiAging') ||
      ing.has('biotin') || ing.has('hyaluronic') ||
      (ing.has('collagen') && (form.has('gummy') || form.has('powder')))) {
    let sub = null;
    if (goal.has('antiAging')) sub = 'anti-aging';
    else if (goal.has('hair') || ing.has('biotin')) sub = 'hair-growth';
    else if (goal.has('nail')) sub = 'nail-support';
    else sub = 'skin';
    out.push({ cat: 'beauty-supplements', sub });
  }

  // KIDS & FAMILY
  if (aud.has('kids') || aud.has('teen')) {
    let sub = null;
    if (aud.has('teen')) sub = 'teen';
    else if (ing.has('multivitamin') || /\bmultivitamin\b/i.test(productName)) sub = 'multivitamins';
    else if (goal.has('immune')) sub = 'immunity';
    else if (goal.has('brain')) sub = 'brain-development';
    else sub = 'family-wellness';
    out.push({ cat: 'kids-family', sub });
  }

  // WOMEN'S HEALTH
  if (aud.has('women') || aud.has('prenatal') || aud.has('postnatal') || goal.has('hormonal') || ing.has('menopause')) {
    let sub = null;
    if (aud.has('prenatal')) sub = 'prenatal';
    else if (aud.has('postnatal')) sub = 'postnatal';
    else if (ing.has('menopause')) sub = 'menopause-support';
    else if (goal.has('hormonal')) sub = 'hormonal-balance';
    else if (ing.has('iron')) sub = 'iron-support';
    else sub = 'multivitamins';
    out.push({ cat: 'womens-health', sub });
  }

  // MEN'S HEALTH
  if (aud.has('men') || ing.has('testosterone') || ing.has('prostate')) {
    let sub = null;
    if (ing.has('prostate')) sub = 'prostate-health';
    else if (ing.has('testosterone')) sub = 'testosterone-support';
    else if (goal.has('energy')) sub = 'energy-stamina';
    else if (ing.has('creatine') || ing.has('bcaa')) sub = 'muscle-support';
    else sub = 'multivitamins';
    out.push({ cat: 'mens-health', sub });
  }

  // WEIGHT MANAGEMENT
  if (goal.has('weightLoss') || goal.has('weightGain') || goal.has('appetite') ||
      ing.has('massGainer') || ing.has('thermogenic') || ing.has('appetite') || /\bfat burner\b/i.test(productName)) {
    let sub = null;
    if (ing.has('appetite') || goal.has('appetite')) sub = 'appetite-suppressants';
    else if (ing.has('thermogenic') || /\bfat burner\b/i.test(productName)) sub = 'fat-burners';
    else if (goal.has('weightGain') || ing.has('massGainer')) sub = 'weight-gain';
    else sub = 'weight-loss';
    out.push({ cat: 'weight-management', sub });
  }

  // HEALTH GOALS
  if (goal.size > 0 || ing.has('kidney')) {
    let sub = null;
    if (goal.has('immune')) sub = 'immunity-support';
    else if (goal.has('sleep')) sub = 'sleep-support';
    else if (goal.has('stress')) sub = 'stress-anxiety-support';
    else if (goal.has('energy')) sub = 'energy-fatigue';
    else if (goal.has('brain')) sub = 'brain-memory';
    else if (goal.has('heart')) sub = 'heart-health';
    else if (goal.has('joint') || goal.has('bone')) sub = 'bone-joint-health';
    else if (goal.has('liver')) sub = 'liver-support';
    else if (goal.has('kidney') || ing.has('kidney')) sub = 'kidney-support';
    else if (goal.has('eye')) sub = 'eye-health';
    if (sub) out.push({ cat: 'health-goals', sub });
  }

  // SPECIALTY (antioxidants / coq10 / etc.)
  if (ing.has('coq10') || ing.has('resveratrol') || ing.has('glutathione') ||
      ing.has('astaxanthin') || ing.has('lutein') || ing.has('melatonin') ||
      ing.has('glucosamine') || ing.has('chondroitin') || ing.has('msm') ||
      ing.has('kidney')) {
    let sub = null;
    if (ing.has('coq10') || ing.has('resveratrol') || ing.has('glutathione') || ing.has('astaxanthin')) sub = 'antioxidants';
    else if (ing.has('glucosamine') || ing.has('chondroitin') || ing.has('msm')) sub = 'bones-joints';
    else if (ing.has('lutein')) sub = 'eye-health';
    else if (ing.has('melatonin')) sub = 'sleep';
    else if (ing.has('kidney')) sub = 'kidney-support';
    out.push({ cat: 'specialty-supplements', sub });
  }

  // LIFESTYLE
  if (life.size > 0) {
    let sub = null;
    if (life.has('organic')) sub = 'organic';
    else if (life.has('vegan')) sub = 'vegan';
    else if (life.has('vegetarian')) sub = 'vegetarian';
    else if (life.has('halal')) sub = 'halal';
    else if (life.has('glutenFree')) sub = 'gluten-free';
    else if (life.has('sugarFree')) sub = 'sugar-free';
    else if (life.has('nonGmo')) sub = 'non-gmo';
    out.push({ cat: 'lifestyle-supplements', sub });
  }

  // SUPPLEMENT FORMS (every product with a detected form)
  if (form.size > 0) {
    let sub = null;
    if (form.has('gummy')) sub = 'gummies';
    else if (form.has('softgel')) sub = 'softgels';
    else if (form.has('capsule')) sub = 'capsules';
    else if (form.has('tablet')) sub = 'tablets';
    else if (form.has('powder')) sub = 'powders';
    else if (form.has('liquid')) sub = 'liquids';
    else if (form.has('effervescent')) sub = 'effervescent';
    out.push({ cat: 'supplement-forms', sub });
  }

  return out;
}

function buildTagsFromDetection(d) {
  const out = [];
  d.form.forEach(f      => out.push(`form:${f}`));
  d.lifestyle.forEach(l => out.push(`lifestyle:${l}`));
  d.audience.forEach(a  => out.push(`audience:${a}`));
  return out;
}

async function main() {
  // Load all categories + subcategories into a slug→id map
  const cats = (await pool.query(`SELECT id, slug FROM categories`)).rows;
  const catBySlug = Object.fromEntries(cats.map(c => [c.slug, c]));
  const subs = (await pool.query(`SELECT id, slug, category_id FROM subcategories`)).rows;
  const subBySlugAndCat = {};
  subs.forEach(s => {
    const catSlug = cats.find(c => c.id === s.category_id)?.slug;
    if (!catSlug) return;
    subBySlugAndCat[`${catSlug}/${s.slug}`] = s;
  });

  const products = (await pool.query(`
    SELECT id, slug, name, description, brand, tags, category_id, subcategory_id,
           additional_category_ids, additional_subcategory_ids, category_slug, subcategory_slug
    FROM products
  `)).rows;

  let touched = 0;
  let placedTotal = 0;
  const stats = {}; // { 'cat/sub': count }
  const missingSubs = new Set(); // routes that point to a slug that doesn't exist

  for (const p of products) {
    const hay = [p.name || '', p.description || '', p.brand || '', Array.isArray(p.tags) ? p.tags.join(' ') : ''].join(' \n ');
    const detected = detectAll(hay);
    const placements = placementsFor(detected, p.name || '');
    if (placements.length === 0) continue;

    const newAdditional = new Set(Array.isArray(p.additional_category_ids) ? p.additional_category_ids : []);
    const newAdditionalSubs = new Set(Array.isArray(p.additional_subcategory_ids) ? p.additional_subcategory_ids : []);
    let newSubId = p.subcategory_id;
    let newSubSlug = p.subcategory_slug;
    let needSub = !p.subcategory_id;

    for (const place of placements) {
      const cat = catBySlug[place.cat];
      if (!cat) continue;
      placedTotal++;
      const key = place.sub ? `${place.cat}/${place.sub}` : place.cat;
      stats[key] = (stats[key] || 0) + 1;

      // Tag top-level if not primary
      if (p.category_id !== cat.id) newAdditional.add(cat.id);

      if (place.sub) {
        const subRow = subBySlugAndCat[`${place.cat}/${place.sub}`];
        if (!subRow) {
          missingSubs.add(`${place.cat}/${place.sub}`);
        } else if (needSub && p.category_id === cat.id) {
          // Use as primary subcategory only when product had no sub at all AND it's in primary cat
          newSubId = subRow.id;
          newSubSlug = place.sub;
          needSub = false;
        } else if (subRow.id !== p.subcategory_id) {
          // Otherwise add as an additional subcategory
          newAdditionalSubs.add(subRow.id);
        }
      }
    }

    const newAdditionalArr = Array.from(newAdditional);
    const newAdditionalSubsArr = Array.from(newAdditionalSubs);
    const tags = Array.from(new Set([...(Array.isArray(p.tags) ? p.tags : []), ...buildTagsFromDetection(detected)]));

    const changed =
      newAdditionalArr.length !== (p.additional_category_ids?.length || 0) ||
      newAdditionalSubsArr.length !== (p.additional_subcategory_ids?.length || 0) ||
      newSubId !== p.subcategory_id ||
      tags.length !== (p.tags?.length || 0);

    if (changed) {
      touched++;
      if (APPLY) {
        await pool.query(
          `UPDATE products SET additional_category_ids=$1::jsonb, additional_subcategory_ids=$2::jsonb, subcategory_id=$3, subcategory_slug=$4, tags=$5::jsonb, updated_at=NOW() WHERE id=$6`,
          [JSON.stringify(newAdditionalArr), JSON.stringify(newAdditionalSubsArr), newSubId, newSubSlug, JSON.stringify(tags), p.id]
        );
      }
    }
  }

  console.log(`\nProducts scanned: ${products.length}`);
  console.log(`Products with at least one placement change: ${touched}`);
  console.log(`Total placements (cat or cat/sub): ${placedTotal}\n`);
  console.log(`=== Placement counts ===`);
  Object.entries(stats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

  if (missingSubs.size) {
    console.log(`\n=== Subcategory slugs referenced by classifier but NOT in DB ===`);
    Array.from(missingSubs).sort().forEach(s => console.log(`  ${s}`));
  }

  console.log(`\nMode: ${APPLY ? 'APPLIED' : 'PREVIEW (use --apply to write)'}`);
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
