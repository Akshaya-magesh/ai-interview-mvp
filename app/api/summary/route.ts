import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { chatCompletion } from '@/lib/openai';

const MOCK_SUMMARY =
  'Summary (mock): You completed the interview. Strengths: structure, clarity. Improve: quantify outcomes, deepen role-specific examples. Next: prepare 2–3 STAR stories with metrics.';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const admin = supabaseAdmin();

    // Load messages for transcript
    const { data: msgs, error: mErr } = await admin
      .from('messages')
      .select('role, content, ts')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const transcript = (msgs ?? [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `Summarize the interview in under 200 words. Provide:
- Two strengths
- Two weaknesses
- Three practical improvement tips
- Rewrite one weak answer in a stronger form

Transcript:
${transcript}`;

    let content = MOCK_SUMMARY;

    // Real model if you have credit and MOCK_AI !== 'true'
    if (process.env.MOCK_AI !== 'true') {
      try {
        content = await chatCompletion([
          { role: 'system', content: 'You are a concise interview coach.' },
          { role: 'user', content: prompt },
        ]);
      } catch {
        // keep mock content
      }
    }

    const { error: uErr } = await admin
      .from('interview_sessions')
      .update({ feedback_summary: content })
      .eq('id', sessionId);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, feedback_summary: content });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
