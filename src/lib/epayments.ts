import { createHmac, timingSafeEqual } from "crypto";

// Gateway client for E-Payments (a separate project the site owner also
// operates, D:\Projects\E-Payments, live at https://epayments.co.ke).
// supplements.ke is its own merchant on that platform (never cosmetics.ke's
// or shopusa.co.ke's merchant record), calling its v1 REST API to collect
// real M-Pesa STK-push and Paystack card payments at checkout. Same client
// shape as cosmetics.ke's src/lib/epayments.ts -- every function here calls
// E-Payments' own platform API, nothing supplements-specific. Reads env vars
// lazily (not at module scope) so a missing/unconfigured key surfaces as a
// handled error at the call site instead of crashing every route that
// imports this module.
function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.EPAYMENTS_API_URL;
  const apiKey = process.env.EPAYMENTS_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("EPAYMENTS_API_URL / EPAYMENTS_API_KEY are not set -- cannot reach the E-Payments gateway.");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function epaymentsFetch(path: string, options: { method: string; body?: unknown }): Promise<Response> {
  const { baseUrl, apiKey } = getConfig();

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    // E-Payments rate-limits at 10 requests/min per API key.
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "3");
      await sleep((retryAfter + 0.5) * 1000);
      continue;
    }
    if (res.status >= 500) {
      await sleep((attempt + 1) * 1000);
      continue;
    }
    return res;
  }
  throw new Error(`E-Payments API ${path} failed after retries (persistent 429/5xx)`);
}

type InitiateResult =
  | { provider: "mpesa"; transactionId: string; checkoutRequestId: string; status: string }
  | { provider: "paystack"; transactionId: string; checkoutUrl: string; status: string };

async function initiate(body: Record<string, unknown>): Promise<InitiateResult> {
  const res = await epaymentsFetch("/api/v1/payment", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? data.message ?? `E-Payments payment initiation failed: ${res.status}`);
  }
  return data as InitiateResult;
}

/** Triggers an M-Pesa STK push to the customer's phone. */
export async function initiateMpesaStkPush(params: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<InitiateResult & { provider: "mpesa" }> {
  const result = await initiate({
    phoneNumber: params.phoneNumber,
    amount: params.amount,
    accountReference: params.accountReference,
    description: params.description,
    metadata: params.metadata,
  });
  if (result.provider !== "mpesa") throw new Error("Expected an mpesa response from E-Payments");
  return result;
}

/** Starts a Paystack hosted-checkout charge; returns a checkoutUrl to redirect the customer to. */
export async function initiatePaystackCharge(params: {
  email: string;
  amount: number;
  accountReference: string;
  description: string;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitiateResult & { provider: "paystack" }> {
  const result = await initiate({
    provider: "paystack",
    email: params.email,
    amount: params.amount,
    accountReference: params.accountReference,
    description: params.description,
    redirectUrl: params.redirectUrl,
    metadata: params.metadata,
  });
  if (result.provider !== "paystack") throw new Error("Expected a paystack response from E-Payments");
  return result;
}

export type TransactionStatus = {
  id: string;
  status: "pending" | "completed" | "failed" | string;
  provider: "mpesa" | "paystack" | string;
  amount: number;
  orderId?: string | null;
  resultDesc: string | null;
  mpesaReceiptNumber: string | null;
  checkoutRequestId: string | null;
};

/** Polling fallback for when the webhook hasn't (yet) arrived. */
export async function getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
  const res = await epaymentsFetch(`/api/v1/transaction/${transactionId}`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `E-Payments transaction lookup failed: ${res.status}`);
  }
  // The real response nests everything under `transaction`, not flat.
  const transaction = data.transaction ?? data;
  return {
    id: transaction.id,
    status: transaction.status,
    provider: transaction.provider,
    amount: transaction.amount,
    orderId: transaction.order_id ?? null,
    resultDesc: transaction.result_desc ?? null,
    mpesaReceiptNumber: transaction.mpesa_receipt_number ?? null,
    checkoutRequestId: transaction.checkout_request_id ?? null,
  };
}

/**
 * Verifies E-Payments' X-MPesa-Signature header (HMAC-SHA256 over the raw
 * request body, keyed by this webhook endpoint's own secret -- set when the
 * endpoint is registered in the E-Payments dashboard, distinct from the API
 * key). Must be called with the RAW body bytes, not the JSON-parsed object --
 * re-stringifying a parsed body is not guaranteed to byte-for-byte match what
 * E-Payments actually signed.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.EPAYMENTS_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  // Buffers of differing length would throw inside timingSafeEqual rather
  // than just comparing false -- an attacker-controlled header must never
  // reach that call with a mismatched length.
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
