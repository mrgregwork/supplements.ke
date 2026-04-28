require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS long_description text;
  `);
  console.log('✓ categories.long_description added');

  await pool.query(`
    ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS long_description text;
  `);
  console.log('✓ subcategories.long_description added');

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
