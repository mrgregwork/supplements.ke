require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Merge all batch files
  const batchFiles = [
    'collection-batch-a.json',
    'collection-batch-b.json',
    'collection-batch-c.json',
    'collection-batch-d1.json',
    'collection-batch-d2.json',
    'collection-batch-e.json',
    'collection-batch-f1.json',
    'collection-batch-f2.json',
  ];

  const dataDir = path.join(__dirname, 'data');
  let allEntries = [];

  for (const file of batchFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`WARNING: Missing file ${file} — skipping`);
      continue;
    }
    const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Loaded ${entries.length} entries from ${file}`);
    allEntries = allEntries.concat(entries);
  }

  console.log(`\nTotal entries to apply: ${allEntries.length}`);

  // Save merged file
  const mergedPath = path.join(dataDir, 'collection-descriptions.json');
  fs.writeFileSync(mergedPath, JSON.stringify(allEntries, null, 2));
  console.log(`Merged file saved to ${mergedPath}\n`);

  let catUpdated = 0;
  let subUpdated = 0;
  let errors = 0;

  for (const entry of allEntries) {
    try {
      if (entry.type === 'category') {
        const result = await pool.query(
          `UPDATE categories SET long_description = $1 WHERE slug = $2`,
          [entry.long_description, entry.slug]
        );
        if (result.rowCount === 0) {
          console.warn(`  WARN: No category found with slug "${entry.slug}"`);
        } else {
          catUpdated++;
          console.log(`  [CAT] ${entry.slug}`);
        }
      } else if (entry.type === 'subcategory') {
        const result = await pool.query(
          `UPDATE subcategories
           SET long_description = $1
           WHERE slug = $2
             AND category_id = (SELECT id FROM categories WHERE slug = $3)`,
          [entry.long_description, entry.slug, entry.catSlug]
        );
        if (result.rowCount === 0) {
          console.warn(`  WARN: No subcategory found with slug "${entry.slug}" under "${entry.catSlug}"`);
        } else {
          subUpdated++;
          console.log(`  [SUB] ${entry.catSlug}/${entry.slug}`);
        }
      }
    } catch (err) {
      console.error(`  ERROR on ${entry.slug}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Categories updated: ${catUpdated}`);
  console.log(`Subcategories updated: ${subUpdated}`);
  console.log(`Errors: ${errors}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
