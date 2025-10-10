import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UpdateFields = {
  plan?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_status?: string | null;
  monthly_reset_at?: string;
  monthly_interviews_used?: number;
};

async function updateUserByExternalOrEmail(
  external_user_id: string | null | undefined,
  email: string | null | undefined,
  fields: {
    plan?: string;
    stripe_customer_id?: string | null;
    stripe_subscription_status?: string | null;
    monthly_reset_at?: string;
    monthly_interviews_used?: number;
  }
) {
  const admin = supabaseAdmin();

  // 1) Try by external_user_id
  if (external_user_id) {
    const { data, error } = await admin
      .from('users')
      .update(fields)
      .eq('external_user_id', external_user_id)
      .select('id'); // <- no options arg here in v2

    if (error) {
      console.error('[webhook] update by external_user_id failed:', error.message);
    } else if (data && data.length > 0) {
      return true; // updated at least one row
    }
  }

  // 2) Fallback: match by email (exact match; your users.email is unique)
  if (email) {
    const { data: u, error: e1 } = await admin
      .from('users')
      .select('external_user_id')
      .eq('email', email)   // use eq; ilike can be noisy and not needed for emails
      .single();

    if (e1) {
      console.error('[webhook] lookup by email failed:', e1.message);
      return false;
    }

    if (u?.external_user_id) {
      const { data, error: e2 } = await admin
        .from('users')
        .update(fields)
        .eq('external_user_id', u.external_user_id)
        .select('id'); // <- no options arg

      if (e2) {
        console.error('[webhook] update by email->external_user_id failed:', e2.message);
        return false;
      }
      return !!(data && data.length > 0);
    }

    console.warn('[webhook] no user matched by email:', email);
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sig = req.headers.get('stripe-signature')!;
    const raw = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (e: any) {
      console.error('[webhook] signature verify fail:', e.message);
      return NextResponse.json({ error: 'bad signature' }, { status: 400 });
    }

    console.log('[webhook] event:', event.type);

    // Helper to pull sub/customer + email robustly
    const resolveEmailAndCustomer = async (session?: Stripe.Checkout.Session, sub?: Stripe.Subscription | null) => {
      let customerId: string | null = null;
      let email: string | null = null;

      if (session?.customer && typeof session.customer === 'string') {
        customerId = session.customer;
      } else if (sub && typeof sub.customer === 'string') {
        customerId = sub.customer;
      } else if (sub && typeof sub.customer !== 'string') {
        customerId = sub.customer.id;
      }

      email = session?.customer_details?.email ?? null;

      if (!email && customerId) {
        const cust = await stripe.customers.retrieve(customerId);
        if (!('deleted' in cust)) email = cust.email ?? null;
      }

      return { customerId, email };
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;

        // metadata path #1
        let external_user_id = (s.metadata?.external_user_id as string | undefined) ?? undefined;

        // get sub for more metadata if needed
        let sub: Stripe.Subscription | null = null;
        if (s.subscription) {
          const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
          sub = await stripe.subscriptions.retrieve(subId);
          // metadata path #2
          if (!external_user_id) external_user_id = sub.metadata?.external_user_id;
        }

        const { customerId, email } = await resolveEmailAndCustomer(s, sub);
        console.log('[webhook] mapped checkout.session.completed:', { external_user_id, email, customerId });

        const ok = await updateUserByExternalOrEmail(external_user_id, email, {
          plan: 'pro',
          stripe_customer_id: customerId,
          stripe_subscription_status: sub?.status ?? 'active',
          monthly_reset_at: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          monthly_interviews_used: 0,
        });

        if (!ok) console.warn('[webhook] no user updated for checkout.session.completed');

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const external_user_id = sub.metadata?.external_user_id ?? null;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        // fallback email if no metadata
        let email: string | null = null;
        if (!external_user_id) {
          const cust = await stripe.customers.retrieve(customerId);
          if (!('deleted' in cust)) email = cust.email ?? null;
        }

        console.log('[webhook] mapped sub change:', { external_user_id, email, customerId, status: sub.status });

        const ok = await updateUserByExternalOrEmail(external_user_id, email, {
          plan: sub.status === 'active' || sub.status === 'trialing' ? 'pro' : 'free',
          stripe_customer_id: customerId,
          stripe_subscription_status: sub.status,
        });

        if (!ok) console.warn('[webhook] no user updated for subscription change');

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const external_user_id = sub.metadata?.external_user_id ?? null;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        let email: string | null = null;
        if (!external_user_id) {
          const cust = await stripe.customers.retrieve(customerId);
          if (!('deleted' in cust)) email = cust.email ?? null;
        }

        console.log('[webhook] mapped sub deleted:', { external_user_id, email, customerId });

        const ok = await updateUserByExternalOrEmail(external_user_id, email, {
          plan: 'free',
          stripe_customer_id: customerId,
          stripe_subscription_status: sub.status,
        });

        if (!ok) console.warn('[webhook] no user updated for subscription deleted');

        break;
      }

      default:
        // ignore others
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[webhook] fatal:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Webhook error' }, { status: 500 });
  }
}
