'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();

      // For magic links / OTP: Supabase JS will read the URL fragment and set the session.
      // For OAuth / PKCE: exchange the code explicitly (safe to call; it'll no-op if not needed).
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch {
        // ignore; magic-link flows won't need this
      }

      router.replace('/dashboard');
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Signing you in…</h1>
        <p className="text-gray-600">Please wait a moment.</p>
      </div>
    </div>
  );
}
