// One-off updater for the Mega EPA-DHA Omega-3 product description / SEO.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SLUG = 'mega-epa-dha-omega-3';

const SHORT = `High-potency fish oil with 720 mg EPA and 480 mg DHA per serving, sourced from sustainably-fished South Pacific anchovy. Non-GMO, gluten-free, clinically dosed for heart and brain support. Delivered across Kenya.`;

const LONG = `<h2>About Mega EPA-DHA Omega-3</h2>
<p>Mega EPA-DHA is Life Extension's no-frills fish oil for shoppers in Kenya who want clinically meaningful omega-3 doses without paying for premium-priced extras. Two softgels deliver 720 mg of EPA and 480 mg of DHA, the two long-chain omega-3 fatty acids most studied for cardiovascular and cognitive support.</p>

<h3>What's inside</h3>
<ul>
  <li><strong>720 mg EPA</strong> per two-softgel serving</li>
  <li><strong>480 mg DHA</strong> per two-softgel serving</li>
  <li>Sourced from anchovy harvested sustainably in the South Pacific</li>
  <li>Non-GMO and gluten-free, with no unnecessary fillers</li>
  <li>Concentrated and purified for low oxidation and minimal aftertaste</li>
</ul>

<h3>Who it's for</h3>
<p>Adults across Nairobi, Mombasa, and the rest of Kenya use Mega EPA-DHA to:</p>
<ul>
  <li>Support healthy heart function and balanced triglyceride levels</li>
  <li>Maintain brain, mood, and memory health as part of a daily routine</li>
  <li>Round out a diet that may not include enough fatty fish</li>
</ul>

<h3>How to take it</h3>
<p>The recommended dose is two softgels daily, ideally with a meal that contains some fat for best absorption. Each bottle contains 120 softgels, a 60-day supply at this dose.</p>

<h2>Why buy Mega EPA-DHA in Kenya from Supplements Kenya</h2>
<p>We stock 100% authentic Life Extension supplements imported directly and verified before they ship to you. Mega EPA-DHA delivers the heart-and-brain benefits of high-EPA fish oil at a price designed for consistent daily use, with fast nationwide delivery and clear, transparent labelling.</p>`;

const SEO_TITLE = `Mega EPA-DHA Omega-3 by Life Extension | Buy in Kenya`;
const SEO_DESC  = `Life Extension Mega EPA-DHA: 720 mg EPA and 480 mg DHA per serving from sustainably sourced anchovy. Heart and brain support, fast delivery across Kenya.`;

async function main() {
  const r = await pool.query(
    `UPDATE products
       SET description=$1, long_description=$2, seo_title=$3, seo_description=$4, updated_at=NOW()
     WHERE slug=$5
     RETURNING id, name`,
    [SHORT, LONG, SEO_TITLE, SEO_DESC, SLUG]
  );
  if (!r.rows.length) {
    console.log(`No product with slug "${SLUG}".`);
  } else {
    console.log(`Updated: ${r.rows[0].name} (${r.rows[0].id})`);
  }
  await pool.end();
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); });
