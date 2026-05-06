/**
 * ProductBuyBox.tsx
 *
 * The full right-panel selling section for a product page.
 * Everything visible immediately — no hidden pricing behind clicks.
 *
 * Layout (top → bottom):
 *  1. Star rating + review count (social proof)
 *  2. Price with anchor (original crossed out)
 *  3. Bundle selector (visible, selectable)
 *  4. Savings summary strip
 *  5. CTA button → opens DeliveryModal (just name/whatsapp/address/city)
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
  ratingValue?: number;
  reviewCount?: number;
}

const TIERS = [
  { qty: 1, label: '1 Bottle',  discount: 0,  badge: null,           badgeClass: '' },
  { qty: 2, label: '2 Bottles', discount: 10, badge: 'Most Popular', badgeClass: 'bg-primary text-primary-foreground' },
  { qty: 3, label: '3 Bottles', discount: 20, badge: 'Best Value',   badgeClass: 'bg-green-600 text-white' },
];

function fmt(n: number, cur = 'KES') {
  return `${cur} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'text-amber-400' : 'text-muted'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"/>
        </svg>
      ))}
    </span>
  );
}

export default function ProductBuyBox({
  productId, productName, price, originalPrice, currency = 'KES',
  ratingValue = 4.7, reviewCount = 84,
}: Props) {
  const [qty, setQty]           = useState(2);
  const [modalOpen, setModal]   = useState(false);

  const tier      = TIERS.find(t => t.qty === qty)!;
  const unitPrice = Math.round(price * (1 - tier.discount / 100));
  const subtotal  = unitPrice * qty;
  const anchor    = price * qty;
  const saving    = anchor - subtotal;

  // Single-unit anchor price
  const singleAnchor = originalPrice && originalPrice > price ? originalPrice : null;

  return (
    <>
      <div className="space-y-5">

        {/* 1 ── Star rating */}
        <div className="flex items-center gap-2">
          <Stars value={ratingValue} />
          <span className="text-sm font-semibold">{ratingValue}</span>
          <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
        </div>

        {/* 2 ── Price anchor */}
        <div className="flex items-baseline gap-3 flex-wrap">
          {singleAnchor && (
            <span className="text-lg text-muted-foreground line-through">{fmt(singleAnchor, currency)}</span>
          )}
          <span className="text-3xl font-bold">{fmt(price, currency)}</span>
          {singleAnchor && (
            <span className="text-sm font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
              Save {fmt(singleAnchor - price, currency)}
            </span>
          )}
        </div>

        {/* 3 ── Bundle selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Choose your supply</p>
          {TIERS.map(t => {
            const tUnit    = Math.round(price * (1 - t.discount / 100));
            const tTotal   = tUnit * t.qty;
            const tAnchor  = price * t.qty;
            const tSaving  = tAnchor - tTotal;
            const tPerUnit = Math.round(tTotal / t.qty);
            const active   = qty === t.qty;

            return (
              <button
                key={t.qty}
                onClick={() => setQty(t.qty)}
                className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all
                  ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-primary' : 'border-muted-foreground'}`}>
                      {active && <span className="h-2 w-2 rounded-full bg-primary block"/>}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{t.label}</span>
                        {t.badge && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badgeClass}`}>{t.badge}</span>
                        )}
                      </div>
                      {t.qty > 1 && (
                        <p className="text-xs text-muted-foreground mt-0.5">Just {fmt(tPerUnit, currency)} per bottle</p>
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

        {/* 4 ── Savings strip */}
        {saving > 0 && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-green-700 dark:text-green-400 font-medium">
              🎉 You save {fmt(saving, currency)} on this order
            </span>
            <span className="text-green-700 dark:text-green-400 font-bold">-{tier.discount}%</span>
          </div>
        )}

        {/* 5 ── CTA */}
        <button
          onClick={() => setModal(true)}
          className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors text-lg flex items-center justify-center gap-2 shadow-md"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
          Order Now — {fmt(subtotal, currency)}
        </button>

        {/* 6 ── Trust badges */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-1 px-2 py-3 bg-muted/40 rounded-lg">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span className="text-xs font-medium leading-tight">Free Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-2 py-3 bg-muted/40 rounded-lg">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
            </svg>
            <span className="text-xs font-medium leading-tight">Pay on Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-2 py-3 bg-muted/40 rounded-lg">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
            </svg>
            <span className="text-xs font-medium leading-tight">30-Day Returns</span>
          </div>
        </div>

        {/* 7 ── Guarantee */}
        <div className="flex items-start gap-3 p-3 border border-dashed rounded-lg">
          <svg className="h-8 w-8 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <div>
            <p className="text-sm font-semibold">100% Satisfaction Guarantee</p>
            <p className="text-xs text-muted-foreground mt-0.5">Not happy? Return within 30 days for a full refund — no questions asked.</p>
          </div>
        </div>

      </div>

      {/* Delivery modal */}
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
