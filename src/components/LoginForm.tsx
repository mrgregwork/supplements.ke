import { useState } from 'react';

type Step = 'email' | 'otp';

interface LoginFormProps {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo = '/account' }: LoginFormProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send code');
      }

      if (data.devCode) setDevCode(data.devCode);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim().toLowerCase(), code: otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify code');
      }

      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('email');
    setOtpCode('');
    setError(null);
    setDevCode(null);
  };

  if (step === 'otp') {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium mb-1">
            Enter your login code
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            data-testid="input-otp"
          />
        </div>

        {devCode && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 rounded p-3 text-sm">
            <strong>Dev Mode:</strong> Your code is <code className="font-mono bg-yellow-200 dark:bg-yellow-800 px-1 rounded">{devCode}</code>
          </div>
        )}

        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded" data-testid="text-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || otpCode.length !== 6}
          className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-verify"
        >
          {loading ? 'Verifying...' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={goBack}
          className="w-full py-2 px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestOtp} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
          required
          data-testid="input-email"
        />
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded" data-testid="text-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-send-code"
      >
        {loading ? 'Sending...' : 'Send Login Code'}
      </button>
    </form>
  );
}
