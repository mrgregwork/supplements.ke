import { useState } from "react";

export default function AdminLoginForm() {
  const [step, setStep]       = useState<"email" | "code">("email");
  const [email, setEmail]     = useState("");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setInfo("A 6-digit code has been sent to " + email.trim().toLowerCase());
      setStep("code");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      window.location.href = "/admin";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm" data-testid="text-error">
          {error}
        </div>
      )}
      {info && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          {info}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Admin email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
              required
              autoFocus
              data-testid="input-email"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            data-testid="button-send-code"
          >
            {loading ? "Sending…" : "Send login code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000"
              required
              autoFocus
              data-testid="input-code"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            data-testid="button-verify-code"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setError(""); setInfo(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition py-2"
          >
            ← Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
