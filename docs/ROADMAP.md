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
this codebase. Astro 5 SSR + Node + Railway Postgres + Railway, same
database setup as cosmetics.ke ("Template principles"). Migrated from Neon
to Railway Postgres 30/09/2026 — see `CLAUDE.md` and §2 below.

---

## 2. Feature inventory

### Storefront

- Category → Subcategory → Product browsing — Done.
- Brand pages (`src/pages/brand/`) — present.
- Cart + checkout — real M-Pesa + Card payments via E-Payments, built and
  **live, verified 30/09/2026** with a real KES 1 M-Pesa charge and a real
  KES 5 Paystack charge, both confirmed end to end (`/api/checkout/init.ts`
  → `src/lib/epayments.ts` → webhook/poll/cron finalize). See
  `docs/PAYMENT_INTEGRATION.md` §5a. `/api/cod-order.ts` (cash-on-delivery)
  remains its own separate, working, no-payment-needed path. The old
  `/api/checkout.ts` ("Demo Mode") is left in place, unused by the UI.
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
- **Database moved from Neon to Railway Postgres, 30/09/2026** — done, to
  match how cosmetics.ke is deployed. All 19 tables copied and
  row-count-verified before cutover; the live cutover itself was verified
  with a temporary test row (created directly in the new database, checked
  live on `https://supplements.ke`, then deleted). Old Neon project kept
  untouched for now as a fallback, not wired up as a fallback in code.

---

## 3. Known open items

- **Payment integration built but not yet live.** M-Pesa + Card via
  E-Payments is fully wired (see `docs/PAYMENT_INTEGRATION.md`) but needs:
  (1) supplements.ke registered as its own merchant on E-Payments with its
  own credentials, (2) `EPAYMENTS_API_KEY`/`EPAYMENTS_WEBHOOK_SECRET` set in
  Railway, (3) end-to-end sandbox testing of both M-Pesa and Card, (4)
  explicit approval before switching to live credentials, verified with one
  real small-value M-Pesa charge. Flag to the owner before assuming
  checkout takes real payments today. The reconciliation cron
  (`scripts/reconcile-epayments.ts`) also isn't yet provisioned as actual
  Railway infrastructure (a scheduled Cron Job service) — script exists,
  nothing runs it on a schedule yet.
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
- **Performance:** Lighthouse was last measured at 53/100 (before the
  Railway Postgres migration — the ~700ms server response then was
  attributed to Neon's serverless cold start). Not yet re-measured against
  Railway Postgres, which doesn't auto-suspend the same way; JavaScript
  bundle size is the other known suspect either way.
- **`scripts/` directory is cluttered** with one-off legacy scripts (several
  prefixed `_`) from the original description/cleanup passes. Worth a
  tidy-up pass eventually; not urgent. See `RUNBOOK.md` §4.
- **Local `.env` is currently empty** — `DATABASE_URL` (and anything else
  `server/db.ts` needs) isn't set locally as of this writing, so `npm run
  dev` can't reach the database until an SSH tunnel is opened and its URL
  copied in. See `RUNBOOK.md` §1.

---

## 4. Environment variables — current status

Local `.env` at the repo root is present but empty (0 bytes) as of this
pass — needs `DATABASE_URL` populated from an SSH tunnel to the Railway
Postgres service (see `RUNBOOK.md` §1) before local dev can run against the
database; the database has no public host to copy a static connection
string from anymore. Not independently re-verified against Railway's actual
env var store for what else may be configured there (e.g.
`LICENSE_SERVER_URL`, email/OTP provider keys).

---

## 5. Open questions for the owner

- **Is a Railway Volume attached to this service?** Determines whether
  admin-uploaded images (blog, category) survive a redeploy. This is the
  single most actionable unknown in this file — see §3.
- **Has supplements.ke been registered as its own merchant on E-Payments
  yet?** The integration is built and waiting on this — see
  `docs/PAYMENT_INTEGRATION.md` §4. Needed before any sandbox testing can
  start.
- Once sandbox-tested, when should live M-Pesa/Paystack credentials be
  switched on? Needs the owner's explicit go-ahead, not an assumption.
- Should the ~35 files with hardcoded Kenya/Nairobi copy be migrated to
  `getSiteSettings()`, given this codebase's role as the original
  template? Not urgent for the live site, but worth a decision if this
  project is ever cloned again.
- Any priority order for the items in §3, or fine to pick up
  opportunistically as related work touches them?
