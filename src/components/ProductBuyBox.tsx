/**
 * ProductBuyBox.tsx
 *
 * The full right-panel selling section for a product page.
 * Everything visible immediately — no hidden pricing behind clicks.
 *
 * Layout (top → bottom):
 *  1. Price with anchor (original crossed out)
 *  2. Bundle selector (visible, selectable)
 *  3. Savings summary strip
 *  4. Stock / urgency signal
 *  5. CTA button → opens DeliveryModal
 *  6. Trust badges
 *  7. Guarantee
 */

import { useState } from 'react';
import DeliveryModal from './DeliveryModal';

interface Props {
  productId: string;
  productName: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  /** Override default discounts per product: e.g. [0, 15, 25] for 1/2/3 bottles */
  discounts?: [number, number, number];
}

function fmt(n: number, cur = 'KES') {
  return `${cur} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export default function ProductBuyBox({
  productId, productName, price, originalPrice, currency = 'KES',
  discounts,
}: Props) {
  const TIERS_EFFECTIVE = [
    { qty: 1, label: '1 Bottle',  discount: discounts?.[0] ?? 0,  badge: null,           badgeClass: '' },
    { qty: 2, label: '2 Bottles', discount: discounts?.[1] ?? 10, badge: 'Most Popular', badgeClass: '' },
    { qty: 5, label: '5 Bottles', discount: discounts?.[2] ?? 15, badge: 'Best Value',   badgeClass: '' },
  ];

  const [qty, setQty]         = useState(2);
  const [modalOpen, setModal] = useState(false);

  const tier      = TIERS_EFFECTIVE.find(t => t.qty === qty)!;
  const unitPrice = Math.round(price * (1 - tier.discount / 100));
  const subtotal  = unitPrice * qty;
  const anchor    = price * qty;
  const saving    = anchor - subtotal;

  const singleAnchor = originalPrice && originalPrice > price ? originalPrice : null;

  return (
    <>
      <div className="space-y-4">

        {/* 1 ── Price anchor */}
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            {singleAnchor && (
              <span className="text-xl text-muted-foreground line-through">{fmt(singleAnchor, currency)}</span>
            )}
            <span className="text-4xl font-extrabold tracking-tight">{fmt(price, currency)}</span>
            {singleAnchor && (
              <span className="text-sm font-bold text-white bg-red-500 px-2.5 py-0.5 rounded-full shadow-sm">
                -{Math.round((1 - price / singleAnchor) * 100)}% OFF
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">per bottle · price increases with demand</p>
        </div>

        {/* 2 ── Bundle selector */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Select your supply</p>
          {TIERS_EFFECTIVE.map(t => {
            const tUnit    = Math.round(price * (1 - t.discount / 100));
            const tTotal   = tUnit * t.qty;
            const tAnchor  = price * t.qty;
            const tSaving  = tAnchor - tTotal;
            const tPerUnit = Math.round(tTotal / t.qty);
            const active   = qty === t.qty;
            const isMid    = t.qty === 2;

            return (
              <button
                key={t.qty}
                onClick={() => setQty(t.qty)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all duration-200 relative
                  ${active
                    ? 'border-primary bg-emerald-50/60 shadow-[0_0_0_4px_hsl(151_58%_30%_/_0.1)]'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-emerald-50/20'
                  }`}
              >
                {/* Most Popular ribbon */}
                {isMid && (
                  <span className={`absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full
                    ${active ? 'bg-primary text-white' : 'bg-stone-800 text-white'}`}>
                    ★ Most Popular
                  </span>
                )}
                {/* Best Value ribbon */}
                {t.qty === 5 && (
                  <span className={`absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full
                    ${active ? 'bg-amber-500 text-white' : 'bg-amber-400 text-white'}`}>
                    Best Value
                  </span>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Custom radio */}
                    <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${active ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-transparent'}`}>
                      {active && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      )}
                    </span>
                    <div className={isMid || t.qty === 5 ? 'mt-1' : ''}>
                      <span className={`font-bold text-sm ${active ? 'text-primary' : 'text-foreground'}`}>{t.label}</span>
                      {t.qty > 1 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(tPerUnit, currency)} per bottle</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                      {t.qty === 1 && singleAnchor && (
                        <span className="text-xs line-through text-muted-foreground">{fmt(singleAnchor, currency)}</span>
                      )}
                      {t.qty > 1 && (
                        <span className="text-xs line-through text-muted-foreground">{fmt(tAnchor, currency)}</span>
                      )}
                      <span className={`font-extrabold text-sm ${active ? 'text-primary' : 'text-foreground'}`}>{fmt(tTotal, currency)}</span>
                    </div>
                    {tSaving > 0 && (
                      <p className="text-[11px] text-green-600 font-bold">Save {fmt(tSaving, currency)}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3 ── Savings strip */}
        {saving > 0 && (
          <div className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-700 px-4 py-2.5 flex items-center justify-between text-sm shadow-sm">
            <span className="text-white font-semibold">
              🎉 You save <strong>{fmt(saving, currency)}</strong> on this order
            </span>
            <span className="text-green-100 font-bold text-base">-{tier.discount}%</span>
          </div>
        )}

        {/* 4 ── Stock / urgency signal */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"/>
            </span>
            In Stock
          </span>
          <span className="text-muted-foreground">Ships in 1–2 business days · Nairobi same-day available</span>
        </div>

        {/* 5 ── CTA */}
        <button
          onClick={() => setModal(true)}
          className="btn-cta w-full py-4 text-white font-extrabold rounded-xl text-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
        >
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
          Order Now — {fmt(subtotal, currency)}
        </button>
        <p className="text-center text-xs text-muted-foreground -mt-1">Pay cash on delivery · No upfront payment required</p>

        {/* 6 ── Trust badges */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-1.5 px-2 py-3 bg-card border border-border/60 rounded-xl shadow-sm">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <span className="text-[11px] font-semibold leading-tight">Free<br/>Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-2 py-3 bg-card border border-border/60 rounded-xl shadow-sm">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
              </svg>
            </div>
            <span className="text-[11px] font-semibold leading-tight">Pay on<br/>Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-2 py-3 bg-card border border-border/60 rounded-xl shadow-sm">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
              </svg>
            </div>
            <span className="text-[11px] font-semibold leading-tight">30-Day<br/>Returns</span>
          </div>
        </div>

        {/* 7 ── Guarantee */}
        <div className="flex items-start gap-3 p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="h-6 w-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">100% Satisfaction Guarantee</p>
            <p className="text-xs text-amber-700/80 mt-0.5">Not happy? Return within 30 days for a full refund — no questions asked.</p>
          </div>
        </div>

      </div>

      <DeliveryModal
        open={modalOpen}
        onClose={() => setModal(false)}
        productId={productId}
        productName={productName}
        qty={qty}
        unitPrice={unitPrice}
        total={subtotal}
        currency={currency}
      />
    </>
  );
}
