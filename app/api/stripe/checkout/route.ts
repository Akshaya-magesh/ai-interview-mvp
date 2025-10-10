import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { external_user_id, email } = await req.json();
    if (!external_user_id || !email) {
      return NextResponse.json({ error: 'Missing external_user_id or email' }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (!base) return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL missing' }, { status: 500 });

    // ❌ removed apiVersion to avoid TS literal mismatch
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_PRO!, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { external_user_id },
      },
      metadata: { external_user_id },
      success_url: `${base}/dashboard?upgraded=1`,
      cancel_url: `${base}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Stripe error' }, { status: 500 });
  }
}
