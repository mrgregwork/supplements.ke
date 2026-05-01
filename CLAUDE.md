# Supplements Kenya — Project Brief for Claude

## What this project is
E-commerce supplements store at **supplements.co.ke**. Sells health supplements only (no cosmetics/skincare). Built with Astro SSR + Node.js + Neon PostgreSQL + Railway hosting.

## Stack
- **Frontend/SSR**: Astro 5 (`output: 'server'`, `@astrojs/node` standalone adapter)
- **Database**: Neon PostgreSQL (project: `weathered-base-05591763`, org: `org-snowy-shadow-41735691`)
- **Hosting**: Railway (auto-deploys from GitHub on every push)
- **GitHub**: `mrgregwork/supplementsKenya` (branch: `master`)
- **Domain**: supplements.co.ke (DNS via Cloudflare → Railway CNAME)
- **Admin panel**: `/admin` (login required)

## Key files
- `astro.config.mjs` — Astro config, allowedHosts includes supplements.co.ke and .railway.app
- `server/index.ts` — Entry point: runs `dist/server/entry.mjs` in prod, falls back to `astro dev`
- `server/storage.ts` — All DB access via Drizzle ORM + pg pool
- `server/db.ts` — exports `db` (Drizzle) and `pool` (pg Pool)
- `script/build.ts` — Build: runs `npx astro build` then esbuild for server wrapper
- `src/pages/[category]/[subcategory]/[product].astro` — Product page
- `src/layouts/BaseLayout.astro` — Global layout (favicon, fonts, meta)
- `src/lib/storage.ts` — Re-exports from `server/storage`
- `scripts/apply-product-descriptions.cjs` — Applies descriptions JSON to DB
- `scripts/fix-description-style.cjs` — Removes em-dashes, enforces 2-sentence short descs
- `railway.toml` — Explicit Railway build/start commands

## How to deploy
Just `git push origin master` — Railway auto-deploys. Takes ~2-3 minutes.
**No need to ask user approval before pushing.**

## Database — important rules
- Neon free tier: auto-suspends when idle, wakes on first connection (expect 1-2s cold start)
- Use `mcp__Neon__run_sql` with projectId `weathered-base-05591763` for direct DB queries
- Products table has: `slug`, `name`, `brand`, `description` (short), `long_description` (HTML),
  `seo_title`, `seo_description`, `category_id`, `subcategory_id`, `category_slug`,
  `subcategory_slug`, `price`, `images` (jsonb), `attributes` (jsonb), `featured`

## What has been done (completed work)

### Descriptions
- Generated 262 product descriptions using `scripts/generate-descriptions.cjs`
  (patterns B/C/D applied via DJB2 hash, Life Extension got 15 custom patterns)
- Applied to DB via `scripts/apply-product-descriptions.cjs --file=all-descriptions.json`
- Fixed 36 mismatched descriptions (bentonite clay on colon cleanse, omega-3 on ashwagandha, etc.)
- Removed all em-dashes (—) from all descriptions, enforced 2-sentence max on short descriptions
- Description style rules: NO em-dashes, max 2 sentences per short description, British English

### SEO / Meta titles
- Product page meta titles now use 3 rotating variants (deterministic by slug hash):
  1. `{Name} in Kenya | Same-Day Delivery in Nairobi`
  2. `{Name} in Kenya | Price in Kenya | Order on WhatsApp`
  3. `{Name} in Kenya | Shop in Nairobi`

### Favicon
- `public/favicon.svg` — green rounded square with "SK" (primary favicon)
- `public/favicon-32x32.png`, `public/favicon-16x16.png`, `public/apple-touch-icon.png`
- All referenced correctly in `BaseLayout.astro`

### Performance
- Google Fonts loaded async (non-render-blocking) in BaseLayout.astro
- Production build now uses `astro build` → `dist/server/entry.mjs` (proper SSR)

### Data cleanup
- Deleted 4 cosmetic/non-supplement products: Olay lotion, Lubriderm lotion,
  Neutrogena sunscreen, Glo Melanin soap
- Kept hormone creams (progesterone, estrogen) — legitimately sold on supplement sites

### Related products (in progress — may need verification)
- `src/pages/[category]/[subcategory]/[product].astro` fetches related products inline
  using `getProductsBySubcategory` + `getProductsByBrand` fallback
- Shows "You may also like" grid of 4 ProductCards at bottom of product pages
- Latest fix pushed as commit `e1ba3eb` — verify this works after redeploy

## Pending / known issues
- Related products: verify they now appear after latest Railway redeploy (commit e1ba3eb)
- Life Extension descriptions: 15-pattern file at `scripts/data/le-omega3-15-patterns.json`
  (spawned as separate task) — needs review and possible application to LE products
- Google Search Console: not yet set up (submit sitemap after confirming site is stable)
- Category/subcategory page filter UI: nofollow/noindex on filtered URLs (old pending task)
- Performance score was 53/100 on Lighthouse — main remaining issues:
  - Server response time (Neon cold start, ~700ms)
  - Large JavaScript bundle size

## User preferences
- Pre-approves all pushes to GitHub — never ask for approval before pushing
- British English in all content (organise, colour, recognise)
- No em-dashes anywhere in descriptions
- Max 2 sentences per short product description
- No AI-detectable patterns in descriptions or meta titles
- User is non-technical ("vibe coder") — explain things simply

## Useful commands
```bash
# Push to GitHub (triggers Railway redeploy)
git add -A && git commit -m "message" && git push origin master

# Apply a descriptions JSON file to the database
node scripts/apply-product-descriptions.cjs --file=filename.json

# Fix em-dashes and 2-sentence limit across all products
node scripts/fix-description-style.cjs

# Dry-run the above
node scripts/fix-description-style.cjs --dry
```
