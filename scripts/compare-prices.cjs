/**
 * Compares prices in the CSV (products-clean.csv) against the database.
 * Reports mismatches so we can tell whether DB prices are correct.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Minimal CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function splitLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function parsePrice(val) {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

async function main() {
  const csvPath = path.join(__dirname, 'products-clean.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('products-clean.csv not found');
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  console.log(`CSV rows: ${rows.length}`);
  console.log('CSV columns:', Object.keys(rows[0]).join(', '));
  console.log('');

  // Show first 5 CSV rows to confirm column names
  console.log('=== Sample CSV prices (first 10) ===');
  rows.slice(0, 10).forEach(r => {
    const name  = r['Name'] || r['name'] || r['Product Name'] || r['product_name'] || '';
    const price = r['Price'] || r['price'] || r['Regular Price'] || '';
    const orig  = r['Original Price'] || r['original_price'] || r['Compare Price'] || '';
    console.log(`  ${name.slice(0, 50).padEnd(50)} price=${price}  orig=${orig}`);
  });

  // Pull DB prices
  const { rows: dbRows } = await pool.query(
    'SELECT name, slug, price, original_price FROM products ORDER BY name LIMIT 500'
  );

  console.log(`\nDB rows sampled: ${dbRows.length}`);
  console.log('\n=== Sample DB prices (first 10) ===');
  dbRows.slice(0, 10).forEach(r => {
    console.log(`  ${r.name.slice(0, 50).padEnd(50)} price=${r.price}  orig=${r.original_price}`);
  });

  // Compare matching names
  const csvByName = {};
  rows.forEach(r => {
    const name = (r['Name'] || r['name'] || r['Product Name'] || '').toLowerCase().trim();
    if (name) csvByName[name] = r;
  });

  let matched = 0, mismatch = 0, missing = 0;
  const mismatches = [];

  for (const db of dbRows) {
    const key = db.name.toLowerCase().trim();
    const csv = csvByName[key];
    if (!csv) { missing++; continue; }

    const priceKey = Object.keys(csv).find(k => k.toLowerCase().includes('price') && !k.toLowerCase().includes('original') && !k.toLowerCase().includes('compare'));
    const origKey  = Object.keys(csv).find(k => k.toLowerCase().includes('original') || k.toLowerCase().includes('compare'));
    const csvPrice = parsePrice(csv[priceKey || '']);
    const csvOrig  = parsePrice(csv[origKey  || '']);

    if (csvPrice === null) { missing++; continue; }

    matched++;
    const priceDiff = Math.abs((csvPrice - db.price) / csvPrice);
    if (priceDiff > 0.01) { // >1% difference
      mismatch++;
      mismatches.push({
        name: db.name.slice(0, 45),
        csvPrice,
        dbPrice: db.price,
        csvOrig,
        dbOrig: db.original_price,
      });
    }
  }

  if (mismatches.length > 0) {
    console.log(`\n=== Price mismatches (${mismatches.length} products) ===`);
    console.log(`${'Name'.padEnd(45)} ${'CSV price'.padStart(12)} ${'DB price'.padStart(12)} ${'Ratio'.padStart(8)}`);
    mismatches.slice(0, 30).forEach(m => {
      const ratio = (m.dbPrice / m.csvPrice).toFixed(3);
      console.log(`  ${m.name.padEnd(45)} ${String(m.csvPrice).padStart(10)} ${String(m.dbPrice).padStart(10)} ${ratio.padStart(8)}`);
    });
  } else {
    console.log('\n✓ All matched prices are consistent.');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Matched    : ${matched}`);
  console.log(`Mismatched : ${mismatch}`);
  console.log(`Not in CSV : ${missing}`);

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
