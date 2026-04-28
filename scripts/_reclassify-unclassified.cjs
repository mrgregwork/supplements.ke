// Reclassifies products that have subcategory_id = NULL.
// For each such product, runs classifier logic and takes the BEST placement
// (first one that has both a category and subcategory), then updates:
//   category_id, category_slug, subcategory_id, subcategory_slug
//
// Usage:
//   node scripts/_reclassify-unclassified.cjs          (preview)
//   node scripts/_reclassify-unclassified.cjs --apply  (write to DB)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const APPLY = process.argv.includes('--apply');

function rx(...phrases) {
  const esc = phrases.map(p => p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^a-z0-9])(?:${esc.join('|')})(?=$|[^a-z0-9])`, 'i');
}

// Rules are checked in order — first match wins.
// All subcategory slugs verified against DB.
const RULES = [
  // ─── vitamins ───
  { cat: 'vitamins', sub: 'vitamin-b-complex', rx: rx('b-complex','b complex','biotin','pantothenic','folate','folic acid','b12','methylcobalamin','pyridoxal','benfotiamine','niacin','riboflavin','thiamine') },
  { cat: 'vitamins', sub: 'vitamin-c',         rx: rx('vitamin c','ascorbic','ascorbate','quercetin','ascorbyl palmitate') },
  { cat: 'vitamins', sub: 'vitamin-d',         rx: rx('vitamin d','d3','d 3','cholecalciferol','bone restore','bone strength','dr strum') },
  { cat: 'vitamins', sub: 'vitamin-k',         rx: rx('vitamin k','k2','menaquinone','phylloquinone') },
  { cat: 'vitamins', sub: 'skin-hair-nails',   rx: rx('vitamin e','tocopherol','tocotrienol','gamma e','gamma-e','biotin') },
  { cat: 'vitamins', sub: 'multivitamins',     rx: rx('multivitamin','multi vitamin','two per day','one per day','daily formula','health booster','prenatal advantage','once daily') },

  // ─── minerals ───
  { cat: 'minerals', sub: 'magnesium',         rx: rx('magnesium') },
  { cat: 'minerals', sub: 'calcium',           rx: rx('calcium') },
  { cat: 'minerals', sub: 'zinc',              rx: rx('zinc') },
  { cat: 'minerals', sub: 'selenium',          rx: rx('selenium') },
  { cat: 'minerals', sub: 'iodine',            rx: rx('iodine','potassium iodide') },
  { cat: 'minerals', sub: 'potassium',         rx: rx('potassium') },
  { cat: 'minerals', sub: 'trace-minerals',    rx: rx('boron','chromium','molybdenum','strontium','trace mineral') },

  // ─── omega-fatty-acids ───
  { cat: 'omega-fatty-acids', sub: 'krill-oil',    rx: rx('krill') },
  { cat: 'omega-fatty-acids', sub: 'flaxseed-oil', rx: rx('flaxseed','flax seed','flax oil') },
  { cat: 'omega-fatty-acids', sub: 'fish-oil',     rx: rx('fish oil','mega epa','super omega') },
  { cat: 'omega-fatty-acids', sub: 'omega-3',      rx: rx('omega.3','epa','dha','mega gla','gla') },

  // ─── probiotics-gut-health ───
  { cat: 'probiotics-gut-health', sub: 'digestive-enzymes', rx: rx('digestive enzyme','bromelain','papain','lipase','amylase','protease','extraordinary enzyme','mastic') },
  { cat: 'probiotics-gut-health', sub: 'probiotics',        rx: rx('probiotic','lactobacillus','bifido','florassist','boulardii','saccharomyces') },
  { cat: 'probiotics-gut-health', sub: 'prebiotics',        rx: rx('prebiotic','inulin','fos','fiber','psyllium') },

  // ─── protein ───
  { cat: 'protein', sub: 'whey-protein',  rx: rx('whey') },
  { cat: 'protein', sub: 'bcaa-eaa',      rx: rx('bcaa','eaa','branched chain amino') },
  { cat: 'protein', sub: 'creatine',      rx: rx('creatine') },

  // ─── collagen ───
  { cat: 'collagen', sub: 'marine-collagen', rx: rx('marine collagen') },
  { cat: 'collagen', sub: 'collagen-powder', rx: rx('collagen peptide','hydrolyzed collagen','collagen powder') },
  { cat: 'collagen', sub: 'collagen-tablets',rx: rx('collagen tablet','collagen pill') },

  // ─── womens-health ───
  { cat: 'womens-health', sub: 'prenatal',          rx: rx('prenatal','pregnancy') },
  { cat: 'womens-health', sub: 'menopause-support', rx: rx('menopause','black cohosh','estrogen','hot flash','bi-est','breast health','breast formula') },
  { cat: 'womens-health', sub: 'hormonal-balance',  rx: rx('hormonal balance','hormone balance','menstrual','pcos','vitex','progesterone','chaste berry','isoflavone','soy isoflavone') },
  { cat: 'womens-health', sub: 'multivitamins',     rx: rx("women's multi","women multi","female multi") },

  // ─── mens-health ───
  { cat: 'mens-health', sub: 'prostate-health',      rx: rx('prostate','saw palmetto','palmettoguard','beta.sitosterol','ultra prostate') },
  { cat: 'mens-health', sub: 'testosterone-support', rx: rx('testosterone','tribulus','tongkat','d-aspartic') },
  { cat: 'mens-health', sub: 'performance-supplements', rx: rx('sexual support','erectile','libido','miraforte','horny goat','male vascular') },

  // ─── weight-management ───
  { cat: 'weight-management', sub: 'appetite-suppressants', rx: rx('appetite','glucomannan','garcinia','waistline','body trim') },
  { cat: 'weight-management', sub: 'fat-burners',           rx: rx('fat burn','thermogenic','cla','forskolin') },
  { cat: 'weight-management', sub: 'weight-loss',           rx: rx('weight loss','slim','diet') },
  { cat: 'weight-management', sub: 'metabolism-boosters',   rx: rx('metabolism','metabolic','berberine','blood sugar','ampk') },

  // ─── herbal-supplements ───
  { cat: 'herbal-supplements', sub: 'ashwagandha',       rx: rx('ashwagandha','withania') },
  { cat: 'herbal-supplements', sub: 'turmeric-curcumin', rx: rx('turmeric','curcumin','megafood turmeric') },
  { cat: 'herbal-supplements', sub: 'ginseng',           rx: rx('ginseng','asian energy boost') },
  { cat: 'herbal-supplements', sub: 'green-tea-extract', rx: rx('green tea','egcg','mega green tea') },
  { cat: 'herbal-supplements', sub: 'adaptogens',        rx: rx('rhodiola','adaptogen','cistanche','saffron','lactoferrin','elderberry','sambucus','milk thistle','silymarin') },
  { cat: 'herbal-supplements', sub: 'plant-based',       rx: rx('xi xian','yi mu cao','chinese herb','chlorophyllin','peony','bilberry','pomegranate','applewise','fisetin','moringa','spirulina','chlorella','aloe') },
  { cat: 'herbal-supplements', sub: 'garlic',            rx: rx('garlic','allicin') },

  // ─── health-goals ───
  { cat: 'health-goals', sub: 'immunity-support',   rx: rx('immune','immunity') },
  { cat: 'health-goals', sub: 'sleep-support',      rx: rx('sleep','insomnia','enhanced sleep') },
  { cat: 'health-goals', sub: 'brain-memory',       rx: rx('brain','cognitive','memory','focus','nootropic','quick brain','dmae','citicoline','cdp.choline','phosphatidyl','homocysteine') },
  { cat: 'health-goals', sub: 'heart-health',       rx: rx('heart','cardio','cardiovascular','cholesterol','blood pressure','optimal bp','bergamot','nattokinase','advanced lipid','lipid control','uric acid') },
  { cat: 'health-goals', sub: 'bone-joint-health',  rx: rx('joint formula','intensive bone','glucosamine','chondroitin','msm') },
  { cat: 'health-goals', sub: 'liver-support',      rx: rx('liver','hepatopro','florassist liver','anti.alcohol') },
  { cat: 'health-goals', sub: 'eye-health',         rx: rx('eye','vision','macular','macuguard','lutein','zeaxanthin','bilberry eye') },
  { cat: 'health-goals', sub: 'energy-fatigue',     rx: rx('energy renew','d-ribose','ribose','nad.cell','nad\\+','adrenal energy','mitochondrial','pqq') },
  { cat: 'health-goals', sub: 'stress-anxiety-support', rx: rx('stress','cortisol.stress','anxiety','calm','cortisol balance') },
  { cat: 'health-goals', sub: 'digestive-health',   rx: rx('detox','cleanse','colon','bentonite','dgl','licorice','betaine','pepsin') },
  { cat: 'health-goals', sub: 'kidney-support',     rx: rx('kidney','gout','d mannose','urinary') },

  // ─── specialty-supplements ───
  { cat: 'specialty-supplements', sub: 'antioxidants',  rx: rx('coq10','ubiquinol','glutathione','astaxanthin','resveratrol','lipoic acid','r-lipoic','sod booster','dna protection','pqq','mitochondrial basics','geroprotect','ageless cell','autophagy','senolytic','stem cell','fisetin','nmn','nad','aeon','nicotinamide') },
  { cat: 'specialty-supplements', sub: 'stress-anxiety', rx: rx('stress','gaba','theanine','l-theanine','adrenal') },
  { cat: 'specialty-supplements', sub: 'sleep',          rx: rx('melatonin','sleep') },
  { cat: 'specialty-supplements', sub: 'bones-joints',   rx: rx('joint','glucosamine','chondroitin','msm','fast.acting joint','bone restore') },
  { cat: 'specialty-supplements', sub: 'heart-health',   rx: rx('cholesterol','cardiovascular','bergamot','nattokinase','lipid','diosmin','hesperidin') },
  { cat: 'specialty-supplements', sub: 'liver-support',  rx: rx('liver','hepato','milk thistle','silymarin') },
  { cat: 'specialty-supplements', sub: 'brain-cognitive', rx: rx('brain','nootropic','cognitive','memory','phosphatidyl','citicoline','alpha.gpc','dmae') },
  { cat: 'specialty-supplements', sub: 'immune-booster-packs', rx: rx('immune','immunity') },
  { cat: 'specialty-supplements', sub: 'herbal',         rx: rx('dhea','hormone','thyroid','adrenal','same ','s-adenosyl','tmg','trimethylglycine','lecithin','l-carnitine','carnitine','taurine','l-glutamine','glutamine','l-lysine','lysine','l-glycine','hmb','beta.hydroxy','serrapeptase','ip6','inositol','d-ribose','ribose','lactoferrin','colostrum','iodine','sea iodine','bifido','florassist') },
  { cat: 'specialty-supplements', sub: 'detox-cleanse',  rx: rx('detox','cleanse','colon') },
  { cat: 'specialty-supplements', sub: 'wellness-bundles', rx: /.*/ },  // catch-all
];

function bestPlacement(name, description, brand) {
  const hay = `${name} ${description} ${brand}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.rx.test(hay)) {
      return { cat: rule.cat, sub: rule.sub };
    }
  }
  return { cat: 'specialty-supplements', sub: 'general' };
}

async function main() {
  // Load category/subcategory ID maps
  const cats = (await pool.query(`SELECT id, slug FROM categories`)).rows;
  const catBySlug = Object.fromEntries(cats.map(c => [c.slug, c.id]));
  const subs = (await pool.query(`SELECT id, slug, category_id FROM subcategories`)).rows;
  const subByCatAndSlug = {};
  for (const s of subs) {
    const catSlug = cats.find(c => c.id === s.category_id)?.slug;
    if (catSlug) subByCatAndSlug[`${catSlug}/${s.slug}`] = s;
  }

  // Only target products with null subcategory_id
  const unclassified = (await pool.query(`
    SELECT id, slug, name, description, brand
    FROM products
    WHERE subcategory_id IS NULL
    ORDER BY name
  `)).rows;

  console.log(`Found ${unclassified.length} unclassified products.\n`);

  let applied = 0, skipped = 0, missing = 0;

  for (const p of unclassified) {
    const placement = bestPlacement(p.name || '', p.description || '', p.brand || '');
    const catId = catBySlug[placement.cat];
    const subRow = subByCatAndSlug[`${placement.cat}/${placement.sub}`];

    if (!catId) {
      console.log(`  ! Missing category: ${placement.cat} for "${p.name}"`);
      missing++;
      continue;
    }
    if (!subRow) {
      console.log(`  ! Missing subcategory: ${placement.cat}/${placement.sub} for "${p.name}"`);
      missing++;
      continue;
    }

    console.log(`  ${APPLY ? '✓' : '~'} "${p.name}" -> ${placement.cat}/${placement.sub}`);

    if (APPLY) {
      await pool.query(
        `UPDATE products
           SET category_id=$1, category_slug=$2, subcategory_id=$3, subcategory_slug=$4, updated_at=NOW()
         WHERE id=$5`,
        [catId, placement.cat, subRow.id, placement.sub, p.id]
      );
      applied++;
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Would apply'}: ${unclassified.length - missing} | Missing category/sub: ${missing}`);
  if (!APPLY) console.log('Dry run — use --apply to write to DB.');
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); }).then(() => pool.end());
