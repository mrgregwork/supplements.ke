require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT slug, name FROM products WHERE brand ILIKE 'life extension' AND (slug ILIKE '%glutamine%' OR name ILIKE '%glutamine%' OR slug = 'now0092') ORDER BY name`)
  .then(r => { r.rows.forEach(p => console.log(p.slug + ' | ' + p.name)); pool.end(); })
  .catch(e => { console.error(e); pool.end(); process.exit(1); });
