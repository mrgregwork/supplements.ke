import { useState } from "react";

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
  };
}

interface CheckoutFormProps {
  cartItems: CartItem[];
  subtotal: number;
  customerEmail?: string;
  customerPhone?: string;
  customerId?: string | null;
}

type Step = "contact" | "shipping" | "payment" | "confirmation";

export default function CheckoutForm({ 
  cartItems, 
  subtotal, 
  customerEmail = "", 
  customerPhone = "",
  customerId = null 
}: CheckoutFormProps) {
  const [step, setStep] = useState<Step>("contact");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  
  const [formData, setFormData] = useState({
    email: customerEmail,
    phone: customerPhone,
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Kenya",
    notes: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateContact = () => {
    if (!formData.email) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email");
      return false;
    }
    return true;
  };

  const validateShipping = () => {
    if (!formData.firstName) {
      setError("First name is required");
      return false;
    }
    if (!formData.lastName) {
      setError("Last name is required");
      return false;
    }
    if (!formData.address1) {
      setError("Address is required");
      return false;
    }
    if (!formData.city) {
      setError("City is required");
      return false;
    }
    if (!formData.postalCode) {
      setError("Postal code is required");
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (step === "contact") {
      if (validateContact()) setStep("shipping");
    } else if (step === "shipping") {
      if (validateShipping()) setStep("payment");
    }
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          shippingAddress: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            address1: formData.address1,
            address2: formData.address2,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            country: formData.country,
          },
          notes: formData.notes,
          customerId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to place order");
      }
      
      setOrderNumber(data.orderNumber);
      setStep("confirmation");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "confirmation") {
    return (
      <div className="bg-card rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Order Confirmed!</h2>
        <p className="text-muted-foreground mb-4">Thank you for your order</p>
        <p className="font-mono text-lg font-semibold mb-6" data-testid="text-order-number">
          Order #{orderNumber}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          A confirmation email has been sent to {formData.email}
        </p>
        <div className="space-y-2">
          <a 
            href="/"
            className="block w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:opacity-90 transition"
            data-testid="link-continue-shopping"
          >
            Continue Shopping
          </a>
          <a 
            href="/account"
            className="block w-full border border-input py-3 px-4 rounded-lg font-medium hover:bg-muted transition"
            data-testid="link-view-orders"
          >
            View My Orders
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span className={step === "contact" ? "text-primary font-medium" : ""}>Contact</span>
        <span>›</span>
        <span className={step === "shipping" ? "text-primary font-medium" : ""}>Shipping</span>
        <span>›</span>
        <span className={step === "payment" ? "text-primary font-medium" : ""}>Payment</span>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm" data-testid="text-checkout-error">
          {error}
        </div>
      )}

      {step === "contact" && (
        <div className="bg-card rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Contact Information</h2>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="phone">
              Phone (optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="+254..."
              data-testid="input-phone"
            />
          </div>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:opacity-90 transition"
            data-testid="button-continue-to-shipping"
          >
            Continue to Shipping
          </button>
        </div>
      )}

      {step === "shipping" && (
        <div className="bg-card rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shipping Address</h2>
            <button 
              type="button"
              onClick={() => setStep("contact")}
              className="text-sm text-primary hover:underline"
              data-testid="button-back-to-contact"
            >
              Edit contact
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="firstName">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="lastName">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-last-name"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="address1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              id="address1"
              type="text"
              value={formData.address1}
              onChange={(e) => updateField("address1", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Street address"
              data-testid="input-address1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="address2">
              Apartment, suite, etc. (optional)
            </label>
            <input
              id="address2"
              type="text"
              value={formData.address2}
              onChange={(e) => updateField("address2", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="input-address2"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="city">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-city"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="postalCode">
                Postal Code <span className="text-red-500">*</span>
              </label>
              <input
                id="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-postal-code"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="country">
              Country
            </label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => updateField("country", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="select-country"
            >
              <option value="Kenya">Kenya</option>
              <option value="Uganda">Uganda</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Rwanda">Rwanda</option>
            </select>
          </div>
          
          <button
            type="button"
            onClick={handleContinue}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:opacity-90 transition"
            data-testid="button-continue-to-payment"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {step === "payment" && (
        <div className="bg-card rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Payment</h2>
            <button 
              type="button"
              onClick={() => setStep("shipping")}
              className="text-sm text-primary hover:underline"
              data-testid="button-back-to-shipping"
            >
              Edit shipping
            </button>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-foreground">Demo Mode</p>
                <p className="text-sm">No real payment will be processed. This is a demonstration checkout.</p>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="notes">
              Order Notes (optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Any special instructions..."
              data-testid="input-notes"
            />
          </div>
          
          <div className="border-t pt-4">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            data-testid="button-place-order"
          >
            {loading ? "Placing Order..." : `Place Order - $${subtotal.toFixed(2)}`}
          </button>
          
          <p className="text-xs text-muted-foreground text-center">
            By placing your order, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      )}
    </div>
  );
}
