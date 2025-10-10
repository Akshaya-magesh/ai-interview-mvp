'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { upgradeToPro, openBillingPortal } from '@/lib/upgrade';

type Plan = 'free' | 'pro' | string;

export default function PricingPage() {
  const supabase = supabaseBrowser();
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data, error } = await supabase
        .from('users')
        .select('plan')
        .eq('external_user_id', user.id)
        .single();
      if (error) toast.error(error.message);
      setPlan((data?.plan as Plan) ?? 'free');
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpgrade = async () => {
    try {
      await upgradeToPro();
    } catch (e: any) {
      toast.error(e?.message ?? 'Upgrade failed');
    }
  };

  const onManageBilling = async () => {
    try {
      // open Stripe Billing Portal for current user
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not signed in'); return; }
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_user_id: user.id }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url as string;
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not open billing portal');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <Card className="p-6 border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xl font-semibold">Free</div>
            {plan === 'free' && <Badge variant="secondary">Current</Badge>}
          </div>
          <div className="text-3xl font-bold mb-4">$0<span className="text-base text-zinc-400"> /mo</span></div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> 2 interviews / month</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Basic summaries</li>
            <li className="flex items-center gap-2"><X className="h-4 w-4" /> Resume upload</li>
            <li className="flex items-center gap-2"><X className="h-4 w-4" /> Real-time coaching tips</li>
          </ul>
          <Button className="mt-6" variant="secondary" disabled={plan === 'free' ? false : true}>
            {plan === 'free' ? 'Free plan' : 'Not available'}
          </Button>
        </Card>

        {/* Pro */}
        <Card className="p-6 border-zinc-800">
          <div className="text-xl font-semibold mb-2">Pro</div>
          <div className="text-3xl font-bold mb-1">$10<span className="text-base text-zinc-400"> /mo</span></div>
          <div className="text-sm text-zinc-400 mb-4">Unlimited interviews + resume analysis</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Unlimited interviews</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Coaching tips (Mentor)</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Resume upload + parsing</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Priority AI generation</li>
          </ul>

          {loading ? (
            <Button className="mt-6" disabled>Loading…</Button>
          ) : plan === 'pro' ? (
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" disabled>You're Pro</Button>
              <Button onClick={onManageBilling}>Manage billing</Button>
            </div>
          ) : (
            <Button className="mt-6" onClick={onUpgrade}>Upgrade to Pro</Button>
          )}
        </Card>
      </div>

      <Card className="p-4 text-sm text-zinc-400">
        Payments are processed securely by Stripe. You can cancel anytime.
      </Card>
    </div>
  );
}
