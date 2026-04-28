require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT slug FROM subcategories WHERE slug LIKE 'collagen%'").then(r => {
  console.log(r.rows.map(x => x.slug));
  pool.end();
}).catch(e => { console.error(e); pool.end(); });
