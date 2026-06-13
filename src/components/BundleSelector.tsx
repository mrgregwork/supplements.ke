/**
 * BundleSelector.tsx
 *
 * CRO-optimised bundle pricing with anchoring effect.
 *
 * Psychology applied:
 * - Anchor: crossed-out full price on multi-unit tiers makes savings feel real
 * - Decoy / centre-stage: 2-bottle pre-selected as "Most Popular"
 * - Escalating rewards: 10 % off for 2, 20 % off for 3 (not flat %)
 * - Per-unit price on bundles makes value obvious
 * - Never shows "Save 0 %" — that kills conversions
 */

import { useState } from 'react';

interface Props {
  productId: string;
  productName: string;
  price: number;          // single-unit current price (KES)
  originalPrice?: number; // single-unit crossed-out price (KES), if any
  currency?: string;
}

function fmt(n: number, currency = 'KES') {
  return `${currency} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

const TIERS = [
  { qty: 1, label: '1 Bottle',  discountPct: 0,  badge: null,           badgeColour: '' },
  { qty: 2, label: '2 Bottles', discountPct: 10, badge: 'Most Popular', badgeColour: 'bg-primary text-primary-foreground' },
  { qty: 5, label: '5 Bottles', discountPct: 20, badge: 'Best Value',   badgeColour: 'bg-green-600 text-white' },
];

export default function BundleSelector({ productId, productName, price, originalPrice, currency = 'KES' }: Props) {
  const [selected, setSelected] = useState(2); // pre-select 2-bottle (Most Popular)
  const [loading, setLoading]   = useState(false);
  const [added, setAdded]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleAddToCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add to cart');
      setAdded(true);
      setTimeout(() => { window.location.href = '/cart'; }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const selectedTier = TIERS.find(t => t.qty === selected)!;
  const selectedTotal = Math.round(price * selected * (1 - selectedTier.discountPct / 100));
  const selectedAnchor = price * selected; // full undiscounted total
  const selectedSaving = selectedAnchor - selectedTotal;

  return (
    <div className="space-y-3">

      {/* Tier selector */}
      <div className="space-y-2">
        {TIERS.map(tier => {
          const total      = Math.round(price * tier.qty * (1 - tier.discountPct / 100));
          const anchor     = price * tier.qty;  // full price as anchor
          const perUnit    = Math.round(total / tier.qty);
          const saving     = anchor - total;
          const isSelected = selected === tier.qty;

          return (
            <button
              key={tier.qty}
              onClick={() => setSelected(tier.qty)}
              className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all
                ${isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 bg-card'}`}
            >
              <div className="flex items-center justify-between gap-2">

                {/* Left: radio + label + badge */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Radio dot */}
                  <span className={`flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center
                    ${isSelected ? 'border-primary' : 'border-muted-foreground'}`}>
                    {isSelected && <span className="h-2 w-2 rounded-full bg-primary block" />}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{tier.label}</span>
                      {tier.badge && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.badgeColour}`}>
                          {tier.badge}
                        </span>
                      )}
                    </div>
                    {tier.qty > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Just {fmt(perUnit, currency)} per bottle
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: price + anchor + savings */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    {/* Anchor (crossed-out full price) — always show for qty>1, show originalPrice for qty=1 */}
                    {tier.qty === 1 && originalPrice && originalPrice > price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {fmt(originalPrice, currency)}
                      </span>
                    )}
                    {tier.qty > 1 && (
                      <span className="text-xs text-muted-foreground line-through">
                        {fmt(anchor, currency)}
                      </span>
                    )}
                    <span className="font-bold text-sm">{fmt(total, currency)}</span>
                  </div>
                  {saving > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">
                      Save {fmt(saving, currency)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary savings strip (only when multi-unit selected) */}
      {selectedSaving > 0 && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-green-700 dark:text-green-400 font-medium">
            🎉 You save {fmt(selectedSaving, currency)} on this order
          </span>
          <span className="text-green-700 dark:text-green-400 font-bold">
            -{selectedTier.discountPct}%
          </span>
        </div>
      )}

      {/* CTA */}
      {added ? (
        <button
          disabled
          className="w-full py-3 px-6 bg-green-600 text-white font-semibold rounded-md flex items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Added to Cart!
        </button>
      ) : (
        <button
          onClick={handleAddToCart}
          disabled={loading}
          className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          data-testid="button-add-to-cart"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Adding...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              Add {selected > 1 ? `${selected} Bottles` : '1 Bottle'} to Cart
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm text-center" data-testid="text-error">
          {error}
        </p>
      )}
    </div>
  );
}
