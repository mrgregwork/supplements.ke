/**
 * Downloads all external CDN images, resizes to 600x600 squares,
 * saves to public/images/products/, and updates the DB.
 *
 * Run: node scripts/migrate-images.cjs
 * Options:
 *   --dry-run   Print what would happen without downloading
 *   --limit=N   Only process first N products (for testing)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
const TARGET_SIZE = 600;
const DELAY_MS = 150;       // polite delay between downloads
const MAX_RETRIES = 3;
const TIMEOUT_MS = 20000;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isExternalUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9._-]/gi, '_').replace(/_+/g, '_').slice(0, 80);
}

function downloadBuffer(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location, attempt));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  }).catch(async (err) => {
    if (attempt < MAX_RETRIES) {
      await sleep(1000 * attempt);
      return downloadBuffer(url, attempt + 1);
    }
    throw err;
  });
}

async function processImage(buffer, outputPath) {
  await sharp(buffer)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'contain',          // letterbox — never crops the product
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // convert transparency to white, not black
    .jpeg({ quality: 92, progressive: true })
    .toFile(outputPath);
}

async function main() {
  console.log(`\n=== Image Migration ===`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Target: ${TARGET_SIZE}x${TARGET_SIZE} JPEG`);
  if (DRY_RUN) console.log('DRY RUN — no files will be written');
  console.log('');

  const { rows: products } = await pool.query(
    'SELECT id, name, images FROM products ORDER BY created_at'
  );

  const toProcess = products.slice(0, LIMIT);
  console.log(`Products to check: ${toProcess.length} of ${products.length}`);

  let downloaded = 0, skipped = 0, failed = 0, alreadyLocal = 0;
  const updates = [];  // { id, images[] }

  for (let pi = 0; pi < toProcess.length; pi++) {
    const product = toProcess[pi];
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) { skipped++; continue; }

    const newImages = [];
    let changed = false;

    for (let ii = 0; ii < images.length; ii++) {
      const url = images[ii];

      if (!isExternalUrl(url)) {
        // Already a local path — keep as-is
        newImages.push(url);
        alreadyLocal++;
        continue;
      }

      // Build a stable local filename from product id + image index
      const ext = '.jpg';
      const localName = `${product.id}-${ii}${ext}`;
      const localPath = path.join(OUTPUT_DIR, localName);
      const publicPath = `/images/products/${localName}`;

      // Skip if already downloaded
      if (fs.existsSync(localPath)) {
        newImages.push(publicPath);
        changed = true;
        alreadyLocal++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry] ${product.name} img[${ii}] → ${publicPath}`);
        newImages.push(publicPath);
        changed = true;
        downloaded++;
        continue;
      }

      try {
        process.stdout.write(`[${pi + 1}/${toProcess.length}] ${product.name.slice(0, 40).padEnd(40)} img${ii + 1}... `);
        const buffer = await downloadBuffer(url);
        await processImage(buffer, localPath);
        newImages.push(publicPath);
        changed = true;
        downloaded++;
        process.stdout.write(`✓\n`);
        await sleep(DELAY_MS);
      } catch (err) {
        process.stdout.write(`✗ ${err.message}\n`);
        newImages.push(url); // keep original URL on failure
        failed++;
      }
    }

    if (changed) {
      updates.push({ id: product.id, images: newImages });
    }
  }

  // Batch update DB
  if (!DRY_RUN && updates.length > 0) {
    console.log(`\nUpdating ${updates.length} product records in DB...`);
    for (const { id, images } of updates) {
      await pool.query(
        'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(images), id]
      );
    }
    console.log('DB update complete.');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Downloaded & resized : ${downloaded}`);
  console.log(`Already local        : ${alreadyLocal}`);
  console.log(`Skipped (no images)  : ${skipped}`);
  console.log(`Failed               : ${failed}`);
  console.log(`DB records updated   : ${updates.length}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  pool.end();
  process.exit(1);
});
