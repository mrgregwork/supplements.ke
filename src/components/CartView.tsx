import { useState } from 'react';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    currency: string;
    images: string[];
    categorySlug: string;
    subcategorySlug: string;
  };
}

interface CartViewProps {
  initialItems: CartItem[];
  initialSubtotal: number;
}

export default function CartView({ initialItems, initialSubtotal }: CartViewProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [loading, setLoading] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const currency = items[0]?.product.currency || 'USD';

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    setLoading(itemId);

    try {
      const res = await fetch(`/api/cart/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      const data = await res.json();
      if (res.ok) {
        if (newQuantity === 0) {
          setItems(items.filter(item => item.id !== itemId));
        } else {
          setItems(items.map(item => 
            item.id === itemId ? { ...item, quantity: newQuantity } : item
          ));
        }
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
    } finally {
      setLoading(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setLoading(itemId);

    try {
      const res = await fetch(`/api/cart/${itemId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setItems(items.filter(item => item.id !== itemId));
      }
    } catch (error) {
      console.error('Failed to remove item:', error);
    } finally {
      setLoading(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16" data-testid="section-empty-cart">
        <svg className="mx-auto h-16 w-16 text-muted-foreground mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
        <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some products to get started</p>
        <a 
          href="/all-supplements/"
          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
          data-testid="link-shop"
        >
          Continue Shopping
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Cart Items */}
      <div className="lg:col-span-2 space-y-4" data-testid="section-cart-items">
        {items.map((item) => (
          <div 
            key={item.id}
            className={`flex gap-4 p-4 bg-card border border-border rounded-lg ${loading === item.id ? 'opacity-50' : ''}`}
            data-testid={`cart-item-${item.productId}`}
          >
            {/* Product Image */}
            <div className="w-24 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden">
              {item.product.images?.[0] ? (
                <img 
                  src={item.product.images[0]} 
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="flex-1 min-w-0">
              <a 
                href={`/${item.product.categorySlug}/${item.product.subcategorySlug}/${item.product.slug}`}
                className="font-medium hover:text-primary transition-colors line-clamp-2"
              >
                {item.product.name}
              </a>
              <p className="text-sm text-muted-foreground mt-1">
                {item.product.currency} {item.product.price.toLocaleString()}
              </p>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={loading === item.id}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                data-testid={`button-decrease-${item.productId}`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.productId}`}>
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={loading === item.id}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                data-testid={`button-increase-${item.productId}`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </button>
            </div>

            {/* Item Total & Remove */}
            <div className="flex flex-col items-end justify-between">
              <span className="font-semibold" data-testid={`text-item-total-${item.productId}`}>
                {item.product.currency} {(item.product.price * item.quantity).toLocaleString()}
              </span>
              <button
                onClick={() => removeItem(item.id)}
                disabled={loading === item.id}
                className="text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                data-testid={`button-remove-${item.productId}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="bg-card border border-border rounded-lg p-6 sticky top-24" data-testid="section-order-summary">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          
          <div className="space-y-3 pb-4 border-b border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
              <span>{currency} {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-green-600">Calculated at checkout</span>
            </div>
          </div>

          <div className="flex justify-between py-4 font-semibold text-lg">
            <span>Total</span>
            <span data-testid="text-cart-total">{currency} {subtotal.toLocaleString()}</span>
          </div>

          <a
            href="/checkout"
            className="block w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-md text-center hover:bg-primary/90 transition-colors"
            data-testid="link-checkout"
          >
            Proceed to Checkout
          </a>

          <a
            href="/all-supplements/"
            className="block w-full py-2 px-4 text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-3"
            data-testid="link-continue-shopping"
          >
            Continue Shopping
          </a>
        </div>
      </div>
    </div>
  );
}
