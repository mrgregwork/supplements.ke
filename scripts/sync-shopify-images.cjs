/**
 * sync-shopify-images.cjs
 *
 * Fetches all supplement products + ALL their images from Shopify API,
 * matches them to website DB products by name, downloads the images,
 * names files as "Product Name.jpg" / "Product Name 2.jpg" etc.,
 * and updates the DB images array + alt text.
 *
 * Run: node scripts/sync-shopify-images.cjs
 * Dry run: node scripts/sync-shopify-images.cjs --dry
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DRY_RUN = process.argv.includes('--dry');
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_HOST = 'western-cosmetics-supplements.myshopify.com';
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'products');

// Product types that are supplements (not cosmetics)
const SUPPLEMENT_TYPES = new Set([
  'Food Supplements', 'Supplement', 'Supplements',
  'Protein Powder', 'Whey Protein', 'Creatine', 'Performance Supplements',
  'Multivitamin', 'Multivitamins Supplements', 'MultiVitamin',
  'Men Multivitamin Supplements', 'Women Multivitamin Supplements',
  'Collagen', 'Collagen Peptides',
  'Probiotics', 'Herbal Supplements',
  'Vitamin B Complex Supplements', 'Vitamin B Supplements in Kenya',
  'Vitamin Supplements', 'Vitamin C Supplements', 'Vitamin D',
  'Magnesium Supplements', 'Gummies',
  'Weight Management', 'Women Health', 'Gut Heath', 'Immunity',
  'Sleep Supplement', 'Brain Supplements', 'Brain Supplement',
  'Digestive Supplements', 'Hormonal Balance Supplements in Kenya',
  'Kids supplement',
]);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ──────────────────────────────────────────────────────────────────

function shopifyGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SHOPIFY_HOST,
      path,
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
    };
    https.get(options, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Fetch ALL supplement products from Shopify (paginated)
async function fetchAllShopifySupplements() {
  const products = [];
  let sinceId = 0;

  while (true) {
    const url =
      `/admin/api/2024-01/products.json?limit=250&fields=id,title,product_type,handle,images` +
      (sinceId ? `&since_id=${sinceId}` : '');
    const data = await shopifyGet(url);
    const batch = data.products || [];
    if (!batch.length) break;

    for (const p of batch) {
      if (SUPPLEMENT_TYPES.has(p.product_type)) {
        products.push(p);
      }
    }

    process.stdout.write(`\rFetched ${products.length} supplements so far (batch ${batch.length})...`);
    if (batch.length < 250) break;
    sinceId = batch[batch.length - 1].id;
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }
  console.log(`\nTotal supplement products from Shopify: ${products.length}`);
  return products;
}

// Download a file from a URL to a local path
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Sanitise a product name into a safe filename
function toFilename(name, index) {
  const safe = name
    .replace(/[<>:"/\\|?*]/g, '')   // remove illegal chars
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
  return index === 0 ? `${safe}.jpg` : `${safe} ${index + 1}.jpg`;
}

// Fuzzy name match: normalise and compare
function normaliseName(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');
  console.log('Image dir:', IMAGE_DIR);
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  // 1. Fetch Shopify supplements
  const shopifyProducts = await fetchAllShopifySupplements();

  // Filter to only products that actually have images
  const withImages = shopifyProducts.filter(p => p.images && p.images.length > 0);
  const multiImage = withImages.filter(p => p.images.length > 1);
  console.log(`  With images: ${withImages.length}`);
  console.log(`  With multiple images: ${multiImage.length}`);

  // 2. Fetch DB products
  const { rows: dbProducts } = await pool.query(
    'SELECT id, name, images FROM products ORDER BY name'
  );
  console.log(`DB products: ${dbProducts.length}`);

  // Build a lookup map: normalised name → db product
  const dbMap = {};
  for (const p of dbProducts) {
    dbMap[normaliseName(p.name)] = p;
  }

  // Also build a list for fuzzy fallback matching
  const dbList = dbProducts.map(p => ({ key: normaliseName(p.name), p }));

  // 3. Match Shopify → DB and process images
  const results = { matched: 0, skipped: 0, notFound: [], updated: [] };

  for (const sp of withImages) {
    const key = normaliseName(sp.title);
    let dbProduct = dbMap[key];

    // Fuzzy fallback: try starts-with or contains matching on first 4 words
    if (!dbProduct) {
      const words = key.split(' ').slice(0, 4).join(' ');
      const fuzzy = dbList.find(({ key: k }) =>
        k.startsWith(words) || words.startsWith(k.split(' ').slice(0, 4).join(' '))
      );
      if (fuzzy) {
        dbProduct = fuzzy.p;
        console.log(`\n  🔀 Fuzzy match: "${sp.title}" → "${dbProduct.name}"`);
      }
    }

    if (!dbProduct) {
      results.notFound.push(sp.title);
      continue;
    }

    const currentImages = Array.isArray(dbProduct.images) ? dbProduct.images : [];
    const shopifyImages = sp.images.sort((a, b) => a.position - b.position);

    // Check if this product already has the right number of images
    if (currentImages.length >= shopifyImages.length && !DRY_RUN) {
      results.skipped++;
      continue;
    }

    console.log(`\n📦 ${sp.title} (${shopifyImages.length} images)`);

    const newImagePaths = [];

    for (let i = 0; i < shopifyImages.length; i++) {
      const shopifyImg = shopifyImages[i];
      const filename = toFilename(sp.title, i);
      const localPath = path.join(IMAGE_DIR, filename);
      const publicPath = `/images/products/${filename}`;

      // Strip Shopify query params for clean download URL
      const downloadUrl = shopifyImg.src.split('?')[0];

      if (!DRY_RUN) {
        try {
          await downloadFile(downloadUrl, localPath);
          console.log(`  ✅ Downloaded: ${filename}`);
        } catch (err) {
          console.error(`  ❌ Failed to download image ${i + 1}: ${err.message}`);
          // Fall back to Shopify CDN URL if download fails
          newImagePaths.push(shopifyImg.src);
          continue;
        }
      } else {
        console.log(`  [DRY] Would download: ${downloadUrl}`);
        console.log(`        → save as: ${filename}`);
        console.log(`        → alt text: ${sp.title}`);
      }

      newImagePaths.push(publicPath);
    }

    if (!DRY_RUN && newImagePaths.length > 0) {
      await pool.query(
        'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(newImagePaths), dbProduct.id]
      );
      console.log(`  💾 DB updated: ${newImagePaths.length} images`);
      results.updated.push({ name: sp.title, count: newImagePaths.length });
    }

    results.matched++;
    await new Promise(r => setTimeout(r, 100)); // small delay between downloads
  }

  // 4. Summary
  console.log('\n═══════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════');
  console.log(`Matched & processed: ${results.matched}`);
  console.log(`Skipped (already up to date): ${results.skipped}`);
  console.log(`Not found in DB: ${results.notFound.length}`);

  if (results.notFound.length) {
    console.log('\nNot matched (Shopify title not in DB):');
    results.notFound.forEach(n => console.log('  -', n));
  }

  if (results.updated.length) {
    console.log('\nUpdated products:');
    results.updated.forEach(u => console.log(`  - ${u.name} (${u.count} images)`));
  }

  // Save full report
  const reportPath = path.join(__dirname, 'image-sync-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nFull report saved to scripts/image-sync-report.json`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
