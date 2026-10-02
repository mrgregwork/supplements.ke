# Payment Integration — How Supplements Kenya Is Integrated With E-Payments

Written 30/09/2026, when the integration was first built, ported directly
from cosmetics.ke's own `docs/PAYMENT_INTEGRATION.md` (itself following the
reusable playbook in shopusa.co.ke's `docs/PAYMENT_INTEGRATION.md` §11).
This is a reference document, not a to-do list — see `docs/ROADMAP.md` for
current status and `CLAUDE.md`'s Safety Rules → Payments for the standing
rules on changing any of this.

---

## 1. The big picture

Supplements Kenya is a single Astro app with one customer-facing sales
channel — the web storefront — and one payment gateway behind it,
**E-Payments** (`D:\Projects\E-Payments`, live at `https://epayments.co.ke`),
which itself wraps both M-Pesa STK push and Paystack card charges behind one
API. Supplements Kenya is its own merchant on that platform, with its own
API key, webhook secret, and M-Pesa/Paystack credentials — nothing shared
with cosmetics.ke's or shopusa.co.ke's merchant accounts, even though the
site owner operates E-Payments itself.

Cash-on-delivery (`src/pages/api/cod-order.ts`) remains a separate, valid
no-payment-needed path and is untouched by this integration.

```
1. Re-price everything server-side (never trust a client-supplied amount)
2. Insert a "pending" row (pending_orders)
3. Call E-Payments -> get back a transaction reference to poll on
4. Three independent, race-safe paths can each finalize that pending row:
     a. E-Payments' webhook (fastest — but exactly one delivery attempt,
        no retry, confirmed against E-Payments' own source)
     b. Client-side status poll (the customer's browser, while still open)
     c. A scheduled reconciliation cron (backstop for anyone who closed
        the tab before (a) or (b) landed)
5. Whichever of the three arrives first wins, via an atomic
   UPDATE ... WHERE status IN (...) AND order_id IS NULL guard — a late or
   duplicate signal after that is a safe no-op, not a double order.
```

That "whichever arrives first, safely" idempotency is the single most
important property of this system — see cosmetics.ke's and shopusa.co.ke's
own `docs/PAYMENT_INTEGRATION.md` for the real incident (a stuck customer
payment, hours unresolved) that this pattern exists to prevent.

---

## 2. Checkout — M-Pesa and Card, both via E-Payments

**Files:** `src/pages/checkout.astro` + `src/components/CheckoutForm.tsx`
(UI) → `src/pages/api/checkout/init.ts` (initiation) → `src/lib/epayments.ts`
(the E-Payments client) → `src/pages/api/webhooks/epayments.ts` (webhook) →
`src/lib/checkoutFinalize.ts`'s `finalizePendingOrder` (shared finalize
logic) → `src/pages/api/checkout/status/[id].ts` (client poll, also used by
`src/pages/checkout/return.astro` after a Card redirect) →
`scripts/reconcile-epayments.ts` (cron backstop).

The old `src/pages/api/checkout.ts` ("Demo Mode", no real charge) is left in
place but no longer called by the UI — see the rule against removing
existing routes in `CLAUDE.md`.

### 2.1 Initiation (`POST /api/checkout/init`)

1. Re-prices every cart line from `getCartItems(sessionId)` — the client
   never supplies a price or total.
2. Resolves the customer: **a typed email is never matched against an
   existing customer record to silently authenticate them** — guest
   checkout always creates a fresh `customers` row.
3. Inserts a `pending_orders` row holding a snapshot of the cart items (so
   finalize never needs to re-read a cart that may already be cleared),
   the shipping address, the chosen `paymentMethod`, and a freshly
   generated `orderCode` (see the standing convention below).
4. Calls `initiateMpesaStkPush()` or `initiatePaystackCharge()` in
   `src/lib/epayments.ts`, with the callback/redirect URL built from
   `RAILWAY_PUBLIC_DOMAIN` — never from `request.url`, which on Railway is
   an internal proxy address the outside world (Safaricom/Paystack/
   E-Payments) can't reach.
5. For Card, the Paystack `redirectUrl` points at
   `/checkout/return?pendingOrderId=...`, since the customer returns via a
   full page navigation (Paystack's hosted checkout page) that loses any
   React state the checkout page had.

**Standing convention, confirmed 30/09/2026: the gateway's account
reference must always be the eventual order number, never the raw
`pending_orders.id` UUID.** `src/lib/orderCode.ts`'s `generateOrderCode()`
is called at step 3, before the gateway call, specifically so it exists in
time to be sent as `accountReference` — and `checkoutFinalize.ts` then
reuses that exact same value as the real order's `orderNumber`. This is
not optional or cosmetic: whatever value gets sent as the M-Pesa reference
is literally what a real customer sees in their own confirmation SMS, and
a raw UUID there reads as broken to a paying customer (see §6 for the
incident this was fixed after). Any future payment gateway integration on
this codebase must follow the same rule — generate the order-facing code
before the gateway call, not after.

**Standing convention, set 03/10/2026: the gateway `description` must always
summarise what was bought, never be a fixed phrase like "Supplements Kenya
order".** This is a required part of any payment integration on this
codebase, not an optional polish item. `src/lib/orderDescription.ts`'s `buildOrderDescription()` builds it from the
cart (first item, plus quantity and `+N` for further items, e.g.
`Whey Protein Isol x2 +1`) and it appears in E-Payments' dashboard and its own
"Payment received" email. It is capped at 23 characters, the length of the
old fixed text and the only length proven live, because E-Payments passes it
straight through to Daraja's short `TransactionDesc` field. The full item
list also goes in `metadata` (no length risk there). Same helper as
cosmetics.ke's, ported 03/10/2026.

### 2.2 The E-Payments client (`src/lib/epayments.ts`)

Ported directly from cosmetics.ke's `src/lib/epayments.ts` (itself ported
from shopusa.co.ke's `shared/epayments/client.ts`, documented there as
reusable as-is). Owns `initiateMpesaStkPush()`, `initiatePaystackCharge()`,
`getTransactionStatus()` (the polling fallback), and
`verifyWebhookSignature()` (HMAC-SHA256 over the **raw** request body,
`timingSafeEqual`, length-checked first — never a plain `===`, since a naive
comparison can leak timing information about the correct signature).

`EPAYMENTS_API_URL` is always `https://epayments.co.ke` for any merchant on
this platform — it is not merchant-specific.

### 2.3 The webhook (`POST /api/webhooks/epayments`)

Verifies the `X-MPesa-Signature` header against `EPAYMENTS_WEBHOOK_SECRET`.
**E-Payments makes exactly one webhook delivery attempt, ever — there is no
retry on a non-2xx response.** That's exactly why the client-poll and
reconciliation-cron paths exist independently rather than as a "just in
case" — they are load-bearing every time the webhook doesn't land on the
first try, which will happen routinely, not as a rare edge case.

### 2.4 Confirmation — the three paths, one shared function

All three paths — webhook, `GET /api/checkout/status/[id]` (polled by both
the M-Pesa "waiting for payment" screen and the Card return page), and
`scripts/reconcile-epayments.ts` — call into `finalizePendingOrder()` in
`src/lib/checkoutFinalize.ts`. It:

1. Runs one atomic, guarded `UPDATE`:
   ```sql
   UPDATE pending_orders
   SET status = ...
   WHERE id = $1 AND status IN ('pending', 'failed') AND order_id IS NULL
   ```
   Whichever caller's request reaches Postgres first wins that row; every
   later caller for the same pending order sees `order_id` already set and
   returns the existing result instead of creating a second order.
2. Inside one transaction: inserts the real `orders` row (from the
   pending row's snapshot) and its `order_items`, commits.
3. **After** commit, as a best-effort side effect that can never undo an
   already-paid order if it fails: an order-confirmation email via
   `server/email.ts`'s `sendOrderConfirmationEmail` (Resend).

---

## 3. Database tables involved

| Table | Role |
|---|---|
| `pending_orders` | Staging row for a checkout attempt, before it's a real order — holds a snapshot of the cart, the chosen payment method, and the gateway transaction reference |
| `orders` | The real, confirmed sale — only ever created by `finalizePendingOrder`, never directly by `checkout/init.ts`. Carries `payment_method`, `payment_status`, `gateway_transaction_id`, `mpesa_receipt_number`, `card_reference` alongside the pre-existing fulfilment `status` column (kept as a separate concept — `status` is fulfilment-only: pending/confirmed/processing/shipped/delivered/cancelled) |
| `order_items` | Line items, copied from the pending order's snapshot at finalize time |
| `customers` | Guest rows created fresh at checkout (§2.1) |

Applied as narrow, hand-written additive SQL on 30/09/2026 (new `pending_orders`
table, new nullable/defaulted columns on `orders`) — never a blind
`drizzle-kit push`, per `CLAUDE.md` → Safety Rules → Production database.

---

## 4. Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `EPAYMENTS_API_URL` | `src/lib/epayments.ts` | `https://epayments.co.ke` — same for every merchant on the platform |
| `EPAYMENTS_API_KEY` | `src/lib/epayments.ts` | `X-API-Key` header — supplements.ke's own merchant key, never cosmetics.ke's or shopusa's |
| `EPAYMENTS_WEBHOOK_SECRET` | `verifyWebhookSignature()` | Verifies the webhook signature — set when `/api/webhooks/epayments` is registered in E-Payments' dashboard |

**Where these come from:** supplements.ke must be registered as its own
merchant on E-Payments (self-service, OTP-based registration — there is no
admin-created-for-you flow) with its own M-Pesa Paybill/Till and Paystack
credentials entered under that merchant's Settings, and its own API key
generated under Settings → API Keys. None of this can be done from inside
this repo or by an AI agent — it's a real external account with real
financial credentials.

**The webhook endpoint to register, under Settings → Webhooks, is:**

```
https://supplements.ke/api/webhooks/epayments
```

This is the one piece of setup the agent must always state up front rather
than wait to be asked — registering it is what makes E-Payments hand back
the `EPAYMENTS_WEBHOOK_SECRET` value needed above. **It's a single,
one-time registration — there is no separate sandbox vs. production
webhook URL/endpoint to create; the same registered endpoint receives
events for both.** (Sandbox vs. live is a property of which M-Pesa/Paystack
*credentials* the merchant account is currently using, not of the webhook
registration itself.)

**Whenever the production domain changes**, the webhook URL stored in
E-Payments' own dashboard must be updated manually to match — it is not
derivable from anything in this repo.

---

## 5. Known gaps, honestly stated

- **No refund/payout (B2C) integration.** This covers taking a payment
  only. If supplements.ke ever needs to refund a customer via M-Pesa,
  that's a separate integration, not something this covers.
- **Card requires a real email** (Paystack needs one for its own receipt);
  M-Pesa doesn't.
- **Live and verified working, 30/09/2026.** Sandbox-tested first (both
  M-Pesa and Card, via Safaricom's shared sandbox number), then switched to
  live credentials with explicit owner confirmation and proven with two
  real small-value charges — see "Live verification" below. See
  `docs/ROADMAP.md` for current status.
- **Reconciliation cron is real infrastructure, not just a script**, as of
  30/09/2026 — `supplements-reconcile-epayments`, defined in
  `.railway/railway.ts`, `*/5 * * * *`, same pattern as cosmetics.ke's own.
  Confirmed running correctly via its own log output.

---

## 5a. Live verification, 30/09/2026 — real charges, real confirmation

Once live M-Pesa/Paystack credentials were entered on E-Payments (owner's
explicit go-ahead), both payment methods were proven with one real charge
each, using two throwaway `status: 'draft', indexable: false` products
(never shown on the storefront) so the charged amount could be an exact,
tiny, round number rather than a real product's price:

- **M-Pesa: KES 1**, sent as a real STK push to a real phone
  (`0719269571`), approved live. Resolved `confirmed` / `payment_status:
  paid`, real receipt `UIU6K7WR4W` captured correctly on the `orders` row
  (order `ORD-MUNTZWCH-R7A5`).
- **Card: KES 5**, via a real Paystack hosted-checkout redirect, a real
  card entered live. First attempt showed Paystack's own "We could not
  start this transaction — Network Error" (a transient failure on
  Paystack's side, not this codebase — a second, fresh `checkout/init`
  call produced a working checkout page immediately). Resolved `confirmed`
  / `payment_status: paid`, real reference `T665501926032456` (order
  `ORD-MUNUUTQY-VFRT`), and `checkout/return.astro`'s poll-and-confirm UI
  displayed correctly.

**Standing test-amount convention for this integration, going forward:**
when a real-money test is needed again (a credential rotation, a schema
change, re-verifying after touching checkout code), use **KES 1 for
M-Pesa** and **KES 5 for Card** — cheap enough to be inconsequential,
proven to actually clear both gateways. Card in particular needs a real
card entered by a human each time (the agent must never enter card
details itself, live or sandbox) — coordinate that in the moment rather
than assuming it can be automated end-to-end.

The two throwaway test products created for this pass were left in place
(`status: 'draft'` keeps them invisible to customers) rather than deleted,
since the real `orders`/`order_items` rows they produced are genuine
financial records that reference them by foreign key — do not delete a
product that a real order's `order_items` row points at.

---

## 6. Known sharp edges (carried over from cosmetics.ke's live experience)

Everything below was found by cosmetics.ke actually running real M-Pesa
transactions against the same integration pattern, not by code review —
built into this codebase from the start rather than re-discovered here.
Full detail and the debugging trail: cosmetics.ke's own
`docs/PAYMENT_INTEGRATION.md` §6.

- **The webhook payload is NOT shaped like the REST API response.**
  `GET /api/v1/transaction/:id` returns snake_case
  (`mpesa_receipt_number`); the webhook payload sends E-Payments' raw
  database row, which is camelCase (`mpesaReceiptNumber`). Getting this
  wrong silently drops the receipt number with no error. Already handled
  correctly here — `src/pages/api/webhooks/epayments.ts` reads the
  camelCase fields.
- **The atomic status guard must be in the same transaction as order
  creation** — already the case in `finalizePendingOrder()`.
- **Safaricom sandbox only responds for specific numbers, and isn't fully
  automatic.** Safaricom's shared sandbox test number is `254708374149`
  (documented in `D:\Projects\E-Payments\README.md`) — pushing to it gets a
  response, but not necessarily "completed." Proving the actual completed
  path needs one small real charge on live credentials to a real, owned
  phone number.
- **A Railway Cron Job service's `startCommand` must run `node` directly
  against tsx's JS entry point** (`node node_modules/tsx/dist/cli.mjs
  scripts/reconcile-epayments.ts`), not `npm run` or `npx tsx` — both fail
  with "Permission denied" on `node_modules/.bin/tsx` in this container
  image. Already applied here — the reconciliation cron
  (`supplements-reconcile-epayments`, `.railway/railway.ts`, `*/5 * * * *`)
  is real Railway infrastructure, not just a script, and confirmed running
  correctly via its own log output (`reconcile-epayments: 0 stuck pending
  order(s) found`).

### A repeat guest checkout crashed with a 500 — unique constraint on `customers.email`/`customers.phone`

**Found live 30/09/2026** while re-verifying the live-credentials test:
`customers.email` and `customers.phone` both carry a `UNIQUE` constraint
(`phone` is also used to look a customer up at OTP login — see
`src/lib/auth.ts`). The guest-checkout path in `checkout/init.ts`
unconditionally ran `db.insert(customers).values({ email, phone })` with no
handling for either field already belonging to an existing customer row.
The second live M-Pesa test (same phone number as the first, different
email) hit a raw Postgres `23505 duplicate key value violates unique
constraint` error, which the outer `catch` turned into a bare 500 "Failed
to start checkout." **Any real returning guest customer's second checkout
attempt — same email, or the same phone typed under a different email —
would have failed the same way.**

The fix does **not** look up and reuse an existing customer by email/phone
— that would reintroduce exactly the kind of silent authentication-by-
contact-info the guest-checkout design in §2.1 deliberately avoids. Instead,
on a `23505` collision, `insertGuestCustomer()` drops whichever field
collided and retries the insert without it — the real email/phone the
customer typed is still recorded correctly on the `orders`/`pending_orders`
row regardless of what this particular guest `customers` row ends up
carrying. `NULL` is never itself a unique-constraint collision, so the
retry loop always terminates within two extra attempts.

This same latent bug was found to exist, unfixed, in cosmetics.ke's
identical code (live since 29/09/2026) — ported the same fix there too,
see its own `docs/PAYMENT_INTEGRATION.md` §6.6.

**Addendum**: porting this fix to cosmetics.ke surfaced that an exact
`err.constraint === "customers_email_key"` match only works if the
database's constraints actually use Postgres's own default naming — this
database's do (confirmed via `SELECT conname FROM pg_constraint WHERE
conrelid = 'customers'::regclass AND contype = 'u'` over the tunnel), but
cosmetics.ke's identical-looking schema turned out to use Drizzle's
`.unique()` naming (`customers_email_unique`) instead, silently never
firing the retry there. `insertGuestCustomer()` here was hardened to match
by `.includes("email")`/`.includes("phone")` instead of an exact string, so
it survives either naming convention — check this in the live database,
never assume it from how the constraint was declared in `shared/schema.ts`.

### The M-Pesa confirmation SMS showed a raw UUID as the "account"

**Found live 30/09/2026** on a real KES 1 test payment: the confirmation
SMS read `"... sent to SHOPUSA LIMITED for account
446a35d8-debd-4701-84f4-2b970641c87e ..."` — the raw `pending_orders.id`
UUID, sent as-is as the M-Pesa `accountReference`. To a real payer this
reads as broken or suspicious, not as a real order reference.

**Fix**: added a nullable `order_code` column to `pending_orders`
(additive SQL, applied directly). `checkout/init.ts` now generates a short
code (`generateOrderCode()` in `src/lib/orderCode.ts`) up front, stores it
on the `pending_orders` row, and sends *that* as the gateway
`accountReference` instead of the raw UUID. `finalizePendingOrder()` then
reuses that exact same code as the real order's `orderNumber` (falling
back to `checkoutFinalize.ts`'s own `generateOrderNumber()` only for a row
predating this column) — so the reference a customer already saw in their
confirmation SMS always matches their order confirmation number.

**The code is capped at 12 characters with no prefix or separator**
(`<timestamp-in-base36><4-char-random>`, last 12 chars kept) — not the
usual `ORD-XXXX-XXXX` shape `generateOrderNumber()` produces elsewhere.
E-Payments' own API docs (`D:\Projects\E-Payments\src\app\docs\page.js`,
read only — this repo never edits that codebase) state
`accountReference` is capped at 12 characters; the initial version of this
fix used the longer `ORD-...` format and would have silently exceeded that
cap. Same fix ported to cosmetics.ke the same day; see its own
`docs/PAYMENT_INTEGRATION.md` §6.7.
