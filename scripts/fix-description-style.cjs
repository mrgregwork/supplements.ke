// Fix description style across all products:
// 1. Remove all em-dashes (—) from short and long descriptions
// 2. Enforce max 2 sentences in short descriptions
//
// Usage: node scripts/fix-description-style.cjs
//        node scripts/fix-description-style.cjs --dry

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY = process.argv.includes('--dry');

// Replace em-dashes with context-appropriate punctuation
function removeEmDashes(text) {
  if (!text) return text;
  // " — " surrounded by spaces → ", "
  return text
    .replace(/ — /g, ', ')
    .replace(/—/g, ', ')   // any remaining bare em-dashes
    .replace(/ ,/g, ',')   // clean up any double-space-comma artifacts
    .replace(/,,/g, ',');  // clean up double commas
}

// Enforce max 2 sentences. Split on ". ", "! ", "? " boundaries.
function maxTwoSentences(text) {
  if (!text) return text;

  // Split into sentences (keep the delimiter attached)
  const sentenceRegex = /[^.!?]+[.!?]+(\s|$)/g;
  const sentences = [];
  let match;
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push(match[0].trim());
  }

  if (sentences.length <= 2) return text.trim();

  // Keep only first 2 sentences
  return sentences.slice(0, 2).join(' ').trim();
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, slug, description, long_description FROM products
     WHERE description IS NOT NULL OR long_description IS NOT NULL`
  );

  console.log(`Processing ${rows.length} products…\n`);

  let updated = 0;
  for (const row of rows) {
    const newShort = maxTwoSentences(removeEmDashes(row.description));
    const newLong  = removeEmDashes(row.long_description);

    const shortChanged = newShort !== row.description;
    const longChanged  = newLong  !== row.long_description;

    if (!shortChanged && !longChanged) continue;

    if (DRY) {
      if (shortChanged) {
        console.log(`[${row.slug}] SHORT:\n  WAS: ${row.description}\n  NOW: ${newShort}\n`);
      }
      if (longChanged) {
        console.log(`[${row.slug}] LONG: em-dashes removed\n`);
      }
    } else {
      await pool.query(
        `UPDATE products SET description=$1, long_description=$2, updated_at=NOW() WHERE id=$3`,
        [newShort, newLong, row.id]
      );
      updated++;
      if (updated % 20 === 0) process.stdout.write(`  ${updated} updated…\r`);
    }
  }

  if (DRY) {
    console.log('\nDry run complete. Run without --dry to apply changes.');
  } else {
    console.log(`\nDone. ${updated} products updated.`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
