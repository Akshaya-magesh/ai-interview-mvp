import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAndConsumeInterview } from '@/lib/billing';
import { getRatelimit } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/ip';

export async function GET() {
  // Not used (browser reads via RLS), kept for completeness
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      persona,
      company_name,
      role_title,
      role_profile_json,
      external_user_id,
    } = body || {};

    if (!persona || !['HR', 'Technical', 'Manager'].includes(persona)) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 });
    }
    if (!external_user_id) {
      return NextResponse.json({ error: 'Missing external_user_id' }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // Map auth user id -> public.users.id
    const { data: urow, error: uErr } = await admin
      .from('users')
      .select('id, external_user_id')
      .eq('external_user_id', external_user_id)
      .single();

    if (uErr || !urow) {
      return NextResponse.json(
        {
          error:
            'User row not found. Visit /dashboard once (UserSync) and try again.',
        },
        { status: 400 }
      );
    }

    const ip = await getClientIp();
    const { success } = await getRatelimit()!.limit(`messages:${ip}`);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }

    // 🔒 Enforce plan limits (free: 2/month). Also resets monthly counters when month changes.
    const gate = await checkAndConsumeInterview(admin, external_user_id);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason ?? 'Over plan limit' },
        { status: 402 }
      );
    }

    // Create the session owned by that user
    const { data: session, error: sErr } = await admin
      .from('interview_sessions')
      .insert({
        user_id: urow.id,
        persona,
        company_name: company_name || null,
        role_title: role_title || null,
        role_profile_json: role_profile_json ?? null,
        question_count: 0,
      })
      .select('id')
      .single();

    if (sErr) throw sErr;

    return NextResponse.json({ id: session!.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
