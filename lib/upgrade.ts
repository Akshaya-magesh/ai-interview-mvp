'use client';
import { supabaseBrowser } from '@/lib/supabaseClient';

export async function upgradeToPro() {
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not signed in');

  const r = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_user_id: user.id, email: user.email }),
  });
  const { url, error } = await r.json();
  if (error) throw new Error(error);
  window.location.href = url as string;
}

export async function openBillingPortal() {
  const r = await fetch('/api/stripe/portal', { method: 'POST' });
  const { url, error } = await r.json();
  if (error) throw new Error(error);
  window.location.href = url as string;
}
