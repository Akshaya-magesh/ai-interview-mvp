// app/api/user/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { email, external_user_id } = await req.json();
    if (!email || !external_user_id) {
      return NextResponse.json({ error: 'Missing email or external_user_id' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin
      .from('users')
      .upsert({ email, external_user_id }, { onConflict: 'email' });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
