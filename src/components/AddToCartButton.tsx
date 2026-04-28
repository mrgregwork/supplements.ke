import { useState } from 'react';

interface AddToCartButtonProps {
  productId: string;
  productName: string;
}

export default function AddToCartButton({ productId, productName }: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToCart = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add to cart');
      }

      setAdded(true);
      
      // Redirect to cart after short delay
      setTimeout(() => {
        window.location.href = '/cart';
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (added) {
    return (
      <button
        disabled
        className="w-full py-3 px-6 bg-green-600 text-white font-medium rounded-md flex items-center justify-center gap-2"
        data-testid="button-added-to-cart"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Added to Cart!
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={addToCart}
        disabled={loading}
        className="w-full py-3 px-6 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            Add to Cart
          </>
        )}
      </button>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center" data-testid="text-error">
          {error}
        </p>
      )}
    </div>
  );
}
