/**
 * DeliveryModal.tsx
 * Lightweight modal — only collects delivery details.
 * The bundle choice + pricing is already visible on the page.
 */
import { useState, useEffect } from 'react';

interface Props {
  productId: string;
  qty: number;
  unitPrice: number;
  total: number;
  currency: string;
  productName: string;
  open: boolean;
  onClose: () => void;
}

const KENYA_CITIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Ruiru',
  'Kikuyu','Machakos','Meru','Nyeri','Kitale','Malindi','Garissa',
  'Kakamega','Kisii','Kericho','Naivasha','Narok','Embu',
  'Athi River','Juja','Limuru','Kiambu',"Murang'a",
];

function fmt(n: number, cur = 'KES') {
  return `${cur} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export default function DeliveryModal({ productId, qty, unitPrice, total, currency, productName, open, onClose }: Props) {
  const [form, setForm] = useState({ name: '', whatsapp: '', address: '', city: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.whatsapp || !form.address || !form.city) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/cod-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: qty, name: form.name, phone: form.whatsapp, whatsapp: form.whatsapp, address: form.address, city: form.city, unitPrice, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setOrderNumber(data.orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-background z-10">
          <div>
            <h2 className="font-bold text-base">Where should we deliver?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{qty} × {productName} · {fmt(total, currency)}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {orderNumber ? (
          <div className="px-5 py-10 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Order Confirmed!</h3>
            <p className="text-muted-foreground text-sm mb-1">Order: <strong>{orderNumber}</strong></p>
            <p className="text-muted-foreground text-sm mb-6">We'll WhatsApp you to confirm delivery time. Pay cash when it arrives — no upfront payment.</p>
            <button onClick={() => { onClose(); setOrderNumber(null); setForm({ name:'', whatsapp:'', address:'', city:'' }); }} className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90">
              Continue Shopping
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Full Name <span className="text-destructive">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </span>
                <input required type="text" placeholder="Your full name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full pl-9 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Number <span className="text-destructive">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.418A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" fill="#25D366"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M9.076 7.5c-.215-.48-.44-.49-.645-.499L7.8 7c-.18 0-.47.067-.716.338C6.838 7.61 6 8.388 6 9.974c0 1.587 1.144 3.12 1.304 3.337.161.215 2.195 3.535 5.425 4.812 2.683 1.058 3.23.848 3.813.795.584-.053 1.883-.77 2.149-1.514.265-.744.265-1.381.185-1.514-.08-.133-.295-.213-.619-.373-.323-.16-1.91-.942-2.206-1.05-.295-.107-.51-.16-.724.16-.215.32-.831 1.05-.969 1.263-.214.266-.161.32-.484.16-.323-.16-1.363-.502-2.595-1.602-.96-.855-1.608-1.91-1.797-2.23-.188-.32-.02-.493.142-.652.145-.142.323-.373.484-.558.162-.187.216-.32.323-.534.108-.214.054-.4-.027-.56-.08-.16-.704-1.755-.976-2.404Z" fill="white"/>
                  </svg>
                </span>
                <input required type="tel" placeholder="07XX XXX XXX" value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp: e.target.value}))} className="w-full pl-10 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            {/* Address */}
            <div>
              <label className="block text-sm font-medium mb-1">Delivery Address <span className="text-destructive">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-muted-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <input required type="text" placeholder="Street / Estate / Area" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="w-full pl-9 pr-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            {/* City */}
            <div>
              <label className="block text-sm font-medium mb-1">City <span className="text-destructive">*</span></label>
              <select required value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} className="w-full px-3 py-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select your city</option>
                {KENYA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-foreground text-background font-bold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 text-base flex items-center justify-center gap-2">
              {submitting ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Placing order...</>
              ) : (
                <>🛒 BUY IT NOW — {fmt(total, currency)}</>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground pb-1">Pay cash on delivery · No upfront payment</p>
          </form>
        )}
      </div>
    </div>
  );
}
