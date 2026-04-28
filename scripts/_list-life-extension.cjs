require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT slug, name, sku FROM products WHERE brand ILIKE 'life extension' AND status='active' ORDER BY name`)
  .then(r => { r.rows.forEach(p => console.log(`${p.sku || '-'}\t${p.slug}\t${p.name}`)); console.log(`\nTotal: ${r.rows.length}`); pool.end(); })
  .catch(e => { console.error(e); pool.end(); process.exit(1); });
