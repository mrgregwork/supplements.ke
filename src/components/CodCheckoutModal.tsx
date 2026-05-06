/**
 * CodCheckoutModal.tsx
 *
 * Cash-on-Delivery checkout modal with bundle selector + order form.
 * Mirrors Kuwamart's proven checkout UX but with better CRO:
 * - No "Save 0%" on 1 unit
 * - Escalating discounts (10%, 20%)
 * - Most Popular pre-selected
 * - Per-unit price shown
 */

import { useState, useEffect } from 'react';

interface Props {
  productId: string;
  productName: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  buttonLabel?: string;
}

const TIERS = [
  { qty: 1, label: '1 Bottle',  discount: 0,  badge: null,           badgeClass: '' },
  { qty: 2, label: '2 Bottles', discount: 10, badge: 'Most Popular', badgeClass: 'bg-primary text-primary-foreground' },
  { qty: 3, label: '3 Bottles', discount: 20, badge: 'Best Value',   badgeClass: 'bg-green-600 text-white' },
];

const KENYA_CITIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret',
  'Thika', 'Ruiru', 'Kikuyu', 'Machakos', 'Meru',
  'Nyeri', 'Kitale', 'Malindi', 'Garissa', 'Kakamega',
  'Kisii', 'Kericho', 'Naivasha', 'Narok', 'Embu',
  'Athi River', 'Juja', 'Limuru', 'Kiambu', 'Murang\'a',
];

function fmt(n: number, currency = 'KES') {
  return `${currency} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export default function CodCheckoutModal({
  productId, productName, price, originalPrice, currency = 'KES', buttonLabel = 'Order Now'
}: Props) {
  const [open,     setOpen]     = useState(false);
  const [qty,      setQty]      = useState(2); // pre-select Most Popular
  const [submitting, setSubmitting] = useState(false);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', whatsapp: '', address: '', city: '',
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const tier      = TIERS.find(t => t.qty === qty)!;
  const unitPrice = Math.round(price * (1 - tier.discount / 100));
  const subtotal  = unitPrice * qty;
  const anchor    = price * qty;
  const saving    = anchor - subtotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.whatsapp || !form.address || !form.city) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cod-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantity: qty,
          name: form.name,
          phone: form.whatsapp,
          whatsapp: form.whatsapp,
          address: form.address,
          city: form.city,
          unitPrice,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setSuccess(data.orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-base"
        data-testid="button-order-now"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
        </svg>
        {buttonLabel}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal box */}
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-background z-10">
              <h2 className="font-semibold text-base">Complete your order</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {success ? (
              /* ── Success state ── */
              <div className="px-5 py-10 text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Order Placed!</h3>
                <p className="text-muted-foreground mb-1">Order number: <strong>{success}</strong></p>
                <p className="text-muted-foreground text-sm mb-6">
                  Our team will call you to confirm delivery. Pay cash on arrival — no upfront payment needed.
                </p>
                <button
                  onClick={() => { setOpen(false); setSuccess(null); }}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

                {/* ── Bundle selector ── */}
                <div className="space-y-2">
                  {TIERS.map(t => {
                    const tUnitPrice = Math.round(price * (1 - t.discount / 100));
                    const tTotal     = tUnitPrice * t.qty;
                    const tAnchor    = price * t.qty;
                    const tSaving    = tAnchor - tTotal;
                    const tPerUnit   = Math.round(tTotal / t.qty);
                    const active     = qty === t.qty;

                    return (
                      <button
                        key={t.qty}
                        type="button"
                        onClick={() => setQty(t.qty)}
                        className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all
                          ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                              ${active ? 'border-primary' : 'border-muted-foreground'}`}>
                              {active && <span className="h-2 w-2 rounded-full bg-primary block"/>}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm">{t.label}</span>
                                {t.badge && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${t.badgeClass}`}>
                                    {t.badge}
                                  </span>
                                )}
                              </div>
                              {t.qty > 1 && (
                                <p className="text-xs text-muted-foreground">
                                  Just {fmt(tPerUnit, currency)}/bottle
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {t.qty === 1 && originalPrice && originalPrice > price && (
                                <span className="text-xs line-through text-muted-foreground">{fmt(originalPrice, currency)}</span>
                              )}
                              {t.qty > 1 && (
                                <span className="text-xs line-through text-muted-foreground">{fmt(tAnchor, currency)}</span>
                              )}
                              <span className="font-bold text-sm">{fmt(tTotal, currency)}</span>
                            </div>
                            {tSaving > 0 && (
                              <p className="text-xs text-green-600 font-medium">Save {fmt(tSaving, currency)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* ── Order summary ── */}
                <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmt(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  {saving > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>You save</span>
                      <span className="font-medium">-{fmt(saving, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t text-base">
                    <span>Total</span>
                    <span>{fmt(subtotal, currency)}</span>
                  </div>
                </div>

                {/* ── Customer form ── */}
                <div className="space-y-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                        </svg>
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Your full name"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      WhatsApp Number <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      {/* Official WhatsApp logo */}
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" fill="#25D366"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.076 7.5c-.215-.48-.44-.49-.645-.499L7.8 7c-.18 0-.47.067-.716.338C6.838 7.61 6 8.388 6 9.974c0 1.587 1.144 3.12 1.304 3.337.161.215 2.195 3.535 5.425 4.812 2.683 1.058 3.23.848 3.813.795.584-.053 1.883-.77 2.149-1.514.265-.744.265-1.381.185-1.514-.08-.133-.295-.213-.619-.373-.323-.16-1.91-.942-2.206-1.05-.295-.107-.51-.16-.724.16-.215.32-.831 1.05-.969 1.263-.214.266-.161.32-.484.16-.323-.16-1.363-.502-2.595-1.602-.96-.855-1.608-1.91-1.797-2.23-.188-.32-.02-.493.142-.652.145-.142.323-.373.484-.558.162-.187.216-.32.323-.534.108-.214.054-.4-.027-.56-.08-.16-.704-1.755-.976-2.404Z" fill="white"/>
                        </svg>
                      </span>
                      <input
                        type="tel"
                        required
                        placeholder="07XX XXX XXX"
                        value={form.whatsapp}
                        onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Delivery Address <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-muted-foreground">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Street / Estate / Area"
                        value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      City <span className="text-destructive">*</span>
                    </label>
                    <select
                      required
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select your city</option>
                      {KENYA_CITIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-destructive text-sm text-center">{error}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 bg-foreground text-background font-bold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 text-base flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10"/>
                      </svg>
                      Placing order...
                    </>
                  ) : (
                    <>
                      🛒 BUY IT NOW — {fmt(subtotal, currency)}
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Pay cash on delivery · No upfront payment
                </p>

              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
