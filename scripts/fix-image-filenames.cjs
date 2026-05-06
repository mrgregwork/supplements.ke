/**
 * fix-image-filenames.cjs
 *
 * Renames all product images from "Product Name.jpg" to "product-name.jpg"
 * (spaces → hyphens, lowercase, remove special chars) and updates the DB.
 *
 * Run: node scripts/fix-image-filenames.cjs
 * Dry run: node scripts/fix-image-filenames.cjs --dry
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry');
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'products');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Convert "Product Name 2.jpg" → "product-name-2.jpg"
function toSafeFilename(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const safe = base
    .toLowerCase()
    .replace(/[™®©]/g, '')          // remove trademark symbols
    .replace(/[^a-z0-9\s\-]/g, '')  // remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
    .substring(0, 120);
  return safe + ext;
}

// Check if a filename looks like a UUID (old style) — skip these
function isUuidFilename(filename) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d+\.jpg$/.test(filename);
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');

  // Get all non-UUID image files
  const allFiles = fs.readdirSync(IMAGE_DIR);
  const namedFiles = allFiles.filter(f => !isUuidFilename(f) && f.endsWith('.jpg'));
  console.log(`Found ${namedFiles.length} named image files to process`);

  // Build rename map: old filename → new filename
  const renames = [];
  for (const oldName of namedFiles) {
    const newName = toSafeFilename(oldName);
    if (oldName !== newName) {
      renames.push({ oldName, newName });
    }
  }
  console.log(`Files that need renaming: ${renames.length}`);

  // Show sample
  renames.slice(0, 5).forEach(r => {
    console.log(`  "${r.oldName}" → "${r.newName}"`);
  });
  if (renames.length > 5) console.log(`  ... and ${renames.length - 5} more`);

  if (!DRY_RUN) {
    // Step 1: Rename all files
    let renamed = 0;
    for (const { oldName, newName } of renames) {
      const oldPath = path.join(IMAGE_DIR, oldName);
      const newPath = path.join(IMAGE_DIR, newName);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        renamed++;
      } else {
        console.warn(`  ⚠️ File not found: ${oldName}`);
      }
    }
    console.log(`\nRenamed ${renamed} files on disk`);

    // Step 2: Update DB — fetch all products with named image paths
    const { rows } = await pool.query(
      "SELECT id, name, images FROM products WHERE images::text LIKE '%/images/products/%'"
    );
    console.log(`\nChecking ${rows.length} products in DB...`);

    let dbUpdated = 0;
    for (const row of rows) {
      if (!Array.isArray(row.images) || row.images.length === 0) continue;

      const oldPaths = row.images;
      const newPaths = oldPaths.map(imgPath => {
        // Only touch named files (not UUID files)
        const filename = path.basename(imgPath);
        if (isUuidFilename(filename)) return imgPath;
        const newFilename = toSafeFilename(filename);
        return `/images/products/${newFilename}`;
      });

      // Check if anything changed
      const changed = oldPaths.some((p, i) => p !== newPaths[i]);
      if (!changed) continue;

      await pool.query(
        'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(newPaths), row.id]
      );
      dbUpdated++;
      if (dbUpdated <= 5) {
        console.log(`  💾 Updated: ${row.name}`);
        console.log(`     Before: ${JSON.stringify(oldPaths)}`);
        console.log(`     After:  ${JSON.stringify(newPaths)}`);
      }
    }
    console.log(`\nUpdated ${dbUpdated} products in DB`);
  } else {
    // Dry run: just show what DB changes would look like for first few
    const { rows } = await pool.query(
      "SELECT id, name, images FROM products WHERE images::text LIKE '%/images/products/%' LIMIT 5"
    );
    for (const row of rows) {
      if (!Array.isArray(row.images)) continue;
      const newPaths = row.images.map(imgPath => {
        const filename = path.basename(imgPath);
        if (isUuidFilename(filename)) return imgPath;
        return `/images/products/${toSafeFilename(filename)}`;
      });
      console.log(`\n[DRY] ${row.name}`);
      console.log(`  Before: ${JSON.stringify(row.images)}`);
      console.log(`  After:  ${JSON.stringify(newPaths)}`);
    }
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
