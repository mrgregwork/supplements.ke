'use strict';
/**
 * Generates long_description, short description, seo_title and seo_description
 * for every product in missing-descriptions.json.
 *
 * Pattern assignment (B / C / D) is derived from a DJB2 hash of the slug so
 * the rotation is deterministic but not obviously sequential.
 *
 * Output: scripts/data/all-descriptions.json  (same format as apply-product-descriptions.cjs expects)
 */

const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'data', 'missing-descriptions.json');
const OUTPUT = path.join(__dirname, 'data', 'all-descriptions.json');

const products = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// ─── hash ──────────────────────────────────────────────────────────────────────

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

// ─── ingredient classifier ─────────────────────────────────────────────────────

function classify(p) {
  const n  = (p.name  || '').toLowerCase();
  const cat = (p.category_slug    || '').toLowerCase();
  const sub = (p.subcategory_slug || '').toLowerCase();
  const all = `${n} ${cat} ${sub}`;

  if (/krill/.test(all))                                  return 'krill';
  if (/fish.oil|omega.3|epa|dha|anchovy|sardine/.test(all)) return 'omega3';
  if (/collagen/.test(all))                               return 'collagen';
  if (/probiotic|dophilus|lactobacillus|bifidobacterium|saccharomyces/.test(all)) return 'probiotic';
  if (/prebiotic|inulin|fos/.test(all))                   return 'prebiotic';
  if (/vitamin.d3?|cholecalciferol/.test(all))            return 'vitd';
  if (/vitamin.c|ascorbic/.test(all))                     return 'vitc';
  if (/b.12|b12|methylcobalamin|cyanocobalamin/.test(all)) return 'b12';
  if (/vitamin.b.complex|b.complex|b-complex|pantothenic|pantethine|biotin/.test(all)) return 'bcomplex';
  if (/folate|folic|methyl.folate|5-mthf|mthf/.test(all)) return 'folate';
  if (/vitamin.k2?|mk-7|mk-4|menaquinone/.test(all))     return 'vitk';
  if (/vitamin.e|tocopherol|tocotrienol/.test(all))       return 'vite';
  if (/multivitamin|multi.vitamin|two.per.day|one.a.day/.test(all)) return 'multi';
  if (/magnesium/.test(all))                              return 'magnesium';
  if (/zinc/.test(all))                                   return 'zinc';
  if (/iron|ferrous/.test(all))                           return 'iron';
  if (/calcium/.test(all))                                return 'calcium';
  if (/ashwagandha|sensoril|ksm/.test(all))               return 'ashwagandha';
  if (/turmeric|curcumin/.test(all))                      return 'turmeric';
  if (/coq10|ubiquinol|ubiquinone|co-q10/.test(all))      return 'coq10';
  if (/glutathione/.test(all))                            return 'glutathione';
  if (/resveratrol/.test(all))                            return 'resveratrol';
  if (/alpha.lipoic|alpha-lipoic/.test(all))              return 'ala';
  if (/theanine/.test(all))                               return 'theanine';
  if (/gaba/.test(all))                                   return 'gaba';
  if (/melatonin/.test(all))                              return 'melatonin';
  if (/5-htp|5htp|\(5\)-htp|five.*htp/.test(all))         return '5htp';
  if (/protein|whey|casein|plant.protein|pea.protein/.test(all)) return 'protein';
  if (/glucosamine|chondroitin|msm|joint|bone/.test(all)) return 'joint';
  if (/milk.thistle|silymarin|liver/.test(all))           return 'milkthistle';
  if (/berberine/.test(all))                              return 'berberine';
  if (/garcinia|forskolin|weight.loss|fat.burn|metabolism|carnitine/.test(all)) return 'weightmgmt';
  if (/astaxanthin/.test(all))                            return 'astaxanthin';
  if (/bilberry|lutein|zeaxanthin|eye/.test(all))         return 'eye';
  if (/hyaluronic/.test(all))                             return 'hyaluronic';
  if (/citicoline|cdp.choline|alpha.gpc|phosphatidylserine/.test(all)) return 'nootropic';
  if (/maca|ginseng|tongkat|testosterone|\bmens-health\b/.test(all)) return 'menshealth';
  if (/evening.primrose|borage/.test(all))                return 'gla';
  if (/d.ribose|nad\+|nad.cell|nicotinamide/.test(all))  return 'energy';
  if (/ip6|inositol/.test(all))                          return 'inositol';
  if (/mastic.gum|h\.pylori|helicobacter/.test(all))     return 'masticgum';
  if (/lactoferrin/.test(all))                           return 'lactoferrin';
  if (/taurine/.test(all))                               return 'taurine';
  if (/arginine|citrulline/.test(all))                   return 'arginine';
  if (/lysine/.test(all))                                return 'lysine';
  if (/tyrosine/.test(all))                              return 'tyrosine';
  if (/menopausal|menopause|black.cohosh|hormone/.test(all)) return 'womens';
  if (/prenatal|pregnancy|folate/.test(all))             return 'prenatal';
  if (/shilajit|fulvic/.test(all))                       return 'shilajit';
  if (/digestive.enzyme|bromelain|protease|amylase/.test(all)) return 'enzymes';
  if (/red.yeast.rice|bergamot|cholesterol|heart/.test(all)) return 'heart';
  if (/bentonite|clay|detox/.test(all))                  return 'clay';
  if (/colostrum|immune|beta.glucan|beta-glucan|elderberry|echinacea|oregano.oil|oil.of.oregano|yarrow|d.mannose|d-mannose/.test(all)) return 'immune';
  if (/hair|nail|biotin|keratin/.test(all))              return 'hairnail';
  if (/skin|beauty|hyaluronic|ceramide|sunscreen/.test(all)) return 'skin';
  if (/ginkgo/.test(all))                                return 'nootropic';
  if (/phosphatidylserine|ps.100|ps 100/.test(all))      return 'nootropic';
  if (/dim |diindolylmethane|dhea|estrogen|menopausal|menstrual|vitex|chaste.berry|hormonal.balance|womens.health/.test(all)) return 'womens';
  if (/hmb|beta.hydroxy.beta|weight.gain|hydroxycut/.test(all)) return 'protein';
  if (/tudca|tauroursodeoxycholic|artichoke/.test(all))  return 'milkthistle';
  if (/dgl|licorice/.test(all))                          return 'masticgum';
  if (/cholestoff|cholest.off|flaxseed/.test(all))       return 'heart';
  if (/sleep.gummy|sleep.gummies|restful.sleep/.test(all)) return 'melatonin';
  if (/serrapeptase|betaine.hcl|pepsin/.test(all))       return 'enzymes';
  if (/nmn|nicotinamide.mononucleotide|lithium.orotate/.test(all)) return 'nootropic';
  if (/glycine|glutamine|carnosine/.test(all))           return 'protein';
  if (/chinese.herb|herbal.tea|xi.xian|yi.mu/.test(all)) return 'immune';
  if (/focus|attention|concentration|cognitive/.test(all)) return 'nootropic';
  if (/diabetes|blood.sugar|blood sugar|glycemic|insulin/.test(all)) return 'berberine';
  if (/booty|body.shape|weight.gain/.test(all))           return 'protein';
  return 'general';
}

// ─── brand quality lines ────────────────────────────────────────────────────────

function brandQuality(brand) {
  const b = (brand || '').toLowerCase();
  if (b.includes('jarrow'))         return 'Jarrow Formulas products are manufactured in GMP-certified facilities and undergo third-party identity and purity testing. The brand has operated since 1977 with a consistent focus on research-driven formulations.';
  if (b.includes('life extension'))  return 'Life Extension produces supplements in NSF GMP-registered facilities with a four-decade track record in evidence-based nutrition science.';
  if (b.includes('vital proteins'))  return 'Vital Proteins is one of the most recognised collagen supplement brands globally, with products sold in major retailers across 50 countries and a focus on clean, traceable sourcing.';
  if (b.includes('nutricost'))       return 'Nutricost manufactures in GMP-certified US facilities and provides third-party Certificates of Analysis. The brand is recognised for competitive pricing without cutting corners on ingredient quality.';
  if (b.includes('sports research')) return 'Sports Research holds non-GMO Project verification on its core products and manufactures in GMP-certified facilities, with many products also carrying NSF or Informed Sport certification.';
  if (b.includes('nature made'))     return 'Nature Made is USP Verified on many of its products — a voluntary third-party programme that confirms potency, purity, and label accuracy.';
  if (b.includes('nature\'s craft') || b.includes('natures craft')) return 'Nature\'s Craft formulates in GMP-certified facilities with a focus on clean, additive-free supplement products.';
  if (b.includes('doctor\'s best') || b.includes('doctors best')) return 'Doctor\'s Best was founded by a physician with the goal of evidence-based supplement formulations that use the most bioavailable ingredient forms available.';
  if (b.includes('neocell'))         return 'NeoCell is a specialist collagen brand with over two decades of product development in collagen peptides, and one of the most widely distributed collagen supplement brands in the world.';
  if (b.includes('now foods') || b.includes('now supplements')) return 'NOW Foods has been a trusted supplement manufacturer since 1968, operating one of the largest GMP-certified supplement facilities in North America.';
  if (b.includes('qunol'))           return 'Qunol specialises in CoQ10 supplementation and uses patented water- and fat-soluble formulations that clinical studies show absorb better than standard CoQ10 products.';
  if (b.includes('megafood'))        return 'MegaFood uses a whole-food fermentation process for many of its vitamins and minerals, producing nutrients in a food matrix that the body recognises.';
  if (b.includes('maryruth'))        return 'MaryRuth Organics produces USDA-certified organic and non-GMO verified supplements, with a focus on clean labels and family-friendly product formats.';
  if (b.includes('olly'))            return 'Olly formulates gummy vitamins with functional blends that combine established nutrients with newer research-backed ingredients, with a focus on taste and compliance.';
  if (b.includes('one a day'))       return 'One A Day by Bayer is one of the most established multivitamin brands in the US market, with over 60 years of consumer trust.';
  if (b.includes('centrum'))         return 'Centrum by Pfizer is the world\'s number-one physician-recommended multivitamin brand, backed by decades of clinical research and available in over 70 countries.';
  if (b.includes('dymatize'))        return 'Dymatize is a sport nutrition brand trusted by competitive athletes and certified to NSF Certified for Sport standards — tested for over 270 substances banned by major sports organisations.';
  if (b.includes('optimum nutrition')) return 'Optimum Nutrition is the world\'s best-selling sports nutrition brand, with their Gold Standard line holding NSF Certified for Sport status.';
  if (b.includes('orgain'))          return 'Orgain produces USDA-certified organic protein products, using plant-based and grass-fed dairy protein sources with clean, simple ingredient lists.';
  if (b.includes('transparent labs')) return 'Transparent Labs publishes full third-party Certificates of Analysis for every product batch on their website, a rarity in the supplement industry.';
  if (b.includes('double wood'))     return 'Double Wood Supplements focuses on nootropic and cognitive health formulations, sourcing high-quality patented ingredients and publishing third-party test results.';
  return `${brand || 'This brand'} products are manufactured under GMP quality standards and stocked by Supplements Kenya from verified, authorised channels.`;
}

// ─── short description builders ────────────────────────────────────────────────

function buildShort(p, type) {
  const name  = cleanName(p.name);
  const brand = p.brand || '';
  const attrs = p.attributes || [];

  const specLine = attrs.length > 0
    ? attrs.slice(0, 2).map(a => `${a.value} ${a.name}`).join(', ') + '. '
    : '';

  const phrases = {
    krill:      `${specLine}Antarctic krill oil supplying EPA and DHA as phospholipids plus natural astaxanthin — absorbed more efficiently than standard fish oil triglycerides.`,
    omega3:     `${specLine}Concentrated fish oil delivering EPA and DHA omega-3 fatty acids for cardiovascular, cognitive, and inflammatory support.`,
    collagen:   `${specLine}Hydrolysed collagen peptides to support skin elasticity, joint flexibility, hair strength, and connective tissue throughout the body.`,
    probiotic:  `${specLine}Multi-strain probiotic for gut microbiome support, digestive comfort, and immune health.`,
    prebiotic:  `${specLine}Prebiotic fibre that selectively feeds beneficial gut bacteria, supporting microbiome diversity and digestive regularity.`,
    vitd:       `${specLine}Vitamin D3 (cholecalciferol) for immune defence, bone density, mood, and overall hormonal health.`,
    vitc:       `${specLine}Vitamin C for immune function, collagen synthesis, antioxidant defence, and iron absorption.`,
    b12:        `${specLine}Vitamin B12 in highly absorbable form for energy metabolism, red blood cell production, and nervous system health.`,
    bcomplex:   `${specLine}Complete B-vitamin complex for energy production, nervous system function, and homocysteine metabolism.`,
    folate:     `${specLine}Active folate (5-MTHF) for DNA synthesis, neural tube development support, and homocysteine regulation.`,
    vitk:       `${specLine}Vitamin K2 for directing calcium to bones and away from arteries, supporting both bone density and arterial flexibility.`,
    vite:       `${specLine}Vitamin E as mixed tocopherols and tocotrienols for antioxidant protection of cell membranes and cardiovascular health.`,
    multi:      `${specLine}Comprehensive multivitamin with bioavailable forms of key vitamins and minerals for daily nutritional coverage.`,
    magnesium:  `${specLine}Highly bioavailable magnesium for heart function, bone density, muscle and nerve health, and stress regulation.`,
    zinc:       `${specLine}Zinc for immune function, testosterone production, wound healing, skin health, and taste and smell.`,
    iron:       `${specLine}Iron supplement for red blood cell production, oxygen transport, and prevention of iron-deficiency anaemia.`,
    calcium:    `${specLine}Calcium for bone and teeth mineralisation, muscle contraction, nerve signalling, and blood pressure regulation.`,
    ashwagandha:`${specLine}Standardised ashwagandha adaptogen for stress resilience, cortisol regulation, sleep quality, and sustained energy.`,
    turmeric:   `${specLine}Curcumin-rich turmeric extract with enhanced absorption for anti-inflammatory, joint, and antioxidant support.`,
    coq10:      `${specLine}Coenzyme Q10 for mitochondrial energy production, antioxidant protection, and cardiovascular health.`,
    glutathione:`${specLine}Reduced glutathione — the body's primary intracellular antioxidant — for detoxification, immune function, and cellular protection.`,
    resveratrol:`${specLine}Trans-resveratrol polyphenol for cardiovascular, cellular ageing, and anti-inflammatory support.`,
    ala:        `${specLine}Alpha lipoic acid as a universal antioxidant active in both fat and water environments, supporting glucose metabolism and nerve health.`,
    theanine:   `${specLine}L-theanine for calm, focused alertness, stress reduction, and improved sleep quality without sedation.`,
    gaba:       `${specLine}GABA for stress relief, anxiolytic support, and sleep quality as part of a relaxation supplement routine.`,
    melatonin:  `${specLine}Melatonin for sleep onset, circadian rhythm reset, and jet lag recovery.`,
    '5htp':     `${specLine}5-HTP as a serotonin precursor for mood support, appetite regulation, and sleep quality.`,
    protein:    `${specLine}High-quality protein supplement for muscle recovery, lean mass maintenance, and daily protein target support.`,
    joint:      `${specLine}Glucosamine, chondroitin, and MSM joint complex for cartilage support, joint flexibility, and connective tissue health.`,
    milkthistle:`${specLine}Silymarin-rich milk thistle extract for liver cell protection, hepatic detoxification, and antioxidant defence.`,
    berberine:  `${specLine}Berberine extract for blood glucose regulation, insulin sensitivity, gut microbiome support, and cardiovascular health.`,
    weightmgmt: `${specLine}Weight management supplement supporting fat metabolism, appetite regulation, or energy expenditure as part of a structured diet.`,
    astaxanthin:`${specLine}Natural astaxanthin — one of the most potent carotenoid antioxidants — for skin photoprotection, eye health, and exercise recovery.`,
    eye:        `${specLine}Eye health formula with lutein, zeaxanthin, and supporting antioxidants for macular health and visual acuity.`,
    hyaluronic: `${specLine}Hyaluronic acid for skin hydration, joint lubrication, and connective tissue support.`,
    nootropic:  `${specLine}Nootropic compound for brain energy metabolism, focus, memory, and cognitive performance.`,
    menshealth: `${specLine}Men's health formula for testosterone support, energy, vitality, and reproductive health.`,
    gla:        `${specLine}GLA-rich botanical oil for hormonal balance, skin hydration, inflammatory regulation, and women's health.`,
    energy:     `${specLine}Cellular energy compound supporting mitochondrial ATP production and energy metabolism.`,
    inositol:   `${specLine}Inositol for cellular signalling, insulin sensitivity, mood regulation, and ovarian function support.`,
    masticgum:  `${specLine}Mastic gum for gastric lining support, H. pylori management, and upper digestive comfort.`,
    lactoferrin:`${specLine}Lactoferrin — an iron-binding glycoprotein — for immune activation, gut mucosal defence, and iron bioavailability.`,
    taurine:    `${specLine}Taurine for cardiovascular function, electrolyte balance, retinal health, and exercise recovery.`,
    arginine:   `${specLine}Arginine as a nitric oxide precursor for circulation, blood pressure, exercise performance, and recovery.`,
    lysine:     `${specLine}L-lysine for collagen synthesis, immune function, and management of herpes simplex outbreaks.`,
    tyrosine:   `${specLine}L-tyrosine as a precursor to dopamine, norepinephrine, and thyroid hormones for focus, mood, and stress tolerance.`,
    womens:     `${specLine}Women's health formula addressing hormonal balance, menopausal symptoms, and female-specific nutritional needs.`,
    prenatal:   `${specLine}Prenatal supplement supporting healthy fetal development, maternal nutrition, and healthy pregnancy outcomes.`,
    shilajit:   `${specLine}Shilajit fulvic acid complex for mitochondrial energy, testosterone support, cognitive function, and mineral bioavailability.`,
    enzymes:    `${specLine}Digestive enzyme blend to support macronutrient breakdown, reduce bloating, and optimise nutrient absorption.`,
    heart:      `${specLine}Cardiovascular support formula for healthy cholesterol levels, arterial flexibility, and circulatory health.`,
    clay:       `${specLine}Bentonite clay for external skin detoxification, pore cleansing, and drawing out impurities.`,
    immune:     `${specLine}Immune support formula combining clinically studied nutrients for robust innate and adaptive immune function.`,
    hairnail:   `${specLine}Hair, skin, and nail formula combining biotin, collagen precursors, and micronutrients for structural protein synthesis.`,
    skin:       `${specLine}Skin health supplement with antioxidants, hydration-supporting compounds, and collagen precursors.`,
    general:    `${specLine}Premium quality ${p.category_slug ? p.category_slug.replace(/-/g, ' ') : 'supplement'} from ${brand || 'a trusted brand'}.`,
  };

  const base = phrases[type] || phrases.general;
  return `${base} Available from Supplements Kenya with fast delivery across Kenya.`;
}

// ─── long description builders ─────────────────────────────────────────────────

// Prose fragments per type — varied enough that same-category products
// read differently when pattern + hash mix them differently.

const INTRO_A = {
  krill:      `Antarctic krill are tiny crustaceans that live in the southern ocean and form the base of the marine food chain. Because krill are so small and short-lived, they accumulate almost no heavy metals or environmental contaminants — a meaningful advantage over predatory fish used in standard omega-3 supplements. More importantly for supplementation, krill oil carries its EPA and DHA in phospholipid form rather than the triglyceride form found in fish oil, which changes how those fatty acids are handled by the body.`,
  omega3:     `Omega-3 fatty acids — EPA and DHA specifically — cannot be synthesised by the body in meaningful quantities from dietary precursors. They must come from food or supplementation. For most adults in Kenya whose diet does not include frequent servings of fatty fish, a quality fish oil supplement is the most reliable way to maintain blood omega-3 levels in the range that supports cardiovascular, cognitive, and inflammatory health.`,
  collagen:   `Collagen is the structural protein that holds skin firm, keeps joints cushioned, and gives tendons and ligaments their tensile strength. The body produces its own collagen continuously throughout life, but this synthesis declines from the mid-twenties onward — a process that accelerates with UV exposure, smoking, high sugar intake, and natural ageing. Supplemental hydrolysed collagen peptides provide the amino acid building blocks that support the body's own collagen-making machinery.`,
  probiotic:  `The gut microbiome — the trillion-strong population of bacteria, yeasts, and archaea living in the digestive tract — plays a far broader role in health than digestion alone. It regulates immune responses, produces short-chain fatty acids that feed the gut lining, synthesises certain vitamins, and influences brain chemistry via the gut-brain axis. Maintaining a diverse, Lactobacillus-rich microbiome is one of the most concrete things you can do for long-term health, and targeted probiotic supplementation is among the best-studied tools for achieving that.`,
  vitd:       `Vitamin D functions more like a hormone than a vitamin. Every tissue in the body has vitamin D receptors, and adequate levels are required for normal immune function, calcium absorption, muscle strength, mood regulation, and hundreds of gene expression pathways. Despite Kenya's equatorial sunshine, vitamin D insufficiency is widespread — indoor work, sunscreen use, darker skin tones, and clothing coverage all reduce dermal synthesis significantly.`,
  vitc:       `Vitamin C is a water-soluble antioxidant and enzyme cofactor with a role in nearly every major physiological process. It drives the hydroxylation reactions that synthesise collagen — without adequate vitamin C, wound healing and connective tissue maintenance are impaired. It recycles other antioxidants including vitamin E and glutathione. And it supports immune function through multiple pathways, from enhancing white blood cell activity to reducing the duration of respiratory infections.`,
  b12:        `Vitamin B12 is unique among water-soluble vitamins: the body can store it for years in the liver, yet deficiency is still surprisingly common. Absorption requires intrinsic factor secreted by the stomach lining, which declines with age, medications like metformin and proton pump inhibitors, and some digestive conditions. People following plant-based diets have essentially no dietary source of B12 and require supplementation. The neurological consequences of prolonged deficiency — peripheral neuropathy, cognitive decline — can be irreversible if not corrected.`,
  bcomplex:   `The eight B vitamins are a family of water-soluble cofactors that collectively drive energy metabolism, DNA synthesis, neurotransmitter production, and the methylation cycle — the biochemical relay that controls gene expression, detoxification, and the conversion of homocysteine to harmless methionine. Because they work together, deficiency in one often disrupts the function of others, and the most common deficiencies (B12, folate, B6) tend to appear as a cluster.`,
  multi:      `A quality multivitamin does not replace a good diet — but it efficiently covers the gaps that almost every diet produces. Food-first nutrition is the right principle, but surveys consistently show that most adults are low in at least three micronutrients even on ostensibly healthy diets. The vitamins most commonly under-consumed in modern diets include D, K2, magnesium, B12, and zinc — and a comprehensive multivitamin addresses all of them at once.`,
  magnesium:  `Magnesium is the fourth most abundant mineral in the human body and a cofactor in more than 300 enzymatic reactions. It regulates muscle and nerve function, blood pressure, blood sugar, and protein synthesis. It is also required to convert vitamin D to its active form and to transport calcium into bone. Despite its central importance, dietary magnesium insufficiency is one of the most prevalent nutrient shortfalls in modern populations, and supplementation is among the most impactful low-risk nutritional interventions for most adults.`,
  zinc:       `Zinc is an essential trace mineral involved in immune function, protein synthesis, wound healing, DNA production, and reproductive health. It acts as a cofactor for over 300 enzymes and a structural element in hundreds of transcription factors that regulate gene expression. Zinc deficiency impairs immune responses more profoundly than almost any other single nutritional shortfall, which is why zinc is among the nutrients most studied during respiratory illness.`,
  iron:       `Iron is the central mineral in haemoglobin — the protein in red blood cells that carries oxygen from the lungs to every tissue in the body. Iron deficiency anaemia is the most common nutritional deficiency worldwide, and it is particularly prevalent in women of reproductive age, adolescents, pregnant women, vegetarians, and people with high athletic training volumes. Fatigue, poor concentration, cold intolerance, and pallor are classic signs of sub-optimal iron status.`,
  ashwagandha:`Ashwagandha (Withania somnifera) has been used in Ayurvedic medicine for over three thousand years as a rasayana — a rejuvenating tonic for stress, vitality, and longevity. In the past two decades it has become one of the most studied adaptogens in the clinical literature, with randomised controlled trials consistently showing meaningful reductions in perceived stress, salivary cortisol, and anxiety scores at doses of 300–600 mg of standardised extract per day.`,
  turmeric:   `Curcumin, the primary bioactive compound in turmeric root, is one of the most researched plant polyphenols in nutritional science — yet paradoxically, one of the hardest to effectively supplement. Raw turmeric powder contains only 2–5% curcumin by weight, and that curcumin is poorly absorbed from the gut without a bioavailability enhancer. The best-formulated turmeric supplements address this by combining curcumin with piperine (black pepper extract), phospholipids, or nanoparticle emulsification to achieve blood levels that make supplementation worth doing.`,
  coq10:      `Coenzyme Q10 (CoQ10) is a fat-soluble compound present in every cell of the body, concentrated most heavily in the tissues with the highest energy demands: the heart, liver, kidneys, and skeletal muscle. It sits at the core of the mitochondrial electron transport chain, where it shuttles electrons to generate ATP — the cell's energy currency. It also acts as an antioxidant, protecting mitochondrial membranes from the oxidative stress that accumulates with age. Blood CoQ10 levels begin declining from the mid-twenties and can be further depleted by statin medications.`,
  glutathione:`Glutathione is the body's primary intracellular antioxidant, produced in every cell from three amino acids: cysteine, glycine, and glutamate. It neutralises free radicals, regenerates other antioxidants like vitamins C and E, and is the central molecule in the liver's detoxification of drugs, heavy metals, and environmental chemicals. Under conditions of high oxidative stress — illness, pollution exposure, heavy exercise, ageing, chronic inflammation — cellular glutathione depletes faster than the body can replenish it.`,
  resveratrol:`Resveratrol is a polyphenol produced by plants as a defence compound against pathogens and UV stress. It attracted scientific attention when epidemiologists noticed that moderate red wine consumption was associated with lower cardiovascular mortality despite high dietary fat in French cohorts — the so-called French Paradox. Subsequent research identified resveratrol as activating sirtuins (longevity-associated enzymes) and AMPK (a cellular energy sensor), pathways that overlap with caloric restriction's life-extending effects in animal models.`,
  ala:        `Alpha lipoic acid (ALA) is unusual among antioxidants in being active in both aqueous and lipid environments — which means it can function inside cells and in the fatty layers of cell membranes simultaneously. It also regenerates other antioxidants, including vitamins C and E and glutathione, creating a recycling network that extends the useful life of multiple protective compounds at once. In glucose metabolism, ALA acts as a cofactor for enzymes that convert pyruvate to acetyl-CoA — making it relevant for blood sugar management and diabetic neuropathy research.`,
  theanine:   `L-theanine is the amino acid responsible for the calm, clear-headed alertness that distinguishes green tea from coffee despite having similar caffeine content. It modulates glutamate and GABA receptor activity and increases alpha-wave brain activity — the pattern associated with relaxed but attentive focus. Unlike benzodiazepines or sedating antihistamines, it does not cause drowsiness, impair coordination, or create dependence.`,
  gaba:       `GABA (gamma-aminobutyric acid) is the principal inhibitory neurotransmitter in the central nervous system, counterbalancing the stimulating effects of glutamate. Under chronic stress, sleep disruption, or elevated cortisol, the GABAergic tone of the nervous system can become insufficient relative to excitatory activity — producing the persistent low-level tension and difficulty winding down that many adults experience.`,
  protein:    `Protein is the only macronutrient that cannot be stored in any meaningful quantity — the body uses it continuously for muscle repair, enzyme synthesis, immune proteins, connective tissue maintenance, and dozens of other functions. When protein intake falls short of what exercise, growth, or recovery demands, the body draws amino acids from muscle tissue, accelerating the lean mass loss that becomes harder to reverse with age.`,
  joint:      `Cartilage has no blood supply, which is why it heals slowly and degrades gradually under the cumulative stress of movement over decades. Glucosamine and chondroitin are the building blocks of cartilage matrix and synovial fluid, respectively. MSM (methylsulfonylmethane) provides the sulfur that cartilage proteins require for structural integrity. Together, these three compounds address the maintenance and repair of the joint tissues most commonly affected by age-related wear.`,
  milkthistle:`Milk thistle (Silybum marianum) has been used as a liver-protective herb in European traditional medicine since antiquity. The active compounds — a group of flavonolignans collectively called silymarin — are concentrated in the seeds and have a well-documented mechanism: they compete with hepatotoxic compounds for the same liver cell membrane receptors, effectively blocking the uptake of certain toxins while simultaneously stimulating liver cell regeneration and acting as antioxidants within hepatocytes.`,
  berberine:  `Berberine is an isoquinoline alkaloid extracted from several plants including barberries and goldenseal. It is one of the most studied natural compounds for blood glucose regulation, with clinical trial data showing effects on fasting glucose, HbA1c, and insulin sensitivity that are comparable in magnitude to metformin in some short-term studies. Its primary mechanism is activation of AMPK — the same cellular energy-sensing enzyme targeted by metformin and some longevity research compounds.`,
  heart:      `Cardiovascular disease begins with the accumulation of oxidised LDL cholesterol in arterial walls — a process that takes decades and is driven by elevated LDL, low HDL, high triglycerides, inflammation, and oxidative stress. Specific nutrients and plant compounds have been studied for their ability to address one or more of these underlying drivers. The most evidence-backed include omega-3 fatty acids, red yeast rice monacolin K (a natural statin-equivalent), bergamot polyphenols, and CoQ10.`,
  general:    `The nutritional supplement market is crowded with products that overpromise and underdeliver. What distinguishes effective supplementation from expensive urine is formulating with the right ingredient, at the studied dose, in a bioavailable form — and taking it consistently enough for the physiology to respond. The products stocked by Supplements Kenya are chosen to meet all three of these criteria.`,
};

// Ingredient-specific content for Pattern C "what's in each serving" sections
const WHAT_IS_IN = {
  krill:      'phospholipid-bound EPA and DHA plus natural astaxanthin from Antarctic Euphausia superba',
  omega3:     'concentrated EPA and DHA from cold-water marine fish',
  collagen:   'hydrolysed collagen peptides from bovine hides, marine fish, or chicken sternum depending on the specific product',
  probiotic:  'clinically tested Lactobacillus and Bifidobacterium strains at verified CFU counts',
  vitd:       'cholecalciferol (vitamin D3) — the same form synthesised by the skin from sunlight',
  vitc:       'ascorbic acid or ascorbate compounds for antioxidant and immune function',
  b12:        'methylcobalamin or cyanocobalamin — bioavailable forms of vitamin B12',
  bcomplex:   'the full spectrum of B vitamins including thiamine, riboflavin, niacin, B6, folate, B12, biotin, and pantothenic acid',
  folate:     '5-methyltetrahydrofolate (5-MTHF) — the active, methylated form of folate the body uses directly',
  vitk:       'menaquinone-7 (MK-7) or menaquinone-4 (MK-4) — the most biologically active forms of vitamin K2',
  magnesium:  'elemental magnesium as citrate, glycinate, malate, or another highly bioavailable form',
  zinc:       'elemental zinc in a bioavailable form such as zinc bisglycinate, zinc picolinate, or zinc gluconate',
  iron:       'elemental iron as ferrous sulfate, ferrous bisglycinate, or another absorbable form',
  ashwagandha:'standardised withanolide-rich ashwagandha root and/or leaf extract',
  turmeric:   'curcuminoid-standardised turmeric extract with a bioavailability-enhancing system',
  coq10:      'ubiquinone or ubiquinol (reduced form) in a lipid-based delivery system for fat-soluble absorption',
  glutathione:'reduced L-glutathione or S-acetyl glutathione for intracellular delivery',
  theanine:   'L-theanine — the primary amino acid in green tea leaves',
  protein:    'complete amino acid profile with high leucine content for muscle protein synthesis signalling',
  joint:      'glucosamine hydrochloride or sulfate, chondroitin sodium sulfate, and OptiMSM or similar quality MSM',
  milkthistle:'silymarin extracted and standardised from Silybum marianum seeds',
  berberine:  'berberine hydrochloride standardised from Berberis aristata or related plant species',
  immune:     'clinically studied immune-support compounds including beta-glucan, colostrum, or botanical extracts',
  nootropic:  'research-backed nootropic compounds for brain energy, focus, and cognitive performance',
  womens:     'female hormonal support compounds including DIM, DHEA, or botanical adaptogens',
  enzymes:    'digestive enzymes including protease, amylase, and lipase for comprehensive macronutrient breakdown',
  heart:      'evidence-backed cardiovascular support compounds for healthy cholesterol and arterial function',
  melatonin:  'melatonin and calming co-factors for faster sleep onset and better sleep quality',
  energy:     'mitochondrial energy-support compounds including NMN, NAD precursors, and co-factors',
  weightmgmt: 'metabolic support compounds for fat metabolism, appetite regulation, and body composition',
  general:    'premium quality nutritional supplement',
};

// Pattern D prose continuations
const PATD_PARA2 = {
  krill:      'The phospholipid delivery format also means krill oil is odourless — no fishy aftertaste, no repeat. For people who have tried fish oil and been put off by the experience, krill is the obvious alternative. The smaller, easy-to-swallow softgels and cleaner palatability make daily use more sustainable, which matters more than any marginal difference in per-dose EPA content.',
  omega3:     'Consistency is the determining factor with omega-3 supplementation. Blood omega-3 index levels — the measurement used in cardiovascular research as a risk biomarker — take four to eight weeks to shift meaningfully with daily supplementation, and the long-term benefits studied in clinical trials reflect months of sustained intake, not short courses. Taking one or two softgels with a meal each day is all that is required.',
  collagen:   'The most common question about collagen supplementation is whether it actually reaches target tissues — after all, dietary proteins are broken down into amino acids in the gut. The current evidence suggests that collagen peptides are absorbed partially intact as dipeptides and tripeptides that can stimulate fibroblast activity in the skin and joint tissues. The amino acid enrichment argument alone (glycine and proline are conditionally essential in higher quantities during tissue repair) also supports a case for supplementation independent of the peptide absorption question.',
  probiotic:  'Probiotic research is strain-specific, which is why the question is never simply "is probiotics useful" but "which strains, for which conditions, at what CFU count." Choosing a product whose strains have been studied in published human trials rather than a generic blend is the single biggest factor in whether you are likely to see the outcomes you are looking for. The products stocked by Supplements Kenya are selected on this basis.',
  vitd:       'Testing serum 25-hydroxyvitamin D is the most direct way to know whether supplementation is working and at what dose. A blood level of 40–60 ng/mL is the range most researchers associate with optimal function across the immune, bone, and metabolic benefits of vitamin D. Getting there reliably typically requires 2,000–5,000 IU per day for most adults, depending on baseline levels, body weight, and sun exposure.',
  ashwagandha:`The stress-reducing effects of ashwagandha are not immediate — they develop over two to eight weeks of consistent use, which reflects the adaptogen model of recalibrating the hypothalamic-pituitary-adrenal axis rather than directly sedating it. The distinction matters: adaptogens support the body's own stress-regulation mechanisms rather than suppressing them, which is why they do not produce dependence or rebound anxiety when discontinued.`,
  theanine:   `At 200 mg — the dose in this product — theanine produces a clinically detectable increase in alpha-wave brain activity within 30–45 minutes of ingestion. The subjective experience most people describe is not sedation but rather a reduction in the friction of anxiety: the background noise that makes concentration harder. Paired with caffeine at a roughly 2:1 theanine:caffeine ratio, it is one of the most consistently validated cognitive support combinations in the human performance literature.`,
  joint:      'Joint supplements are maintenance tools, not pain medications. They address the nutritional substrate for cartilage integrity — a process that operates slowly and cumulatively, which is why the clinical trial timelines run to 12 and 24 weeks. Starting a joint supplement protocol before significant structural wear has occurred is the most effective strategy; these compounds cannot regenerate severely degraded cartilage, but consistent use supports the tissue you have and may slow the rate of age-related decline.',
  general:    'Nutritional supplements work in proportion to what is missing. For someone with an adequate dietary intake of a nutrient, adding more produces limited additional benefit. For someone who is genuinely deficient or sub-optimal, the effect can be substantial. Understanding which category you fall into — through diet assessment, blood testing where available, or working with a nutritionist — shapes how much return you will see from any supplement investment.',
};

function getIntro(type) {
  return INTRO_A[type] || INTRO_A.general;
}

function getPatD2(type) {
  return PATD_PARA2[type] || PATD_PARA2.general;
}

// ─── pattern assemblers ─────────────────────────────────────────────────────────

function cleanName(raw) {
  return (raw || '').replace(/\?/g, "'").replace(/\s+/g, ' ').trim();
}

function patternB(p, type) {
  const name  = cleanName(p.name);
  const brand = p.brand || 'this brand';
  const attrs = p.attributes || [];
  const sub   = (p.subcategory_slug || '').replace(/-/g, ' ');
  const attrList = attrs.length
    ? attrs.slice(0, 4).map(a => `<li><strong>${a.name}:</strong> ${a.value}</li>`).join('\n  ')
    : '';

  const intro = getIntro(type);

  const benefitsMap = {
    krill:      ['Maintain healthy triglycerides, blood pressure, and heart function', 'Support brain health, mood stability, and cognitive resilience', 'Reduce systemic inflammation as a daily background effect', 'Benefit from built-in astaxanthin antioxidant protection'],
    omega3:     ['Support healthy triglycerides and cardiovascular function', 'Maintain brain health, focus, and mood stability', 'Support joint mobility and a healthy inflammatory response', 'Round out a diet lacking in regular fatty fish intake'],
    collagen:   ['Improve skin elasticity, hydration, and firmness over 6–12 weeks', 'Support joint lubrication and reduce exercise-related joint discomfort', 'Strengthen hair and nails from within', 'Support gut lining integrity and connective tissue throughout the body'],
    probiotic:  ['Restore and maintain a diverse, health-promoting gut microbiome', 'Reduce bloating, irregular bowel habits, and digestive discomfort', 'Support immune function through gut-associated immune tissue', 'Replenish beneficial bacteria after antibiotic courses'],
    vitd:       ['Support robust immune function and innate immunity against infection', 'Maintain bone density and calcium absorption alongside vitamin K2', 'Improve mood, energy, and seasonal resilience', 'Support muscle function, cardiovascular health, and hormonal balance'],
    vitc:       ['Support immune white blood cell function and antibody production', 'Drive collagen synthesis for skin, gums, and connective tissue', 'Recycle other antioxidants and neutralise reactive oxygen species', 'Enhance dietary non-haem iron absorption'],
    b12:        ['Support energy production at the cellular level via the Krebs cycle', 'Maintain the myelin sheath protecting nerve fibres', 'Reduce elevated homocysteine — a cardiovascular and cognitive risk factor', 'Support red blood cell production and prevent megaloblastic anaemia'],
    magnesium:  ['Regulate healthy heart rhythm and blood pressure', 'Support bone mineralisation alongside calcium and vitamin D', 'Reduce muscle cramps and physical tension', 'Improve stress tolerance and sleep quality'],
    zinc:       ['Prime innate and adaptive immune responses', 'Support testosterone production and male reproductive health', 'Accelerate wound healing and skin cell turnover', 'Maintain taste, smell, and normal protein synthesis'],
    iron:       ['Correct iron-deficiency anaemia and associated fatigue', 'Support oxygen transport and aerobic exercise capacity', 'Maintain cognitive function, which requires adequate cerebral oxygenation', 'Support immune cell function, which has a high iron requirement'],
    ashwagandha:['Reduce perceived stress and lower elevated cortisol', 'Improve sleep onset and sleep quality', 'Support focus, mental clarity, and cognitive stamina', 'Maintain energy, vitality, and physical exercise capacity'],
    protein:    ['Support muscle protein synthesis and recovery after training', 'Maintain lean mass during caloric restriction or ageing', 'Provide a convenient, complete amino acid source between whole meals', 'Support immune proteins, enzymes, and connective tissue maintenance'],
    joint:      ['Support cartilage structure and slow its breakdown', 'Maintain joint fluid volume and lubrication', 'Reduce joint discomfort and morning stiffness', 'Support connective tissue sulfur content for structural integrity'],
    milkthistle:['Protect liver cells from damage caused by toxins, alcohol, and drugs', 'Support the liver\'s detoxification and biotransformation pathways', 'Provide antioxidant defence specifically within hepatocytes', 'Support healthy liver enzyme levels'],
    general:    ['Support the specific health goal this product targets', 'Provide a well-dosed, bioavailable form of the key nutrient', 'Complement a balanced diet and healthy lifestyle', 'Maintain nutritional status over time with consistent daily use'],
  };

  const benefits = (benefitsMap[type] || benefitsMap.general)
    .map(b => `<li>${b}</li>`).join('\n  ');

  const usageMap = {
    krill:      'two softgels daily with a meal. The phospholipid format means fat co-ingestion is less critical than with fish oil, but taking it with food reduces the chance of digestive discomfort.',
    omega3:     'one to two softgels daily with a meal containing some dietary fat for best absorption of the fat-soluble fatty acids.',
    collagen:   'one serving (typically one scoop or two to four capsules) per day. Many users take it first thing in the morning or before bed on an empty stomach, though food timing is not critical.',
    probiotic:  'one capsule daily with or without food. For recovery after antibiotics, two per day for the first two weeks is commonly recommended.',
    vitd:       'one softgel or capsule daily with a fat-containing meal. Do not exceed 10,000 IU daily without monitoring serum 25-hydroxyvitamin D levels.',
    vitc:       'one to two capsules or tablets daily. Doses above 500 mg are often split across the day, as vitamin C absorption is saturable at high single doses.',
    b12:        'one capsule or tablet daily, with or without food. Sublingual and methylcobalamin forms may be preferable for those with absorption issues.',
    magnesium:  'one to three capsules per day, ideally in the evening or split across meals. Start at the lower dose and increase gradually to avoid loose stools.',
    ashwagandha:'one capsule one to two times daily, with food. Effects on stress and mood typically develop over two to eight weeks of consistent use.',
    protein:    'one scoop mixed into water, milk, or a smoothie. Best taken within 30–60 minutes after exercise or as needed to hit daily protein targets.',
    joint:      'three capsules daily with a meal. Allow 8–12 weeks of consistent use before assessing outcomes — joint supplement benefits are structural and gradual.',
    general:    'the dose stated on the label. Follow the manufacturer\'s directions, as serving sizes vary across products in this category.',
  };

  const usage = usageMap[type] || usageMap.general;
  const bquality = brandQuality(p.brand);

  let attrSection = '';
  if (attrList) {
    attrSection = `\n\n<h3>Label details</h3>\n<ul>\n  ${attrList}\n</ul>`;
  }

  return `<h2>${name} — what it does and why it matters</h2>
<p>${intro}</p>

<h2>Key benefits of ${name}</h2>
<ul>
  ${benefits}
</ul>

<h2>What's in each serving</h2>
<p>Each serving provides ${WHAT_IS_IN[type] || 'the active ingredients listed on the supplement facts panel'}. ${attrList ? 'The specific quantities are shown on the label and in the table below.' : 'Check the label for exact quantities.'}${attrSection}</p>

<h2>How to use ${name}</h2>
<p>Take ${usage}</p>

<h2>Why buy ${name} in Kenya from Supplements Kenya</h2>
<p>${bquality} Supplements Kenya imports authentic, sealed inventory directly and delivers across Nairobi, Mombasa, and the rest of Kenya.</p>`;
}

function patternC(p, type) {
  const name  = cleanName(p.name);
  const brand = p.brand || 'the brand';
  const attrs = p.attributes || [];
  const attrList = attrs.length
    ? attrs.slice(0, 4).map(a => `<li><strong>${a.name}:</strong> ${a.value}</li>`).join('\n  ')
    : '';

  const intro = getIntro(type);
  const bquality = brandQuality(p.brand);

  const scienceMap = {
    krill:      'Several pharmacokinetic comparisons have shown higher post-dose EPA and DHA blood levels from krill oil than from equivalent doses of fish oil triglycerides, though the magnitude of the advantage is debated. The more consistent advantage of krill oil is practical: it is odourless, the softgels are small, and the natural astaxanthin content acts as a built-in preservative against oxidation.',
    omega3:     'The cardiovascular benefits of EPA and DHA are among the most replicated findings in nutritional epidemiology. EPA reduces platelet aggregation and triglyceride synthesis in the liver; DHA is incorporated into neural cell membranes where it supports fluidity and signal transmission. Both have anti-inflammatory properties mediated through specialised pro-resolving mediators (SPMs) that help the body transition out of inflammatory states.',
    collagen:   'The absorb-or-not debate around collagen peptides has largely resolved in favour of supplementation: studies using labelled amino acids have confirmed that collagen-specific dipeptides (hydroxyproline-proline and hydroxyproline-glycine) appear in the bloodstream after oral intake and accumulate in joint and skin tissue. These dipeptides stimulate fibroblast proliferation and collagen synthesis in the target tissues rather than simply providing amino acids to a general pool.',
    vitd:       'Vitamin D3 is hydroxylated in the liver to 25-hydroxyvitamin D (the storage form measured in blood tests) and then further hydroxylated in the kidneys (and locally in tissues) to the active hormone 1,25-dihydroxyvitamin D (calcitriol). Calcitriol activates over 1,000 genes and modulates immune, metabolic, and bone health pathways. Supplementing with D3 rather than D2 is now the standard recommendation because D3 is more potent at raising and maintaining serum 25-OH-D levels.',
    ashwagandha:'The primary active compounds in ashwagandha — withanolides — have been shown to suppress NF-κB signalling, reduce cortisol secretion from the adrenal glands, and modulate GABA-A receptor activity. The net effect on the stress response is multi-pathway, which is characteristic of adaptogenic herbs and may explain why their clinical effects tend to be broader and more sustained than single-mechanism compounds.',
    magnesium:  'Most of the body\'s magnesium (approximately 60%) is stored in bone and is not directly accessible to blood testing — which means serum magnesium levels are a poor indicator of total body magnesium status. Many people with low cellular magnesium will have normal serum readings. This is why symptom-based assessment (muscle cramps, poor sleep, anxiety, constipation) is often a more sensitive indicator of insufficiency than a standard blood test.',
    berberine:  'Berberine\'s glucose-lowering mechanism operates primarily through AMPK activation in liver and muscle cells, which reduces hepatic glucose output and increases glucose uptake in peripheral tissues. Unlike metformin, it is also active against gut bacteria and can modify the microbiome in ways that independently improve insulin sensitivity. Clinical trials have run for up to six months with sustained effects on HbA1c and fasting glucose.',
    general:    `Research on ${type === 'general' ? name.split(' ').slice(0, 3).join(' ') : type.replace(/\d/g, '')} continues to grow, and the most current evidence supports the therapeutic applications this product is formulated for. ${brand} has formulated ${name} to deliver the ingredient forms and doses that align with this research.`,
  };

  const science = scienceMap[type] || scienceMap.general;

  let servingSection = '<p>The specific serving composition is printed on the supplement facts panel on the label.</p>';
  if (attrList) {
    servingSection = `<ul>\n  ${attrList}\n</ul>`;
  }

  return `<h2>What is ${name}?</h2>
<p>${intro}</p>

<h2>Inside each serving of ${name}</h2>
${servingSection}

<h2>The science behind ${name}</h2>
<p>${science}</p>

<h2>How and when to take it</h2>
<p>${brand} recommends following the serving directions printed on the label of ${name}. For most supplements in this category, consistent daily use over at least 4–8 weeks is needed before the full benefit is apparent. Take it at the same time each day to build the habit — timing matters less than consistency for most nutritional supplements.</p>

<h2>Buy ${name} in Kenya</h2>
<p>${bquality} We stock authentic, batch-verified inventory and deliver across Kenya. ${name} is available from Supplements Kenya at a price that reflects the actual import cost, with no mark-up for unnecessary packaging or marketing.</p>`;
}

function patternD(p, type) {
  const name  = cleanName(p.name);
  const brand = p.brand || 'the brand';
  const attrs = p.attributes || [];
  const attrList = attrs.length
    ? attrs.slice(0, 3).map(a => `${a.value} ${a.name}`).join(', ')
    : null;

  const intro = getIntro(type);
  const para2 = getPatD2(type);
  const bquality = brandQuality(p.brand);

  const para3 = attrList
    ? `Each bottle of ${name} provides ${attrList}. ${brand} has formulated this product with ${WHAT_IS_IN[type] || 'the active ingredient listed on the label'}, using the form and dose that align with the current research in this category. The serving size and total supply per bottle are printed on the label.`
    : `${name} by ${brand} is formulated with ${WHAT_IS_IN[type] || 'the active ingredient listed on the label'}. The specific dose, form, and serving size are shown on the supplement facts panel — these are the details that matter most when comparing products in this category, and they vary widely even between products with the same ingredient name.`;

  return `<h2>${name}</h2>
<p>${intro}</p>

<p>${para2}</p>

<p>${para3}</p>

<p>${bquality} Supplements Kenya sources authentic, sealed ${brand} product with batch traceability and delivers across Nairobi, Mombasa, and the rest of Kenya. Consistent daily use at the label dose, sustained over weeks rather than days, is how this product works best.</p>`;
}

// ─── SEO fields ────────────────────────────────────────────────────────────────

function buildSeoTitle(p, type) {
  const n = p.name.replace(/\?/g, '').trim(); // strip stray ? chars from slugified names
  const b = p.brand || '';
  // vary the format so not every product has "Brand Name | Buy in Kenya"
  const h = djb2(p.slug);
  const patterns = [
    `${n} | Buy in Kenya`,
    `${b} ${n} — Kenya`,
    `${n} by ${b} | Kenya`,
    `Buy ${n} in Kenya`,
    `${n} (${b}) | Supplements Kenya`,
  ];
  // Don't hard-truncate — let Google truncate naturally in the SERP
  return patterns[h % patterns.length];
}

function buildSeoDesc(p, type) {
  const n = cleanName(p.name);
  const b = p.brand || '';
  const h = djb2(p.slug);
  const attrs = p.attributes || [];
  const specNote = attrs.length
    ? ` ${attrs[0].value} ${attrs[0].name}.`
    : '';

  const whatIn = WHAT_IS_IN[type]
    ? WHAT_IS_IN[type].replace(/[,;]$/, '')  // strip trailing punctuation before period
    : `${(p.subcategory_slug||'health').replace(/-/g,' ')} support`;
  const intros = [
    `${b} ${n}:${specNote} ${whatIn}. Fast Kenya delivery.`,
    `Buy ${n} from ${b} in Kenya.${specNote} Supports ${(p.subcategory_slug||'health').replace(/-/g,' ')}. Authentic, fast delivery.`,
    `${n} by ${b}.${specNote} Quality-verified, fast delivery across Kenya from Supplements Kenya.`,
  ];
  return intros[h % intros.length].substring(0, 160);
}

// ─── main ──────────────────────────────────────────────────────────────────────

const results = products.map(p => {
  const h    = djb2(p.slug);
  const type = classify(p);

  // Assign pattern: B=0, C=1, D=2 — biased toward B/C for complex supplements,
  // D more common for simpler single-ingredient products (hash + type modifier)
  const simpleTypes = new Set(['vitd','vitc','zinc','iron','calcium','taurine','lysine','tyrosine','arginine','gla']);
  const bias = simpleTypes.has(type) ? 1 : 0; // shift toward D for simpler products
  const pattern = (h + bias) % 3; // 0=B, 1=C, 2=D

  let long;
  if (pattern === 0)      long = patternB(p, type);
  else if (pattern === 1) long = patternC(p, type);
  else                    long = patternD(p, type);

  return {
    slug:           p.slug,
    short:          buildShort(p, type),
    long,
    seoTitle:       buildSeoTitle(p, type),
    seoDescription: buildSeoDesc(p, type),
  };
});

fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
console.log(`Written ${results.length} descriptions to ${OUTPUT}`);

// Print pattern distribution
const dist = { B:0, C:0, D:0 };
results.forEach(r => {
  const h = djb2(r.slug);
  const type = classify(products.find(p => p.slug === r.slug));
  const simpleTypes = new Set(['vitd','vitc','zinc','iron','calcium','taurine','lysine','tyrosine','arginine','gla']);
  const bias = simpleTypes.has(type) ? 1 : 0;
  const pattern = (h + bias) % 3;
  if (pattern === 0) dist.B++;
  else if (pattern === 1) dist.C++;
  else dist.D++;
});
console.log(`Pattern distribution — B: ${dist.B}  C: ${dist.C}  D: ${dist.D}`);
