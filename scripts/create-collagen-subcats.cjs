require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const subcategories = [
  { name: 'Collagen Powder',          description: 'Collagen peptides and powder supplements for easy mixing into drinks and recipes.' },
  { name: 'Marine Collagen',          description: 'Fish-derived marine collagen supplements for skin, hair, and joint support.' },
  { name: 'Collagen Tablets',         description: 'Convenient collagen capsules and tablets for daily supplementation.' },
  { name: 'Collagen Gummies',         description: 'Chewable collagen gummies — a delicious way to support skin and joints.' },
  { name: 'Flavored Collagen',        description: 'Flavored collagen powders in chocolate, vanilla, berry and more.' },
  { name: 'Beauty Collagen',          description: 'Collagen formulas with added biotin, vitamin C, and hyaluronic acid for skin beauty.' },
  { name: 'Best Collagen for Skin',   description: 'Top-rated collagen supplements specifically formulated for skin firmness and glow.' },
];

async function main() {
  // Find collagen category
  const { rows } = await pool.query(
    "SELECT id, name, slug FROM categories WHERE LOWER(name) = 'collagen' LIMIT 1"
  );
  if (!rows.length) { console.error('Collagen category not found'); process.exit(1); }
  const cat = rows[0];
  console.log(`Found category: "${cat.name}" (${cat.id})`);

  for (let i = 0; i < subcategories.length; i++) {
    const sub = subcategories[i];
    const slug = slugify(sub.name);

    // Check if already exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2',
      [cat.id, slug]
    );
    if (existing.length) {
      console.log(`  SKIP (exists): ${sub.name}`);
      continue;
    }

    await pool.query(
      `INSERT INTO subcategories (id, name, slug, description, category_id, is_active, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())`,
      [sub.name, slug, sub.description, cat.id, i + 1]
    );
    console.log(`  CREATED: ${sub.name} (/${cat.slug}/${slug}/)`);
  }

  const { rows: all } = await pool.query(
    'SELECT name, slug FROM subcategories WHERE category_id = $1 ORDER BY sort_order',
    [cat.id]
  );
  console.log(`\nAll Collagen subcategories (${all.length}):`);
  all.forEach(s => console.log(`  - ${s.name}  → /collagen/${s.slug}/`));

  await pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });
