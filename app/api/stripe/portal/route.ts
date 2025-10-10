import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // You need the current user; we’ll look them up by the auth header Vercel adds for SSR-less APIs.
    // If you prefer, pass external_user_id in body like checkout does.
    // Here we keep it simple: require an authenticated user via your existing session cookie.
    // Map cookie -> users row via a lightweight query param is overkill; instead:
    // Suggestion: call this from a client component after supabase.auth.getUser, POST no body, and
    // look up by email or a server-stored stripe_customer_id.

    // For safety, we fallback to email lookup if customer_id is missing.
    const admin = supabaseAdmin();
    // This endpoint assumes you call it only when a user is logged in client-side.
    // Get their Supabase user from your users table using RLS is not possible here (service role).
    // So: pass their email in a header? Simpler—look it up by stripe_customer_id in DB first:
    // In production, you'd send external_user_id in the POST. We'll accept both.

    let external_user_id: string | undefined;
    try {
      const json = await _req.json();
      external_user_id = json?.external_user_id;
    } catch { /* no body is fine */ }

    if (!external_user_id) {
      return NextResponse.json({ error: 'Missing external_user_id' }, { status: 400 });
    }

    const { data: u } = await admin
      .from('users')
      .select('email, stripe_customer_id')
      .eq('external_user_id', external_user_id)
      .single();

    if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let customerId = u.stripe_customer_id as string | null;

    // If no saved customer id, try to find via Stripe search by email (best-effort)
    if (!customerId && u.email) {
      const customers = await stripe.customers.list({ email: u.email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    }
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Portal error' }, { status: 500 });
  }
}
