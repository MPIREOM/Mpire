'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Surface a helpful message when Supabase rejects the API key
      if (error.message?.toLowerCase().includes('invalid api key')) {
        setError(
          'Supabase connection failed (Invalid API key). ' +
          'The project may be paused — check your Supabase dashboard. ' +
          'Or verify your NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.'
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push('/operations');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ── Brand panel ── */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-[#0b0b0c] p-12 text-white lg:flex">
        <div className="font-display flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-[20px] font-bold leading-none text-black">
            M
          </span>
          <span className="text-[17px] font-semibold tracking-[0.18em]">MPIRE</span>
        </div>

        <div>
          <p className="eyebrow text-white/40">Command Center</p>
          <h1 className="text-display mt-5 text-6xl text-white">
            Run the
            <br />
            <span className="text-accent">operation.</span>
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/55">
            Outcomes, risks, and team performance — every project and task in one command center.
          </p>
        </div>

        <p className="text-xs tracking-wide text-white/25">© MPIRE Group</p>
      </div>

      {/* ── Form ── */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="font-display mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-[20px] font-bold leading-none text-black">
              M
            </span>
            <span className="text-[17px] font-semibold tracking-[0.18em] text-text">MPIRE</span>
          </div>

          <p className="eyebrow">Welcome back</p>
          <h2 className="text-display mt-2 text-4xl text-text">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Enter your credentials to continue.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-text transition-colors placeholder:text-faint focus:border-accent focus:outline-none"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-text transition-colors placeholder:text-faint focus:border-accent focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red/20 bg-red-bg px-3 py-2.5 text-xs font-medium text-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
