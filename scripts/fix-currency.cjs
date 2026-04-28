require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rowCount } = await pool.query(
    "UPDATE site_settings SET value = 'KES', updated_at = NOW() WHERE key = 'defaultCurrency'"
  );
  if (rowCount === 0) {
    await pool.query(
      "INSERT INTO site_settings (key, value, description) VALUES ('defaultCurrency', 'KES', 'Default currency code for product pricing')"
    );
    console.log('Inserted defaultCurrency = KES');
  } else {
    console.log('Updated defaultCurrency → KES');
  }

  const { rows } = await pool.query("SELECT key, value FROM site_settings WHERE key = 'defaultCurrency'");
  console.log('Verified:', rows[0]);
  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
