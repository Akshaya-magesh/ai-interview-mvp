'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function UserSync() {
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user?.id) {
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, external_user_id: user.id })
        });
      }
    })();
  }, []);

  return null;
}
