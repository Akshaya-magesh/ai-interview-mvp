import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headers } from 'next/headers';
import { COACHING_EVAL } from '@/lib/prompts';
import { getRatelimit } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/ip';

// Build an absolute origin for server-side fetches
async function getBaseUrl() {
  // 1) Prefer explicit env if you set it in Vercel/dev
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;

  // 2) Derive from request headers (works on localhost and Vercel)
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, content, external_user_id, coaching } = await req.json();

    if (!sessionId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing sessionId or content' }, { status: 400 });
    }
    if (!external_user_id) {
      return NextResponse.json({ error: 'Missing external_user_id' }, { status: 401 });
    }

    const ip = await getClientIp();
    const { success } = await getRatelimit()!.limit(`messages:${ip}`);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }

    const admin = supabaseAdmin();

    // Map external_user_id -> owner user row
    const { data: owner, error: ownerErr } = await admin
      .from('users')
      .select('id, external_user_id')
      .eq('external_user_id', external_user_id)
      .single();

    if (ownerErr || !owner) {
      return NextResponse.json(
        { error: 'User row not found. Visit /dashboard once so UserSync runs.' },
        { status: 400 }
      );
    }

    // Verify session belongs to this user
    const { data: session } = await admin
      .from('interview_sessions')
      .select('id, user_id, question_count')
      .eq('id', sessionId)
      .single();

    if (!session || session.user_id !== owner.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Save candidate message
    const { data: msg, error: mErr } = await admin
      .from('messages')
      .insert({ session_id: sessionId, role: 'candidate', content })
      .select('id')
      .single();
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const base = await getBaseUrl();

    // Best-effort evaluate the answer
    let evalJson: any = null;
    try {
      const r = await fetch(`${base}/api/eval/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: '', answer: content }),
      });
      if (r.ok) {
        const j = await r.json();
        evalJson = j.eval ?? null;
        await admin.from('messages').update({ eval_json: evalJson }).eq('id', msg.id);
      }
    } catch {
      /* ignore eval failure */
    }

    // Optional: coaching tip (inserted as an interviewer message before next Q)
    if (coaching) {
      try {
        const r = await fetch(`${base}/api/eval/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: 'COACHING',
            answer: content,
            promptOverride: COACHING_EVAL,
          }),
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          const tip = j?.eval?.tip;
          if (tip) {
            await admin
              .from('messages')
              .insert({ session_id: sessionId, role: 'interviewer', content: `Coach: ${tip}` });
          }
        }
      } catch {
        /* ignore coaching failure */
      }
    }

    // Ask next interviewer question
    const r2 = await fetch(`${base}/api/chat/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!r2.ok) {
      // Gracefully stop at 8
      if (r2.status === 400) {
        const j = await r2.json().catch(() => ({}));
        if (j?.error === 'Max questions reached') {
          return NextResponse.json({ ok: true, ended: true, eval_json: evalJson });
        }
      }
      const err = await r2.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error || 'Failed generating next question' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, eval_json: evalJson });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
