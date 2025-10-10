'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const supabase = supabaseBrowser();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` }
    });
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {sent ? (
          <p>Check your email for a magic link.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              className="w-full border rounded p-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="w-full rounded bg-black text-white py-2">
              Send magic link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
