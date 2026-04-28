require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT s.slug FROM subcategories s JOIN categories c ON c.id=s.category_id WHERE c.slug='vitamins' ORDER BY s.slug")
  .then(r => { console.log(r.rows.map(x => x.slug)); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
