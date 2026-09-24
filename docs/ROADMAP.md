# Supplements Kenya — Roadmap & Status

Current status, what's shipped, and open questions — the living checklist
companion to [`CLAUDE.md`](../CLAUDE.md) (standing rules) and
[`RUNBOOK.md`](RUNBOOK.md) (how to run things). Keep this in sync as work
lands; don't let it go stale the way an unmaintained changelog does — if a
section below is wrong, fix it rather than leaving it.

This first version was compiled 24/09/2026 from `git log`, the previous
CLAUDE.md's own "Pending / known issues" list, and a codebase pass — not a
line-by-line audit of every feature below. Treat "Done" as "shipped and
present in the code," not as "manually re-verified live today." Correct any
entry that turns out to be stale.

---

## 1. What this app is

Live e-commerce supplements store at supplements.ke, and originally
scaffolded as a distributable niche template — cosmetics.ke was cloned from
this codebase. Astro 5 SSR + Node + Neon Postgres + Railway.

---

## 2. Feature inventory

### Storefront

- Category → Subcategory → Product browsing — Done.
- Brand pages (`src/pages/brand/`) — present.
- Cart + checkout — order creation works (`/api/checkout.ts`,
  `/api/cod-order.ts` for cash-on-delivery); **no payment gateway is wired
  in** — checkout/COD currently just record the order, same gap as
  cosmetics.ke.
- Customer accounts — OTP-based login (`/api/auth/request-otp`,
  `/api/auth/verify-otp`), account/orders pages.
- Blog — categories with admin CRUD, public archive pages, rich
  WordPress-style editor with a top/bottom content split, per-post
  featured-image toggle. Most recently shipped feature area (see
  `git log`).

### Admin

- Product CRUD, descriptions applied via `scripts/apply-product-descriptions.cjs`.
- Category/subcategory CRUD — deletion now blocked with a `409` when
  products still reference the entity (fixed 24/09/2026, mirroring
  cosmetics.ke's guard; previously deleted unconditionally with no
  protection at all).
- Navigation management (`navigation_items`).
- Homepage content, SEO settings, attribute definitions.
- Image uploads via `POST /api/upload` (multipart, local disk / optional
  Railway Volume — see §3 below, this is an open risk, not a solved one).
- `src/pages/api/admin/verify-license.ts` — legacy scaffold from the
  original template's license-gating model; "demo mode" accepts any
  10+ character string as valid and nothing else in the app appears to
  enforce it. Treat as dead code, not a real gate.

### Known, already-fixed gotchas (kept here so they aren't rediscovered)

- Category/subcategory deletion had zero product-dependency protection —
  fixed 24/09/2026 (`src/pages/api/admin/categories/[id].ts`,
  `src/pages/api/admin/subcategories/[id].ts`), same pattern as
  cosmetics.ke's guard: counts direct + subcategory products (deduped by
  id), returns `409` with the count if any exist, cascades subcategory
  deletion only once confirmed empty.

---

## 3. Known open items

- **No payment gateway.** Checkout and the cash-on-delivery flow create
  order records with no real charge. Flag to the owner before this is
  assumed to be a working checkout in front of a customer.
- **Upload persistence across deploys is unverified.** Admin-uploaded
  images fall back to the container's local filesystem unless a Railway
  Volume is attached (`RAILWAY_VOLUME_MOUNT_PATH`) — not confirmed either
  way as of this writing. Check the Railway dashboard before relying on any
  uploaded blog/category image surviving the next deploy. See `CLAUDE.md` →
  "Admin uploads."
- **Template principle gap: ~35 files hardcode "Kenya"/"Nairobi"** in
  generated copy, including the product-page SEO meta title variants.
  `getSiteSettings()` exists (`src/lib/settings.ts`) but isn't wired into
  most of this content yet, unlike cosmetics.ke. Not urgent for the live
  site itself, but relevant if this codebase is ever cloned again the way
  cosmetics.ke was.
- **Related products:** a fix was pushed as commit `e1ba3eb` (fetches via
  `getProductsBySubcategory` + `getProductsByBrand` fallback) — not
  re-verified live in this pass.
- **Life Extension descriptions:** a 15-pattern file exists at
  `scripts/data/le-omega3-15-patterns.json` / `le-all-15patterns.json` —
  generated but review/application to the live LE products not confirmed
  done.
- **Google Search Console:** not yet set up — submit sitemap once the site
  is confirmed stable.
- **Category/subcategory filter UI:** nofollow/noindex on filtered URLs —
  old pending task, not re-verified this pass.
- **Performance:** Lighthouse was last measured at 53/100. Main suspects:
  Neon cold start (~700ms server response) and JavaScript bundle size.
- **`scripts/` directory is cluttered** with one-off legacy scripts (several
  prefixed `_`) from the original description/cleanup passes. Worth a
  tidy-up pass eventually; not urgent. See `RUNBOOK.md` §4.
- **Local `.env` is currently empty** — `DATABASE_URL` (and anything else
  `server/db.ts` needs) isn't set locally as of this writing, so `npm run
  dev` can't reach the database until that's configured. See `RUNBOOK.md`
  §1.

---

## 4. Environment variables — current status

Local `.env` at the repo root is present but empty (0 bytes) as of this
pass — needs `DATABASE_URL` populated from Railway's env vars before local
dev can run against the database. Not independently re-verified against
Railway's actual env var store for what else may be configured there
(e.g. `LICENSE_SERVER_URL`, email/OTP provider keys).

---

## 5. Open questions for the owner

- **Is a Railway Volume attached to this service?** Determines whether
  admin-uploaded images (blog, category) survive a redeploy. This is the
  single most actionable unknown in this file — see §3.
- Is a real payment gateway planned for checkout (M-Pesa, card, etc.), and
  if so which one? Same open question cosmetics.ke has.
- Should the ~35 files with hardcoded Kenya/Nairobi copy be migrated to
  `getSiteSettings()`, given this codebase's role as the original
  template? Not urgent for the live site, but worth a decision if this
  project is ever cloned again.
- Any priority order for the items in §3, or fine to pick up
  opportunistically as related work touches them?
