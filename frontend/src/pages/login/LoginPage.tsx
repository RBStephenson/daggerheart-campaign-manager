import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ username: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? `/${user.role}`;
    return <Navigate to={from} replace />;
  }

  const usernameError = touched.username && !username.trim() ? 'Username is required.' : null;
  const passwordError = touched.password && !password ? 'Password is required.' : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ username: true, password: true });
    if (!username.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? 'Invalid username or password.' : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Login"
      className="relative left-1/2 -mt-6 -mb-6 flex min-h-[70vh] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden bg-void px-4 py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-ember/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-arcane/15 blur-[120px]"
      />

      <h1 className="sr-only">Login</h1>
      <div aria-hidden className="relative mb-8 text-center">
        <p className="font-display text-2xl tracking-[0.2em] text-parchment/90">DAGGERHEART</p>
        <p className="mt-1 text-xs tracking-[0.3em] text-parchment/40 uppercase">
          Campaign Manager
        </p>
      </div>

      <div className="relative w-full max-w-[380px] rounded-[14px] border border-hairline/15 bg-nightshade/70 p-6 shadow-2xl shadow-black/50">
        <h2 className="mb-5 text-center font-display text-lg text-parchment">Enter the Realm</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-parchment/60 uppercase">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              aria-invalid={usernameError ? true : undefined}
              className={`w-full rounded-md border bg-input-dark px-3 py-2 text-sm normal-case text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember ${
                usernameError ? 'border-danger' : 'border-hairline/20'
              }`}
              placeholder="your name"
            />
            {usernameError && <span className="text-xs font-normal normal-case text-danger-text">{usernameError}</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-parchment/60 uppercase">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={passwordError ? true : undefined}
              className={`w-full rounded-md border bg-input-dark px-3 py-2 text-sm normal-case text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember ${
                passwordError ? 'border-danger' : 'border-hairline/20'
              }`}
            />
            {passwordError && <span className="text-xs font-normal normal-case text-danger-text">{passwordError}</span>}
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </section>
  );
}
