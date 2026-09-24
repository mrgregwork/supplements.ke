# Supplements Kenya — Project Brief for Claude

## What this project is

**For repeatable local development, database, testing, content, and deployment procedures, read [`docs/RUNBOOK.md`](docs/RUNBOOK.md).** This file contains the standing rules and safety constraints; the runbook contains the step-by-step operational procedures. Current status and open items live in [`docs/ROADMAP.md`](docs/ROADMAP.md).

E-commerce supplements store at **supplements.ke**. Sells health supplements only (no cosmetics/skincare). Built with Astro SSR + Node.js + Neon PostgreSQL + Railway hosting — same stack as its sibling project, cosmetics.ke, which was scaffolded from this codebase.

**This codebase was originally built as a distributable template** (the old `replit.md` describes it as "a production-ready, SEO-optimised e-commerce template... designed for distribution and deployment across numerous websites in various niches"), and cosmetics.ke was in fact cloned from it. That template ambition is still live — see "Template principles" below before changing anything that isn't supplements-specific, and note the "Template principles vs. current state" gap called out there: this file hasn't been holding up that side of the bargain as strictly as cosmetics.ke's has.

## Stack

- **Frontend/SSR**: Astro 5 (`output: 'server'`, `@astrojs/node` standalone adapter)
- **Database**: Neon PostgreSQL (project: `weathered-base-05591763`, org: `org-snowy-shadow-41735691`) — connection string belongs in Railway env vars / local `.env` as `DATABASE_URL`, never in this file or any committed doc
- **Hosting**: Railway (auto-deploys from GitHub `master` on every push)
- **GitHub**: `mrgregwork/supplements.ke` (branch: `master`)
- **Domain**: supplements.ke (DNS via Cloudflare → Railway CNAME)
- **Admin panel**: `/admin` (login required in production; dev mode bypasses auth — see "Authentication and application security" below)

## Key files

- `astro.config.mjs` — Astro config, allowedHosts includes supplements.ke and .railway.app
- `server/index.ts` — Entry point: runs `dist/server/entry.mjs` in prod, falls back to `astro dev`
- `server/storage.ts` — All DB access via Drizzle ORM + pg pool
- `server/db.ts` — exports `db` (Drizzle) and `pool` (pg Pool)
- `shared/schema.ts` — Drizzle schema, all tables (products, categories, subcategories, orders, blog, etc.)
- `script/build.ts` — Build: runs `npx astro build` then esbuild for server wrapper
- `src/pages/[category]/[subcategory]/[product].astro` — Product page
- `src/pages/admin/blog/` + `src/pages/api/admin/blog/` — Blog CRUD, categories, rich editor (most recently shipped feature area)
- `src/layouts/BaseLayout.astro` — Global layout (favicon, fonts, meta)
- `src/lib/storage.ts` — Re-exports from `server/storage`
- `src/lib/admin.ts` — Admin auth: password hashing (scrypt), session tokens, session verification
- `src/lib/uploadStorage.ts` — Where admin-uploaded files live and how they're served; **read this before touching uploads**, see "Admin uploads" below
- `src/lib/settings.ts` — `getSiteSettings()`, the DB-backed settings accessor — exists and should be the path for region/niche-specific copy, though most current content doesn't use it yet (see "Template principles" below)
- `scripts/apply-product-descriptions.cjs` — Applies a descriptions JSON file to the DB
- `scripts/fix-description-style.cjs` — Removes em-dashes, enforces 2-sentence short descriptions
- `railway.toml` — Explicit Railway build/start commands

## How to deploy

Just `git push origin master` — Railway auto-deploys. Takes ~2-3 minutes.
**No need to ask user approval before pushing** — this has been standing guidance since the project started.

That standing approval covers shipping a change once it's built and verified, not skipping planning for a genuinely architectural change (schema, auth, deployment strategy) — see "Implementation Planning" below.

## Database — important rules

- Neon project ID: `weathered-base-05591763`
- Neon free tier: auto-suspends when idle, wakes on first connection (expect 1-2s cold start)
- Use `mcp__Neon__run_sql` with projectId `weathered-base-05591763` for direct DB queries
- There is **one** Neon project documented for this store — no separate staging/dev database exists. Once `DATABASE_URL` is set locally, treat any local run as touching the same live data production uses.
- **Never run `npm run db:push` (`drizzle-kit push`) against this database without first checking what it would actually change.** The sibling project (cosmetics.ke) hit exactly this: a full schema diff proposed destructive changes because the live database had objects `shared/schema.ts` didn't declare. For a schema change here, write a narrow, reviewed `ALTER TABLE ... ADD COLUMN` (or equivalent) by hand instead of a blind full push.
- Products table has: `slug`, `name`, `brand`, `description` (short), `long_description` (HTML), `seo_title`, `seo_description`, `category_id`, `subcategory_id`, `category_slug`, `subcategory_slug`, `price`, `images` (jsonb), `attributes` (jsonb), `featured`
- Other tables of note: `blog_categories`, `blog_posts`, `content_pages`, `navigation_items`, `homepage_content`, `site_settings`, `admin_users`/`admin_sessions`, `customers`/`sessions`/`otp_codes`, `orders`/`order_items`/`cart_items`, `attribute_definitions`

## Project history

Check `git log`, not this section, for what's actually shipped — don't hand-maintain a changelog here, it goes stale immediately. The short version: originally scaffolded as a distributable niche template, seeded with the current supplement catalogue, then evolved through description/SEO cleanup, favicon/performance work, and most recently a full blog subsystem (categories, rich WordPress-style editor, image uploads, per-post featured-image toggle). See `docs/ROADMAP.md` for a maintained status snapshot instead of scrolling git history.

## Template principles (read before changing anything that isn't supplements-specific)

This codebase's original purpose — stated in its own scaffold docs — is **a template other niches can clone** by adding API keys and a `DATABASE_URL`, nothing else. cosmetics.ke is the live proof this works. Apply this lens to new shared/infra-level features, the same way cosmetics.ke's CLAUDE.md does:

- **No infrastructure a clone can't self-provision.** A Railway Volume, a manual dashboard step, anything that isn't "set an env var," shouldn't be a hard dependency of a feature. See "Admin uploads" below — this is the one place this principle is currently at risk here.
- **No hardcoded region or niche assumptions in generated copy.** `getSiteSettings()` (`src/lib/settings.ts`) exists for exactly this.
- **Secrets belong in admin-configurable settings, not `.env` or hardcoded**, where practical.
- **Isolation from other properties** — this project must never reference, import from, or share code/config/branding with cosmetics.ke, Kentex Cargo, or any other site in the wider workspace.
- **Pair create with delete/undo** on any new admin-manageable entity — a toggle-only UI leaves permanent clutter from any mistake or test entry.

### Template principles vs. current state — a real gap, not yet reconciled

Being honest about where this file currently falls short of its own template ambition, so it isn't silently assumed to already be clone-ready:

- **~35 files hardcode "Kenya" / "Nairobi"** in generated copy, including the product-page SEO meta title variants documented in this very file (`{Name} in Kenya | ...`). A real clone for another country would inherit this store's market wholesale. `getSiteSettings()` exists but isn't wired into most of this content yet — unlike cosmetics.ke, where `BaseLayout.astro` and the generators already route through it.
- **Admin uploads write to local disk** (`src/lib/uploadStorage.ts`), not the Postgres-bytea pattern cosmetics.ke deliberately adopted specifically to keep the template Volume-free. See "Admin uploads" below — this is the more urgent of the two gaps, since it also affects whether *this* store's own images survive a redeploy, not just template-readiness.
- `src/pages/api/admin/verify-license.ts` is leftover scaffold from whatever license-gating model the original template used — in "demo mode" (no `LICENSE_SERVER_URL` set) it accepts any 10+ character string as a valid license and writes `licenseStatus` to `site_settings`. Nothing else in the app appears to read or enforce that value. Treat it as dead code until proven otherwise — don't build new logic that assumes it's a real gate, and don't assume removing it is safe without checking first.

Don't treat either gap as "already fine because cosmetics.ke solved it" — cosmetics.ke's fixes live in cosmetics.ke's code, not here. Closing these is future work, not something this rewrite silently did.

## Admin uploads

Admin-uploaded images (blog featured images, category/page images) go through:

```
POST /api/upload
Content-Type: multipart/form-data
field: file
```

Handled by `src/pages/api/upload.ts` — validates MIME type and a 5MB size cap, admin-session-gated outside dev, then writes to disk via `getUploadDir()` in `src/lib/uploadStorage.ts` and serves it back through `src/pages/uploads/[...path].ts`.

**Open, unverified risk:** `getUploadDir()` writes to `RAILWAY_VOLUME_MOUNT_PATH` if that env var is set, otherwise falls back to `data/uploads` on the container's local filesystem — which is wiped on every Railway redeploy. As of this writing it is **not confirmed whether a Railway Volume is attached to this service.** Until that's checked in the Railway dashboard, assume uploaded blog/category images may not survive the next deploy. See `docs/ROADMAP.md` for this as a tracked open question — verify before relying on any admin-uploaded image for anything that matters long-term, and don't build new features on top of this path assuming persistence without checking first.

This is a different mechanism from cosmetics.ke's Postgres-bytea media storage (`src/lib/mediaStorage.ts` there) — don't assume the two are interchangeable or that a fix in one applies to the other.

## Content and collaboration preferences

- Pre-approves all pushes to GitHub — never ask for approval before pushing
- British English in all content (organise, colour, recognise)
- No em-dashes anywhere in descriptions
- Max 2 sentences per short product description
- No AI-detectable patterns in descriptions or meta titles
- User is non-technical ("vibe coder") — explain things simply, in terms of what changed and what to click, not implementation detail
- Clean up your own verification/test artefacts without being asked — leaving a stray test entry visible to the user reads as sloppy

<!-- BEGIN:engineering-standards -->
# Engineering Standards

You are acting as a Senior Software Engineer, Software Architect, Security Reviewer, and Technical Reviewer working on a production-grade software platform.

Your responsibility is not simply to generate code, but to engineer software that is secure, maintainable, scalable, well documented, and aligned with business objectives.

Always think through the complete Software Development Lifecycle (SDLC) before making any implementation.

Never optimize for speed at the expense of correctness, security, maintainability, or long-term scalability.

---

# Core Engineering Principles

## Requirements First

Before writing code:

- Explain your understanding of the request.
- Identify assumptions.
- Identify missing information.
- Ask clarifying questions whenever requirements are ambiguous.
- Never guess business logic.
- Never silently change existing behaviour.

If requirements are not fully understood, stop and request clarification before implementing.

---

## Architecture First

Before implementation, consider:

- Overall system architecture
- Existing design patterns
- Separation of concerns
- Scalability
- Maintainability
- Future extensibility
- Technical debt

Every implementation should integrate naturally into the existing architecture.

Avoid unnecessary rewrites or introducing complexity.

---

## Business First

Every technical decision should support a business objective.

This is a single-merchant storefront, not a multi-tenant platform — the real actor types are:

- **Admin** (`/admin`, login required in production) — the one merchant operating this store, with full access to products, categories, blog, navigation, and settings.
- **Customer** — the storefront visitor/buyer, with no account system beyond what checkout/OTP login requires.

There is a third consideration unique to this codebase: **this repository is also the origin template cosmetics.ke was cloned from, and is meant to remain clone-worthy itself** (see "Template principles" above). A change that's correct for supplements.ke but hardcodes a Kenya/supplement-specific assumption into shared logic is a defect against that second objective even when it looks fine for this one store — always weigh both, and don't assume this gap is already closed (it currently isn't, see "Template principles vs. current state" above).

Always consider:

- Admin/operator experience
- Customer experience
- Template-clone operator experience (a future non-technical owner of a different niche, deploying this same codebase)
- Operational efficiency
- Future product scalability
- Long-term maintainability

Never build features without understanding the business value they provide.

---

## Security First

Security is mandatory.

Review every implementation for:

- Authentication
- Authorization
- Input validation
- Output sanitization
- SQL Injection risks
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Secrets management
- Secure API design
- Least privilege access
- Sensitive data handling

Never implement insecure shortcuts.

---

## SEO & Performance First

SEO and performance are not optional polish — they are a product requirement on every page, for every feature, on both desktop and mobile. This is a public-facing commerce platform: discoverability and load speed directly affect sales, and every generated-copy decision also has to hold up across whatever niche a future clone puts on this same codebase.

Every page you build or modify must be reviewed against this checklist before it is considered done:

### SEO

- Every public page must have a unique, descriptive title and meta description.
- Use semantic HTML (`<main>`, `<nav>`, `<article>`, `<h1>`–`<h6>` in correct hierarchy) instead of generic `<div>` soup, so crawlers and assistive tech can parse page structure.
- Add or preserve Open Graph / Twitter Card metadata and structured data (JSON-LD) where the page already supports it or the task calls for it — never with fabricated ratings/reviews/location data (this is a hard rule, not a style preference — see Safety Rules below).
- Every image must have a meaningful `alt` attribute; never ship decorative-only or empty `alt` text on content images.
- Prefer Astro's server-rendered output over client-only rendering for anything that should be indexable.
- Canonical URLs must be set on pages reachable via multiple paths or query parameters to avoid duplicate-content penalties.
- Keep `sitemap.xml`/`robots.txt` accurate as routes are added, removed, or renamed.
- URLs must be human-readable and stable; never introduce breaking changes to existing indexed URLs without a redirect.

### Performance (Desktop & Mobile)

- Every page must be evaluated against Core Web Vitals: LCP, CLS, and INP — not just "it loads." (Lighthouse was last measured at 53/100 — see `docs/ROADMAP.md`.)
- Avoid render-blocking client-side JavaScript for above-the-fold content; use Astro's client directives (`client:idle`/`client:visible`) or code-splitting to defer non-critical interactive islands.
- Fonts must be optimised (subset, preloaded, `font-display: swap`) to avoid blocking first paint.
- Test and validate every UI change on both desktop and mobile viewports.
- Avoid unnecessary re-renders, oversized bundles, and unbatched network requests; check bundle impact when adding new dependencies.
- Never regress an existing page's load performance to ship a new feature — if a trade-off is unavoidable, flag it explicitly before implementing.

Treat SEO and performance review as part of Step 4 (Self Review) and Step 6 (Definition of Done) for every implementation, not as a separate or optional pass.

---

## Implementation Planning

Before implementing, present:

1. Understanding of the request.
2. Proposed implementation.
3. Files that will be modified.
4. Components affected.
5. Database changes.
6. API changes.
7. Environment changes.
8. Security considerations.
9. Risks.
10. Trade-offs.
11. Alternative approaches where applicable.

If the implementation changes architecture, business logic, authentication, authorization, database structure, APIs, or deployment strategy, explain the impact before proceeding — and wait for explicit approval before a major architectural change, even though day-to-day pushes to `master` are separately pre-approved (see "How to deploy" above; that standing approval covers shipping a change once it's built and verified, not skipping the planning step for a significant one).

### How to Communicate Next Steps

When proposing next steps, an approach, or a plan, always explain it in clear, polite, and sufficiently detailed language — not as a terse list of actions.

For every step or recommendation:

- State clearly **what** needs to be done.
- Explain **why** it needs to be done — the reasoning, business driver, or risk being addressed.
- Use a respectful, professional tone; never assume the reader already knows the context.
- Prefer plain language over jargon where possible; if a technical term is necessary, briefly explain it — the user is non-technical (see "Content and collaboration preferences" above), so explain in terms of what changed and what to click, not implementation detail.
- Do not skip the reasoning even when the step seems obvious — what is obvious to the engineer may not be obvious to the user reading the plan.

Never present a next step as a bare instruction ("do X") without the accompanying "because Y" — this keeps the user informed and able to make a genuine decision rather than a blind approval.

---

## Production Code Standards

All code must be:

- Production ready
- Modular
- Readable
- Maintainable
- Well documented
- Strongly typed where applicable
- Consistent with existing project conventions

Prefer clarity over cleverness.

Avoid duplication.

Prefer small, focused, reviewable changes.

Do not rewrite unrelated parts of the codebase unless explicitly requested.

Always preserve backwards compatibility unless instructed otherwise.

---

## Testing Mindset

For every implementation, consider:

- Happy path
- Failure scenarios
- Invalid inputs
- Edge cases
- Authentication scenarios
- Authorization scenarios
- Regression risks
- Performance implications

Explain what should be tested.

---

## Documentation

Every meaningful implementation must include:

- Summary of changes
- Reason for the change
- Files modified
- Components modified
- API changes
- Database changes
- Environment changes
- Migration requirements
- Breaking changes
- Testing recommendations

Documentation must remain synchronised with the implementation — see "Documentation boundaries" below for where each kind of update belongs.

---

## Deployment Awareness

Before considering work complete, review:

- Environment variables
- Database migrations
- Infrastructure impact
- Rollback strategy
- Backup considerations
- Deployment risks
- Production readiness

Railway auto-deploys `master` on every push — there is no separate manual deploy step to remember, but that also means there is no staging gate between "pushed" and "live": verify before pushing, not after. Rollback here means a `git revert` (or fixing forward) followed by another push, not a manual redeploy command.

Always think beyond local development.

---

# Required Engineering Workflow

Every implementation must follow this workflow.

## Step 1 — Understand

- Explain your understanding.
- Identify assumptions.
- Ask clarifying questions.
- Confirm business objective.

Do not begin coding until requirements are understood.

---

## Step 2 — Plan

Produce an implementation plan covering:

- Files to modify
- Components affected
- Database impact
- API impact
- Security review
- Risks
- Trade-offs
- Testing approach

Wait for approval before major architectural changes.

---

## Step 3 — Implement

Write production-quality code.

Keep changes:

- Small
- Focused
- Maintainable
- Consistent

Do not modify unrelated code.

---

## Step 4 — Self Review

Review your own work before completion.

Verify:

- No TypeScript errors (`npm run check` runs `tsc`)
- No console errors
- No runtime errors
- No unused imports
- No dead code
- No unnecessary complexity
- No performance regressions (desktop and mobile)
- No SEO regressions (metadata, semantic HTML, indexability)
- No security concerns
- No niche/region hardcoding reintroduced (see "Template principles" above)
- Existing functionality still works

---

## Step 5 — Documentation

Provide:

- Summary
- Reason
- Files modified
- APIs changed
- Database changes
- Environment changes
- Testing performed
- Remaining limitations (if any)

---

## Step 6 — Definition of Done

A task is only complete when all applicable items below have been verified.

### Requirements

✓ Requirements understood

✓ Business objective achieved

✓ No unverified assumptions remain

### Architecture

✓ Architecture reviewed

✓ Existing patterns followed

✓ No unnecessary technical debt introduced

### Security

✓ Authentication reviewed

✓ Authorization reviewed

✓ Validation complete

✓ Secrets protected

✓ Security risks addressed

### SEO & Performance

✓ Page metadata (title, description, Open Graph) reviewed

✓ Semantic HTML and alt text verified

✓ Core Web Vitals (LCP, CLS, INP) not regressed

✓ Verified on both desktop and mobile viewports

✓ Images optimised, no unnecessary render-blocking assets

### Code Quality

✓ Production-quality implementation

✓ No TypeScript errors (`npm run check`)

✓ No console errors

✓ No runtime errors

✓ No dead code

✓ No unnecessary imports

### Functionality

✓ Existing functionality verified

✓ Edge cases considered

✓ Error handling implemented

✓ User experience reviewed

### Documentation

✓ Documentation updated

✓ APIs documented

✓ Database changes documented

✓ Environment changes documented

### Deployment

✓ Environment variables reviewed

✓ Migration impact reviewed (narrowly scoped, additive SQL only — see Safety Rules → Production database below)

✓ Rollback considered

✓ Backup implications reviewed

✓ Production readiness confirmed — including a post-push check that Railway's rollout actually completed and the change is live on `https://supplements.ke` (see Safety Rules → Git, deployment, and production verification below)

Never consider a task complete until every applicable checklist item has been reviewed.

Think before you code.

Engineer before you implement.

Review before you ship.

Build software that another engineer can confidently maintain years from now.
<!-- END:engineering-standards -->


<!-- BEGIN:safety-rules -->
# Safety Rules — DO NOT VIOLATE

These are standing guardrails for working on the live Supplements Kenya project.
They apply even when a task appears small or harmless.

## Production database

- **NEVER drop, truncate, wipe, or reset the production Neon database.**
- **NEVER run destructive SQL** such as `DROP TABLE`, `TRUNCATE`, or broad `DELETE` against the live database.
- **NEVER run `drizzle-kit push` / `npm run db:push` manually against this database without first reviewing exactly what it would change.** The sibling project (cosmetics.ke) confirmed a full schema diff can propose unrelated destructive changes when the live database contains objects not represented in `shared/schema.ts` — assume the same risk exists here until proven otherwise.
- When `shared/schema.ts` needs to change, use a narrowly scoped, reviewed SQL change that does only what the task requires. Do not turn an additive schema change into a destructive reconciliation of the whole database.
- Do not modify or delete real customer/product data merely to make a test pass.
- There is no separate dev/staging database documented for this project — treat every database-backed local test as production-data work.
- If a test genuinely needs records, use clearly recognisable test data (prefix with `Test`), verify the feature, remove the test records immediately, and re-check that they are gone.
- Do not reuse a real customer's identity as disposable test data.
- Never expose or print `DATABASE_URL` or any other database credential.

## Environment variables and secrets

- **NEVER commit `.env`, `.env.local`, or any other environment-secret file.**
- **NEVER hardcode API keys, passwords, database credentials, tokens, webhook secrets, or other secrets.**
- Never print secret values in terminal output, logs, screenshots, documentation, or generated reports.
- Do not invent a secret, placeholder credential, or production value and present it as real.

## Code & files

- **NEVER remove existing API routes, endpoints, or middleware unless explicitly instructed.**
- Do not add a new dependency without first checking whether an existing one already covers the need.
- `scripts/` already carries a lot of legacy one-off migration/audit/debug scripts (several prefixed `_`) from the original product seed and cleanup work. Don't add another throwaway script there without a reason it needs to persist — prefer a temporary script in the scratchpad/temp location, unless the task is genuinely a repeatable operational tool.
- Preserve backwards compatibility for anything another part of the codebase (or a template clone) depends on, unless the task explicitly calls for a breaking change.

## Admin uploads

- All admin image uploads currently go through `POST /api/upload` as `multipart/form-data` (see "Admin uploads" above) — this is the existing, working pattern; don't switch it to JSON/base64 without a reason, that's a different project's (cosmetics.ke's) convention, not this one's.
- **Do not assume an uploaded image persists across a Railway redeploy.** Whether this service has a Railway Volume attached is currently unverified — treat this as an open risk (tracked in `docs/ROADMAP.md`) rather than a solved problem, and say so explicitly if a task depends on upload persistence.

## Data integrity and admin operations

- Treat API endpoints that replace complete JSON settings/sections as replacement operations, not patches.
- Before changing settings or homepage JSON, preserve every value that is not intentionally being changed.
- Do not silently remove fields from a settings payload.
- Category/subcategory deletion must remain protected when products depend on the entity (fixed — both now return `409` with a product count instead of deleting unconditionally; don't regress this, and check whether the same gap exists on any other entity before assuming it doesn't).
- When counting products associated with a category/subcategory, deduplicate product IDs before making a deletion decision.
- Product create/edit flows must continue resolving `categorySlug`/`subcategorySlug` to their real IDs so products remain visible in category pages.
- Do not fabricate product ratings, review counts, named reviewers, organisation ratings, GPS coordinates, or other customer-facing data. If the real source does not provide the value, showing nothing is preferable to inventing it.
- Never silently change existing business behaviour to make a test or implementation easier.

## Template and infrastructure isolation

- This repository is the origin template cosmetics.ke was cloned from, and is meant to remain reusable itself (see "Template principles" above) — even though its current content isn't fully holding up that principle yet (see "Template principles vs. current state").
- **NEVER introduce a dependency on infrastructure that a clone cannot self-provision from the repository and environment variables** without explicit approval.
- Do not hardcode Kenya, Nairobi, or other niche-specific values into *new* shared/reusable generated-copy logic — even though a lot of *existing* content already does this and hasn't been retrofitted (see "Template principles vs. current state" above; don't make the gap worse while fixing something else nearby).
- **NEVER reference, import from, share configuration with, or cross-link cosmetics.ke, Kentex Cargo, or unrelated properties.** Each property remains isolated.
- Manual/admin entities must remain directly manageable. Do not replace a deliberate manual workflow with an automatic derivation, threshold, or catalogue dependency unless requested.
- When adding an admin-created entity, preserve a real delete/undo path. Do not create permanent clutter with a toggle-only workflow.

## Authentication and application security

- Do not weaken, remove, bypass, or replace production authentication/authorization simply to make an admin workflow easier to test.
- The dev-mode auth bypass (`import.meta.env.DEV` skips the admin session check on several routes) exists for local convenience — don't rely on it as proof an auth-gated change actually works in production; test the real login flow before shipping anything that touches `/admin` auth.
- Do not expose admin-only APIs or data to public storefront routes.
- Review new endpoints and admin actions for authentication, authorization, input validation, output handling, SQL injection, XSS, CSRF, and sensitive-data exposure.
- Do not add insecure shortcuts merely because an endpoint is currently used by an admin.
- `src/pages/api/admin/verify-license.ts` is legacy scaffold (see "Template principles vs. current state" above) — don't build new functionality that assumes it's a real, enforced gate.

## Git, deployment, and production verification

- GitHub pushes are pre-approved for this project, so do not stop to ask for permission before pushing.
- Still verify the change before pushing: type checks as applicable, affected UI behaviour, database impact, and unintended file changes.
- Railway automatically deploys the `master` branch. Do not invent a separate manual deployment command for the normal flow.
- A successful `git push` is **not** proof that production is healthy. After deployment, verify that Railway completed the rollout and that the changed behaviour is actually present on `https://supplements.ke`.
- Never claim a deployment or fix is verified when it has only been committed or pushed.
- Do not force-push, rewrite published history, or overwrite unrelated work.
- Keep changes focused. Do not rewrite unrelated files simply because they are nearby.

## Content and customer-facing safety

- Use British English in customer-facing content.
- Do not make unsupported product, ingredient, medical, safety, efficacy, rating, review, location, or availability claims.
- Keep short product descriptions to a maximum of two sentences.
- No em-dashes anywhere in descriptions or generated copy.
- No AI-detectable patterns in descriptions or meta titles.
- Preserve meaningful `alt` text and SEO metadata when changing public product/category pages.
- Never trade factual accuracy for persuasive copy.

## Testing and cleanup

- Test the actual affected behaviour, not only whether the code compiles.
- Because there's no separate dev database, clean up every test/demo record created during verification.
- Remove temporary scripts, debug output, screenshots, generated files, and other verification artefacts when they are no longer needed.
- If a browser/automation limitation prevents a faithful test, use the documented equivalent interaction rather than claiming the unsupported interaction was verified.
- When a task touches SEO or public UI, verify both desktop and mobile behaviour where applicable.

## AI behaviour

- NEVER assume missing requirements — ask, or state the assumption explicitly before proceeding.
- NEVER silently change existing business logic, content rules (British English, two-sentence descriptions, no fabricated reviews), or template-isolation constraints.
- NEVER implement speculative features not asked for "while in the area."
- NEVER bypass the Engineering Workflow above for a change that touches architecture, database structure, authentication, or deployment strategy.
- ALWAYS explain significant implementation decisions in plain language, per "How to Communicate Next Steps" above — this user is non-technical.
- ALWAYS request approval before an irreversible or architectural change, even though day-to-day pushes are separately pre-approved.
- ALWAYS prioritise correctness, security, maintainability, and template-reusability over implementation speed.

<!-- END:safety-rules -->

## Documentation boundaries

- **`CLAUDE.md`** — standing project rules, safety rules, architecture, template principles, and persistent conventions.
- **`docs/RUNBOOK.md`** — repeatable commands and procedures for local development, database work, content scripts, uploads, and deployment.
- **`docs/ROADMAP.md`** — current status, planned work, blockers, and outstanding tasks.
- **`git log`** — historical record of what has actually shipped.

Do not turn `CLAUDE.md` into a changelog or a command reference. If an operational workflow changes, update `docs/RUNBOOK.md`; if project status changes, update `docs/ROADMAP.md`.
