# Supplements Kenya — Roadmap & Status

Current status, what's shipped, and open questions — the living checklist
companion to [`CLAUDE.md`](../CLAUDE.md) (standing rules) and
[`RUNBOOK.md`](RUNBOOK.md) (how to run things). Keep this in sync as work
lands; don't let it go stale the way an unmaintained changelog does — if a
section below is wrong, fix it rather than leaving it.

First compiled 24/09/2026 from `git log`, the previous CLAUDE.md's own
"Pending / known issues" list, and a codebase pass; brought fully up to date
03/10/2026 against `git log` and the live Railway state (see §2a for the
dated timeline). Treat "Done" as "shipped and present in the code," not as
"manually re-verified live today," unless an entry says it was verified live.
Correct any entry that turns out to be stale.

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
  Every charge carries a short pre-generated order code (max 12 characters,
  Safaricom's limit) as the M-Pesa account reference, reused as the order
  number, plus a gateway description summarising the order (e.g.
  `Whey Protein Isol x2 +1`) instead of a fixed phrase.
- Transactional emails (login code, order confirmation) — branded to match
  the storefront's own colours (`src/lib/emailTemplate.ts`), sent from
  `noreply@supplements.ke` via Resend (domain verified). Full table-based
  HTML with Gmail dark-mode protection; see `docs/PAYMENT_INTEGRATION.md`
  §2.5.
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

## 2a. Timeline of work since 24/09/2026

Newest last. Dates are commit dates from `git log`; "live" means verified
against the real production site, not just pushed.

- **24/09/2026** — Category/subcategory deletion protected with a `409` when
  products depend on it (`bf9e093`). `CLAUDE.md` rewritten to match the
  sibling project's standards (Engineering Standards, Safety Rules, Template
  principles) and the `RUNBOOK.md` / `ROADMAP.md` split introduced.
- **30/09/2026 — Database moved from Neon to Railway Postgres** (`57ab20d`).
  All 19 tables copied and verified, cutover verified live, local access via
  SSH tunnel. Git policy tightened: commit, push and deploy each need
  explicit go-ahead (`740d8d3`).
- **30/09/2026 — E-Payments integration built** (`288f312`): M-Pesa STK push
  and Paystack card via one `checkout/init` route, `pending_orders` staging
  table, webhook + client status-poll + reconciliation cron all converging
  on `finalizePendingOrder()`. Payment fields added to `orders`.
- **30/09/2026 — Live-verified with real money** (`b6c8bac`): a real KES 1
  M-Pesa charge and a real KES 5 card charge, both confirmed end to end.
  Standing test amounts (KES 1 M-Pesa, KES 5 card) recorded in
  `docs/PAYMENT_INTEGRATION.md` §5a. Throwaway draft test products kept (real
  orders reference them).
- **30/09/2026 — Reconciliation cron provisioned as real infrastructure**
  (`291fa20`): Railway Cron Job service `supplements-reconcile-epayments`,
  every 5 minutes, defined as code in `.railway/railway.ts` and confirmed
  running. Both the web service and the cron connect to the `Postgres`
  service via `DATABASE_URL`.
- **30/09/2026 — Repeat guest checkout crash fixed** (`de1395b`): a second
  checkout with the same email or phone hit a unique-constraint error (500).
  Now drops the colliding field and retries; constraint matched by
  substring because naming differs by how a database's schema was created.
- **30/09/2026 — Raw UUID in the M-Pesa SMS fixed** (`6ac714e`, `63d47d4`):
  the customer's SMS showed a 36-character ID as the "account". Replaced
  with a short order code (12 characters max, a real Safaricom limit) reused
  as the order number. Confirmed live on both M-Pesa and card.
- **30/09/2026 — Branded transactional emails** (`58b7e46`): login code and
  order confirmation rebuilt in the storefront's cream/emerald/gold.
- **03/10/2026 — Order description** (`b666999`): the gateway description
  (shown in E-Payments' own "Payment received" email) now summarises the
  order instead of the fixed text "Supplements Kenya order"; full item list
  sent as metadata. Recorded as a standing payment-integration convention.
- **03/10/2026 — Email hardening (written, not yet committed/pushed):**
  `src/lib/emailTemplate.ts` rebuilt as a full table-based HTML document
  with `color-scheme: light only` tags, no flexbox, and derived hex fallback
  colours, to stop Gmail dark mode washing out the colours. Documented in
  `docs/PAYMENT_INTEGRATION.md` §2.5 and `CLAUDE.md`. Needs a real order
  after deploy to confirm in a real inbox.

---

## 3. Known open items

- **Payments are live; follow-ups only.** Real M-Pesa and card checkout work
  and were verified with real money (see §2a and
  `docs/PAYMENT_INTEGRATION.md` §5a). Still to do: confirm the new order
  description appears correctly in E-Payments' email after the next deploy,
  and confirm the hardened confirmation email renders properly in a real
  Gmail dark-mode inbox (a KES 1 M-Pesa test covers both).
- **Reconciliation cron email key — fixed 03/10/2026.** The cron originally
  had only `DATABASE_URL`, `EPAYMENTS_API_URL` and `EPAYMENTS_API_KEY`, so an
  order the cron (rather than the webhook or the customer's own browser poll)
  confirmed would have skipped the confirmation email silently. `RESEND_API_KEY`
  was added, **but a follow-up check the same day found that all three
  variables the cron borrowed from the web service
  (`EPAYMENTS_API_URL`, `EPAYMENTS_API_KEY`, `RESEND_API_KEY`) were reading
  back empty** — the cron had only ever looked healthy because it found "0
  stuck orders", so it never needed them. Cause: a `ref()` to the service
  named `supplements.ke` resolves to an empty string (apparently the dot in
  the name; the same pattern works on a service with no dot). Fixed
  03/10/2026 by setting the three values directly on the cron service (copied
  from the web service, now identical) and marking them `preserve()` in
  `.railway/railway.ts`. **If any of those three change on the web service
  (key rotation, new Resend key), copy the new value to the cron service too**
  — nothing links them any more. Still to confirm: a real order resolved by
  the cron, and the next cron run in `railway logs` showing no E-Payments
  errors.
- **Railway CLI permission gap — partly cleared.** From 01/10/2026 `railway
  redeploy`, the deploy API mutation and `railway config plan` returned "You
  do not have access to this resource" for this project. By 03/10/2026
  `railway config plan` and `railway config apply` work again; `redeploy`
  has not been re-tested. Cause never identified (likely a workspace role
  limit that has since changed). Git-push deploys were never affected.
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
- Does `railway redeploy` work again now that `config plan`/`apply` do?
  (See §3.)
- Should the ~35 files with hardcoded Kenya/Nairobi copy be migrated to
  `getSiteSettings()`, given this codebase's role as the original
  template? Not urgent for the live site, but worth a decision if this
  project is ever cloned again.
- Any priority order for the items in §3, or fine to pick up
  opportunistically as related work touches them?
