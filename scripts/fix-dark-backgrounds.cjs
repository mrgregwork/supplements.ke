/**
 * Scans all product images, detects dark/black backgrounds,
 * and replaces them with white using flood-fill from the corners.
 *
 * Works for:
 *   - PNG sources with transparency that became black when saved as JPEG
 *   - Product photos taken against a dark/black background
 *
 * Run: node scripts/fix-dark-backgrounds.cjs
 * Options:
 *   --dry-run       Report affected images without modifying files
 *   --limit=N       Only process first N images (for testing)
 *   --threshold=N   Darkness threshold 0-255 (default: 45)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const limitArg  = args.find(a => a.startsWith('--limit='));
const threshArg = args.find(a => a.startsWith('--threshold='));
const LIMIT     = limitArg  ? parseInt(limitArg.split('=')[1])  : Infinity;
const THRESHOLD = threshArg ? parseInt(threshArg.split('=')[1]) : 45;

const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'products');

// ── Flood-fill from all 4 corners ──────────────────────────────────────────
// Replaces all dark pixels that are CONNECTED to a corner with white.
// Uses BFS so it only removes the background, not dark pixels inside the product.
function floodFillWhite(data, width, height, channels, threshold) {
  const visited = new Uint8Array(width * height); // 0 = unvisited
  const stack = [];

  function isDark(idx) {
    return data[idx] < threshold && data[idx + 1] < threshold && data[idx + 2] < threshold;
  }

  // Seed from all 4 corners
  for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
    const pos = y * width + x;
    if (!visited[pos] && isDark(pos * channels)) {
      stack.push(pos);
      visited[pos] = 1;
    }
  }

  // Also seed from every edge pixel (handles images where background
  // doesn't quite reach the exact corner pixel)
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const pos = y * width + x;
      if (!visited[pos] && isDark(pos * channels)) { stack.push(pos); visited[pos] = 1; }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const pos = y * width + x;
      if (!visited[pos] && isDark(pos * channels)) { stack.push(pos); visited[pos] = 1; }
    }
  }

  let filled = 0;
  while (stack.length > 0) {
    const pos = stack.pop();
    const idx = pos * channels;

    // Paint white
    data[idx]     = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    filled++;

    const x = pos % width;
    const y = Math.floor(pos / width);

    // 4-connected neighbours
    if (x > 0)          { const n = pos - 1;     if (!visited[n] && isDark(n * channels)) { visited[n] = 1; stack.push(n); } }
    if (x < width - 1)  { const n = pos + 1;     if (!visited[n] && isDark(n * channels)) { visited[n] = 1; stack.push(n); } }
    if (y > 0)          { const n = pos - width;  if (!visited[n] && isDark(n * channels)) { visited[n] = 1; stack.push(n); } }
    if (y < height - 1) { const n = pos + width;  if (!visited[n] && isDark(n * channels)) { visited[n] = 1; stack.push(n); } }
  }

  return filled;
}

// ── Check if image corners are dark (quick pre-filter) ─────────────────────
function cornersDark(data, width, height, channels, threshold) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    // also sample some edge midpoints
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
  ];
  let darkCount = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * channels;
    if (data[i] < threshold && data[i + 1] < threshold && data[i + 2] < threshold) darkCount++;
  }
  return darkCount >= 3; // at least 3 of 6 sample points are dark
}

async function main() {
  console.log(`\n=== Fix Dark Backgrounds ===`);
  console.log(`Directory : ${IMAGE_DIR}`);
  console.log(`Threshold : ${THRESHOLD} (pixels darker than this are background)`);
  if (DRY_RUN) console.log('DRY RUN — no files will be modified');
  console.log('');

  const files = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
    .slice(0, LIMIT);

  console.log(`Images to scan: ${files.length}`);

  let fixed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(IMAGE_DIR, file);

    try {
      const { data, info } = await sharp(filePath)
        .ensureAlpha()    // add alpha channel if missing (converts to RGBA)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels; // 4 (RGBA)
      const { width, height } = info;

      if (!cornersDark(data, width, height, channels, THRESHOLD)) {
        skipped++;
        continue;
      }

      const pct = Math.round(((i + 1) / files.length) * 100);
      process.stdout.write(`[${i + 1}/${files.length}] ${file.padEnd(45)} dark background detected... `);

      if (DRY_RUN) {
        process.stdout.write('(dry run)\n');
        fixed++;
        continue;
      }

      const filled = floodFillWhite(data, width, height, channels, THRESHOLD);

      // Write to a temp file then replace (sharp can't write to file it's reading)
      const tmpPath = filePath + '.tmp';
      await sharp(Buffer.from(data), {
        raw: { width, height, channels },
      })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 92, progressive: true })
        .toFile(tmpPath);

      fs.renameSync(tmpPath, filePath);
      process.stdout.write(`fixed (${filled.toLocaleString()} px repainted)\n`);
      fixed++;

    } catch (err) {
      process.stdout.write(`\n  ERROR: ${err.message}\n`);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed   : ${fixed}`);
  console.log(`Skipped : ${skipped}  (already have light backgrounds)`);
  console.log(`Errors  : ${errors}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
