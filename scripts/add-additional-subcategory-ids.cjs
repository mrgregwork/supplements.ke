// Adds `additional_subcategory_ids` jsonb column to products if missing.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const exists = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name='products' AND column_name='additional_subcategory_ids'
  `);
  if (exists.rows.length) {
    console.log('Column already exists.');
  } else {
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN additional_subcategory_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    console.log('Added column products.additional_subcategory_ids');
  }
  await pool.end();
}
main().catch(e => { console.error(e); pool.end(); process.exit(1); });
