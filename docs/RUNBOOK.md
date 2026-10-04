# Supplements Kenya — Local Dev & Deploy Runbook

Manual, copy-pasteable steps for local development, database access, content
scripts, uploads, and deployment. Read this before touching any of them. Keep
it in sync if a workflow changes — this is the authoritative "how do I
actually run this" doc, separate from [`ROADMAP.md`](ROADMAP.md) (project
status) and [`CLAUDE.md`](../CLAUDE.md) (standing rules and safety
constraints).

---

## 1. Local dev — running the server

There is **no separate staging/dev database** — local dev and production
point at the same Railway Postgres instance (service `Postgres`, inside the
`supplements.ke` Railway project, alongside the app itself). The database has
no public host, so local access needs an SSH tunnel opened fresh **every
session** — it is not a background service, and its port changes every time
it's started (the password stays the same, tied to the database itself).

**Step 1 — Open the tunnel** (leave this running in its own terminal for the
whole session):

```bash
railway connect Postgres --tunnel-only
```

This prints something like:

```
PostgreSQL tunnel open — point an external client at:

  Host:     127.0.0.1
  Port:     <changes every time>
  User:     postgres
  Password: ...
  Database: railway

  URL:      postgresql://postgres:...@127.0.0.1:<port>/railway
```

**Step 2 — Update the root `.env`.** Copy the `URL:` line above into
`DATABASE_URL` in `D:\Projects\supplements.ke\.env`. The port changes every
time you open the tunnel — the old value will `ECONNREFUSED`/`ECONNRESET`
once the previous tunnel session is gone.

**Step 3 — Start the server:**

```bash
npm run dev
```

Runs `server/index.ts` via `tsx` with `NODE_ENV=development`, on port 5000.
Admin auth (`/admin`) is bypassed in dev mode on several routes
(`import.meta.env.DEV` short-circuits the session check) — convenient
locally, but don't treat that as proof an auth-gated change works in
production. Test the real login flow before shipping anything that touches
`/admin` auth.

**Step 4 — Typecheck before considering a change done:**

```bash
npm run check
```

Runs `tsc`. There is no ESLint config in this repo — `tsc` is the only
automated gate.

**Optional — run the test suite:**

```bash
npm run test        # vitest run
npm run test:watch  # vitest, watch mode
```

---

## 2. Database access — direct queries

Since dev and prod share one database, any direct query is production-data
work. With the tunnel from §1 open, run a throwaway Node script from the
repo root so `node_modules` resolves, then delete it after:

  ```bash
  node -e "
  require('dotenv').config();
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  (async () => {
    const { rows } = await pool.query('SELECT 1');
    console.log(rows);
    await pool.end();
  })();
  "
  ```

There is no Neon MCP tool for this database (that only applied before the
30/09/2026 migration to Railway Postgres — see `CLAUDE.md`) — the throwaway
script above is the only supported path for a direct query now.

**Don't run `npm run db:push` (`drizzle-kit push`) against this database
without first reviewing the diff it proposes.** See `CLAUDE.md` → Safety
Rules → Production database for why — the sibling project cosmetics.ke
confirmed a full schema diff can propose destructive changes against
objects the live database has that `shared/schema.ts` doesn't declare. For
a schema change, write the narrow `ALTER TABLE ... ADD COLUMN` (or
equivalent) by hand instead.

**Changing `DATABASE_URL` (or another env var) on the live service may or may
not trigger a fresh deploy on its own** — observed during the 30/09/2026
Neon-to-Railway migration: `railway variables --set` here was followed a
moment later by Railway already redeploying on its own (`railway redeploy`
then failed with "cannot be redeployed... currently building"). Don't assume
either way — after changing a variable, check `railway logs` for a recent
"Starting Container" line (a fresh boot) before assuming the new value is
live, and run `railway redeploy --service <name> --yes` yourself only if one
hasn't already started.

---

## 3. Admin uploads

Admin image uploads (blog featured images, category/page images) go through:

```
POST /api/upload
Content-Type: multipart/form-data
field: file
```

Handled by `src/pages/api/upload.ts` (5MB cap, MIME allowlist, admin-session
gated outside dev). Files land via `getUploadDir()` in
`src/lib/uploadStorage.ts`:

- If `RAILWAY_VOLUME_MOUNT_PATH` is set, uploads go there and persist across
  deploys.
- Otherwise they fall back to `data/uploads` on the container's local
  filesystem, which is wiped on the next Railway redeploy.

**Before relying on any admin-uploaded image surviving a deploy, check the
Railway dashboard for this service to see whether a Volume is attached.**
This has not been confirmed as of this writing — see `ROADMAP.md` §3. If no
Volume is attached, re-upload after every deploy is the current reality for
anything stored this way, or a Volume needs to be provisioned.

Served back through `src/pages/uploads/[...path].ts` — not Astro's static
handler, which only serves `dist/client/` (built from `public/` at build
time, so a runtime write there would silently 404).

---

## 4. Product content scripts

`scripts/` at the repo root is a mix of repeatable tools and one-off
migration/audit scripts from the original ~262-product description pass and
various cleanup rounds. Several are prefixed `_` (ad hoc, not meant to be
rerun blindly). The two still worth running as repeatable tools:

```bash
# Apply a descriptions JSON file to the database
node scripts/apply-product-descriptions.cjs --file=filename.json

# Fix em-dashes and enforce the 2-sentence limit across all products
node scripts/fix-description-style.cjs

# Dry-run the above
node scripts/fix-description-style.cjs --dry
```

`scripts/data/` holds the JSON inputs these operate on, including
`le-omega3-15-patterns.json` / `le-all-15patterns.json` (Life Extension's
15 custom description patterns — generated but not yet confirmed applied to
the live products, see `ROADMAP.md` §3).

Don't re-run one of the `_`-prefixed one-off scripts against live data
without reading it first and confirming it still matches the current
schema — most were written for a single specific cleanup and were never
meant to be repeatable. Prefer a temporary script in the scratchpad/temp
location over adding another one-off file here.

---

## 5. Deploying

```bash
git push origin master
```

Railway is connected and auto-deploys `master` on every push — no separate
`railway up` step, but a push is never run without the user's explicit
go-ahead for that specific change, given at the time (see `CLAUDE.md` →
"How to deploy"). Build + rollout takes roughly 2–3 minutes once pushed.

**A successful push is not proof production is healthy.** After pushing,
confirm the rollout actually landed and the changed behaviour is really
live:

- Open `https://supplements.ke` directly and check the specific thing that
  changed (not just that the homepage loads).
- If something looks stale or broken, check the Railway dashboard's
  Deployments tab for the build/deploy log before assuming it's a code bug.

### 5a. Cloning this repo into a brand new Railway project (template use)

This codebase is meant to be clone-worthy (see `CLAUDE.md` → "Template
principles") — but a clone's very first build can fail with a Railway error
that has nothing to do with the code itself. **Found live 04/10/2026** when
`proteinpowder.co.ke` was cloned from this repo:

> Railpack failed to prepare the build... Check that the repo root contains
> your app source and a manifest file such as package.json, or set the Root
> Directory if the app lives in a subfolder, then redeploy.

**Root cause, found and fixed 04/10/2026:** Railway's `builder` value in
`railway.toml` is case-sensitive and must be written in capitals
(`"DOCKERFILE"`) — this repo's file had it as `"dockerfile"` (lowercase).
Railway silently treats an unrecognised value as if the field weren't set at
all, so it falls back to its own auto-detect builder, **Railpack**, instead
of the `Dockerfile` this repo actually needs. This was invisible on the
live `supplements.ke` service because someone had also set the Builder by
hand in the Railway dashboard at some point, and a dashboard setting quietly
overrides the file — but a **brand-new** service created by cloning this
repo has no such dashboard setting yet, so it reads the file fresh, doesn't
recognise the lowercase value, and fails exactly like this. The file is now
fixed (`builder = "DOCKERFILE"`), so this specific cause should no longer
hit the next clone.

**Even so, don't assume the builder is correct on a brand-new clone without
checking** — Railway has other, separately-reported cases where it picks
Railpack over an existing Dockerfile regardless of config, so treat the fix
above as reducing the odds, not eliminating them. On the new (cloned)
project, not this one:

1. Open the new project's web service → **Settings → Build**.
2. Confirm **Builder** actually shows **Dockerfile**. If it doesn't, set it
   explicitly rather than trusting auto-detection.
3. Confirm **Root Directory** is blank — this repo's `Dockerfile` and
   `package.json` both live at the repo root, not in a subfolder.
4. Redeploy.

If it still fails after that, double-check the new project's GitHub repo
actually has `Dockerfile` and `package.json` sitting at its top level — a
"clone" done by downloading and re-uploading a zip can occasionally drop a
file like that.

---

## 6. Testing & cleanup — recognisable test data

Because there's no separate dev database, any test record is a real row in
the live database until removed. When a task genuinely needs one to verify
a feature end-to-end:

- Prefix the name/title with **`Test`** — e.g. a product named `Test
  Product — <short reason>`, a category `Test Category`. Makes it obvious
  at a glance which rows are disposable, and easy to find again
  (`WHERE name ILIKE 'Test %'`) when cleaning up.
- Never reuse or modify a real product/category/order to "just check
  something" — create a clearly-labelled test row instead.
- Delete every test row immediately after verifying, then re-query to
  confirm it's actually gone — don't just assume the delete succeeded.

---

## 7. Payment integration — E-Payments

Built 30/09/2026 (see `docs/PAYMENT_INTEGRATION.md` for the full
architecture) but **not yet live** — needs a supplements.ke merchant account
on E-Payments before any of this can actually be tested end to end.

**Webhook endpoint to register in E-Payments' dashboard (Settings →
Webhooks) — needed to get back `EPAYMENTS_WEBHOOK_SECRET`:**

```
https://supplements.ke/api/webhooks/epayments
```

One-time registration, not sandbox-vs-production specific — the same
endpoint receives events regardless of whether the merchant account is
currently using sandbox or live M-Pesa/Paystack credentials.

**Local/sandbox setup**, once a merchant account exists:

1. Set in `.env` (never commit these):
   ```
   EPAYMENTS_API_URL=https://epayments.co.ke
   EPAYMENTS_API_KEY=<supplements.ke's own merchant key>
   EPAYMENTS_WEBHOOK_SECRET=<returned when the webhook URL above is registered>
   ```
2. A webhook needs a publicly reachable URL — E-Payments can't reach
   `localhost`. Test the webhook path against a deployed Railway
   environment, or a tunnelling tool, not local dev alone.
3. Safaricom's sandbox only responds meaningfully to its shared test number
   `254708374149` (see `D:\Projects\E-Payments\README.md`), and even that
   doesn't reliably return "completed" — see `docs/PAYMENT_INTEGRATION.md`
   §6 before assuming a sandbox test that comes back "failed" is a bug.

**Running the reconciliation cron manually** (not yet provisioned as actual
Railway infrastructure — see `docs/ROADMAP.md`):

```bash
npx tsx scripts/reconcile-epayments.ts
```

Sweeps every `pending_orders` row stuck "pending" for more than 2 minutes
and asks E-Payments directly what happened. Safe to run repeatedly — it's
a no-op for anything already resolved. Provisioning this as a real scheduled
Railway Cron Job service (cosmetics.ke's pattern: `.railway/railway.ts`
Infrastructure-as-Code, `*/5 * * * *`) is planned follow-up work, not yet
done here.

---

## 8. Quick mental model

| I want to...                              | Command / path |
|--------------------------------------------|-----------------|
| Run the site locally                       | `railway connect Postgres --tunnel-only` (open a tunnel first), then `npm run dev` (port 5000) |
| Typecheck                                  | `npm run check` |
| Run tests                                  | `npm run test` |
| Query the live database directly           | Open the tunnel above, then a throwaway `node -e` script |
| Change the DB schema                       | Hand-written additive SQL — never blind `npm run db:push` |
| Upload an admin image                      | `POST /api/upload`, multipart, admin-session gated |
| Apply/fix product descriptions             | `scripts/apply-product-descriptions.cjs` / `scripts/fix-description-style.cjs` |
| Sweep stuck payment confirmations          | `npx tsx scripts/reconcile-epayments.ts` |
| Ship a change                               | `git push origin master` (needs explicit go-ahead first, then Railway auto-deploys) |
| Confirm a deploy actually landed           | Check `https://supplements.ke` directly, or the Railway dashboard's Deployments tab |

See `CLAUDE.md` for the full safety rules and architecture behind each of
these.
