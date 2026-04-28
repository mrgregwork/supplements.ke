require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const fixes = [
    { name: 'Branched Chain Amino Acids', price: 3136 },
    { name: 'Vitamin B12 Methylcobalamin', price: 4299 },
  ];

  for (const fix of fixes) {
    const { rowCount } = await pool.query(
      `UPDATE products SET price = $1, updated_at = NOW()
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($2))`,
      [fix.price, fix.name]
    );
    console.log(`${fix.name}: updated ${rowCount} row(s) → KES ${fix.price}`);
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
