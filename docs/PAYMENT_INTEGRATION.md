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
   the shipping address, and the chosen `paymentMethod`.
4. Calls `initiateMpesaStkPush()` or `initiatePaystackCharge()` in
   `src/lib/epayments.ts`, with the callback/redirect URL built from
   `RAILWAY_PUBLIC_DOMAIN` — never from `request.url`, which on Railway is
   an internal proxy address the outside world (Safaricom/Paystack/
   E-Payments) can't reach.
5. For Card, the Paystack `redirectUrl` points at
   `/checkout/return?pendingOrderId=...`, since the customer returns via a
   full page navigation (Paystack's hosted checkout page) that loses any
   React state the checkout page had.

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
- **Reconciliation cron (`scripts/reconcile-epayments.ts`) exists as a
  script only** — not yet provisioned as actual Railway infrastructure (a
  scheduled Cron Job service). See cosmetics.ke's own `.railway/railway.ts`
  and `docs/PAYMENT_INTEGRATION.md` §7 for the pattern to follow; this is
  planned follow-up work, not blocking the core checkout flow.

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
  image. Relevant once the reconciliation cron (§5) is provisioned as real
  infrastructure.
