import { useState } from "react";

interface Customer {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AccountSettingsFormProps {
  customer: Customer;
}

export default function AccountSettingsForm({ customer }: AccountSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    email: customer.email || "",
    phone: customer.phone || "",
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      const response = await fetch("/api/account/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update account");
      }
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm" data-testid="text-error">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm" data-testid="text-success">
          Your account has been updated successfully.
        </div>
      )}
      
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Personal Information</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="firstName">
              First Name
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
              Last Name
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
      </div>
      
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Contact Information</h2>
        <p className="text-sm text-muted-foreground">
          Your email and phone are used to sign in and cannot be changed here.
        </p>
        
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            disabled
            className="w-full px-4 py-3 rounded-lg border bg-muted text-muted-foreground cursor-not-allowed"
            data-testid="input-email"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            disabled
            className="w-full px-4 py-3 rounded-lg border bg-muted text-muted-foreground cursor-not-allowed"
            data-testid="input-phone"
          />
        </div>
      </div>
      
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          data-testid="button-save"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <a
          href="/account"
          className="px-6 py-3 border rounded-lg font-medium hover:bg-muted transition"
          data-testid="link-cancel"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
