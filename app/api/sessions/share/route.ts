import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, makePublic, external_user_id } = await req.json();
    if (!sessionId || typeof makePublic !== 'boolean' || !external_user_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // map external_user_id -> users.id
    const { data: owner } = await admin
      .from('users')
      .select('id')
      .eq('external_user_id', external_user_id)
      .single();

    if (!owner) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // ensure the session belongs to this user
    const { data: sess } = await admin
      .from('interview_sessions')
      .select('id, user_id, public_slug')
      .eq('id', sessionId)
      .single();

    if (!sess || sess.user_id !== owner.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let slug: string | null = sess.public_slug ?? null;

    if (makePublic) {
      if (!slug) slug = randomBytes(6).toString('hex');
    } else {
      slug = null;
    }

    const { error: uErr } = await admin
      .from('interview_sessions')
      .update({ public_slug: slug })
      .eq('id', sessionId);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
    return NextResponse.json({ slug, url: slug ? `${base}/p/${slug}` : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
