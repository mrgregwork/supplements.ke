import { useState } from "react";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
}

interface RefundRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  requestedByEmail: string;
  fulfilledByEmail: string | null;
  fulfillmentReference: string | null;
  cancellationReason: string | null;
}

interface Props {
  orderId: string;
  orderTotal: number;
  currency: string;
  items: OrderItem[];
  refundRequests: RefundRequest[];
}

const REASON_PRESETS = [
  "Product not in stock",
  "Customer requested cancellation",
  "Wrong item shipped",
  "Damaged on arrival",
  "Other",
];

export default function AdminRefundPanel({ orderId, orderTotal, currency, items, refundRequests: initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reasonPreset, setReasonPreset] = useState(REASON_PRESETS[0]);
  const [reasonOther, setReasonOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillRef, setFulfillRef] = useState("");
  const [fulfillNote, setFulfillNote] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const openRequest = requests.find((r) => r.status === "requested");
  const alreadyRefunded = requests.filter((r) => r.status === "fulfilled").reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, orderTotal - alreadyRefunded);
  const fmt = (n: number) => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function toggleItem(item: OrderItem) {
    setSelectedItemIds((prev) => {
      const next = prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id];
      const sum = items.filter((i) => next.includes(i.id)).reduce((s, i) => s + i.totalPrice, 0);
      setAmount(sum > 0 ? String(sum) : "");
      return next;
    });
  }

  async function submitRequest() {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    const reason = reasonPreset === "Other" ? reasonOther.trim() : reasonPreset;
    if (!reason) { setError("Enter a reason"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/request-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, reason, itemIds: selectedItemIds.length > 0 ? selectedItemIds : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request refund");
      setRequests((prev) => [data.refundRequest, ...prev]);
      setShowForm(false);
      setAmount("");
      setSelectedItemIds([]);
      setReasonOther("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitFulfill() {
    if (!openRequest) return;
    setError("");
    if (!fulfillRef.trim()) { setError("Enter the M-Pesa or bank reference for the money you sent back"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/refund-requests/${openRequest.id}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentReference: fulfillRef.trim(), fulfillmentNote: fulfillNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark fulfilled");
      setRequests((prev) => prev.map((r) => (r.id === openRequest.id ? data.refundRequest : r)));
      setFulfilling(false);
      setFulfillRef("");
      setFulfillNote("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitCancel() {
    if (!openRequest) return;
    setError("");
    if (!cancelReason.trim()) { setError("Enter a reason for cancelling the request"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/refund-requests/${openRequest.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request");
      setRequests((prev) => prev.map((r) => (r.id === openRequest.id ? data.refundRequest : r)));
      setCancelling(false);
      setCancelReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const history = requests.filter((r) => r.status !== "requested");

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Refund</h3>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>
      )}

      {!openRequest && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={remaining <= 0}
          className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition text-sm disabled:opacity-50"
        >
          {remaining <= 0 ? "Fully refunded" : "Request Refund"}
        </button>
      )}

      {!openRequest && showForm && (
        <div className="space-y-3 text-sm">
          {items.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Refund specific items (optional — leave unchecked for a custom amount)</p>
              {items.map((item) => (
                <label key={item.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => toggleItem(item)} />
                  <span className="flex-1">{item.productName} &times; {item.quantity}</span>
                  <span className="text-muted-foreground">{fmt(item.totalPrice)}</span>
                </label>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Amount ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Up to {fmt(remaining)} remaining refundable on this order</p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Reason</label>
            <select
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {REASON_PRESETS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {reasonPreset === "Other" && (
              <input
                type="text"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Describe the reason"
                className="w-full mt-2 px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitRequest}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border hover:bg-muted transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {openRequest && (
        <div className="space-y-3 text-sm">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3">
            <p className="font-medium text-amber-800 dark:text-amber-400">Refund requested — {fmt(openRequest.amount)}</p>
            <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">{openRequest.reason}</p>
            <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">Requested by {openRequest.requestedByEmail}</p>
          </div>

          {fulfilling ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Once you've actually sent the money back (M-Pesa, bank transfer, etc.), confirm it here:</p>
              <input
                type="text"
                placeholder="M-Pesa / bank reference"
                value={fulfillRef}
                onChange={(e) => setFulfillRef(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={fulfillNote}
                onChange={(e) => setFulfillNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitFulfill}
                  disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Confirm Refund Sent"}
                </button>
                <button type="button" onClick={() => setFulfilling(false)} className="px-4 py-2 rounded-lg border hover:bg-muted transition">
                  Back
                </button>
              </div>
            </div>
          ) : cancelling ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason for cancelling this request"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitCancel}
                  disabled={loading}
                  className="flex-1 bg-destructive text-destructive-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {loading ? "Cancelling..." : "Cancel Refund Request"}
                </button>
                <button type="button" onClick={() => setCancelling(false)} className="px-4 py-2 rounded-lg border hover:bg-muted transition">
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFulfilling(true)}
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:opacity-90 transition text-sm"
              >
                Mark Fulfilled
              </button>
              <button type="button" onClick={() => setCancelling(true)} className="px-4 py-2 rounded-lg border hover:bg-muted transition text-sm">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">History</p>
          {history.map((r) => (
            <div key={r.id} className="text-xs text-muted-foreground">
              <span className={r.status === "fulfilled" ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                {r.status === "fulfilled" ? "Refunded" : "Cancelled"}
              </span>
              {" "}{fmt(r.amount)} — {r.reason}
              {r.status === "fulfilled" && r.fulfillmentReference && <> (ref: {r.fulfillmentReference})</>}
              {r.status === "cancelled" && r.cancellationReason && <> ({r.cancellationReason})</>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
