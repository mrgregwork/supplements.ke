import "dotenv/config";
import { db } from "../server/db";
import { pendingOrders } from "@shared/schema";
import { and, eq, lt } from "drizzle-orm";
import { getTransactionStatus } from "../src/lib/epayments";
import { finalizePendingOrder } from "../src/lib/checkoutFinalize";

// Backstop for E-Payments' own webhook, which makes exactly one delivery
// attempt, ever -- see docs/PAYMENT_INTEGRATION.md. Run this on a schedule
// (Railway Cron Job service, see RUNBOOK.md) -- it is not meant to run
// inside the always-on web process.
//
// Sweeps every pending_orders row still "pending" for more than 2 minutes
// (long enough that the client's own status-poll has had a fair chance to
// resolve it first) and asks E-Payments directly what actually happened.

const STUCK_AFTER_MS = 2 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);

  const stuck = await db
    .select()
    .from(pendingOrders)
    .where(and(eq(pendingOrders.status, "pending"), lt(pendingOrders.createdAt, cutoff)));

  console.log(`reconcile-epayments: ${stuck.length} stuck pending order(s) found`);

  for (const row of stuck) {
    if (!row.gatewayTransactionId) {
      console.log(`  ${row.id}: no gateway transaction id yet -- gateway call itself never even started, skipping`);
      continue;
    }
    try {
      const txn = await getTransactionStatus(row.gatewayTransactionId);
      if (txn.status === "completed") {
        const result = await finalizePendingOrder(row.id, "confirmed", {
          mpesaReceiptNumber: txn.mpesaReceiptNumber,
          cardReference: txn.checkoutRequestId,
        });
        console.log(`  ${row.id}: confirmed -> order ${result.orderNumber}`);
      } else if (txn.status === "failed") {
        await finalizePendingOrder(row.id, "failed", { gatewayMessage: txn.resultDesc });
        console.log(`  ${row.id}: marked failed (${txn.resultDesc ?? "no reason given"})`);
      } else {
        console.log(`  ${row.id}: still pending on E-Payments' side, leaving as-is`);
      }
    } catch (err) {
      console.error(`  ${row.id}: reconcile lookup failed`, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("reconcile-epayments: fatal error", err);
    process.exit(1);
  });
