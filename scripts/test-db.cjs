require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL;
console.log('DATABASE_URL set:', !!url);
if (!url) { console.log('ERROR: DATABASE_URL not found in .env'); process.exit(1); }
console.log('Connecting to:', url.replace(/:([^:@]+)@/, ':***@'));
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10000 });
pool.query('SELECT 1 AS ok', (err, res) => {
  if (err) { console.log('DB ERROR:', err.message); }
  else { console.log('DB OK:', res.rows[0]); }
  pool.end();
});
