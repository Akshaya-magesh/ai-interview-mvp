import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { chatCompletion } from '@/lib/openai';
import { getRatelimit } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/ip';
import {
  SYSTEM_BASE,
  PERSONA,
  companyRoleBlock,
  FIRST_USER,
  NEXT_USER,
  type PersonaKey,
} from '@/lib/prompts';

const FALLBACK_QUESTIONS: Record<PersonaKey, string[]> = {
  HR: [
    'Tell me about a time you had to handle a tight deadline. What was the situation and result?',
    'Describe a conflict with a teammate and how you resolved it.',
    'What accomplishment are you most proud of and why?',
  ],
  Technical: [
    'Walk me through a recent system you designed. What were the key trade-offs?',
    'Describe a tough bug you debugged. How did you isolate the root cause?',
    'How would you design a rate limiter for a public API?',
  ],
  Manager: [
    'Tell me about a time you aligned stakeholders with conflicting priorities.',
    'Describe how you handle underperformance on your team.',
    'How do you set goals and measure success for a new initiative?',
  ],
  Mentor: [
    'Reflect on a recent challenge you faced. What options did you consider, and what did you learn?',
    'Tell me about a time feedback changed your approach. What would you do differently now?',
    'Describe a decision you agonized over. How did you weigh trade-offs, and what was the outcome?',
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: session, error: serr } = await admin
      .from('interview_sessions')
      .select('id, persona, question_count, role_profile_json, company_name, role_title')
      .eq('id', sessionId)
      .single();

    if (serr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const currentCount = session.question_count ?? 0;
    if (currentCount >= 8) {
      return NextResponse.json({ error: 'Max questions reached' }, { status: 400 });
    }

    // Resolve persona safely (DB constraint currently: 'HR' | 'Technical' | 'Manager'; code supports 'Mentor' too)
    const personaKey: PersonaKey =
      (['HR', 'Technical', 'Manager', 'Mentor'] as PersonaKey[]).includes(
        session.persona as PersonaKey
      )
        ? (session.persona as PersonaKey)
        : 'HR';

    const { data: msgs } = await admin
      .from('messages')
      .select('role, content, ts')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });

    const history =
      (msgs ?? []).slice(-8).map((m) => ({
        role: m.role === 'interviewer' ? 'assistant' : 'user',
        content: m.content,
      })) ?? [];

    const rp = session.role_profile_json || {};
    const ctx = {
      company: session.company_name ?? null,
      role: session.role_title ?? null,
      competencies: rp?.competencies ?? [],
      skillsKeywords: rp?.skillsKeywords ?? [],
      style: rp?.communicationStyleHint ?? null,
    };

    const ip = await getClientIp();
    const { success } = await getRatelimit()!.limit(`messages:${ip}`);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }

    const sys = [SYSTEM_BASE, PERSONA[personaKey] ?? PERSONA.HR, companyRoleBlock(ctx)].join('\n\n');

    const firstTurn = currentCount === 0;

    let question = '';
    const useMock = process.env.MOCK_AI === 'true';

    if (useMock) {
      const bank = FALLBACK_QUESTIONS[personaKey] ?? FALLBACK_QUESTIONS.HR;
      const idx = Math.min(currentCount, bank.length - 1);
      question = bank[idx] ?? bank[0];
    } else {
      // Try OpenAI, fallback to canned question on failure
      try {
        const content = await chatCompletion([
          { role: 'system', content: sys },
          ...history,
          { role: 'user', content: firstTurn ? FIRST_USER : NEXT_USER },
        ]);
        question = (content || '').trim();
      } catch {
        const bank = FALLBACK_QUESTIONS[personaKey] ?? FALLBACK_QUESTIONS.HR;
        const idx = Math.min(currentCount, bank.length - 1);
        question = bank[idx] ?? bank[0];
      }
    }

    // Save interviewer message and increment count
    const { error: iErr } = await admin.from('messages').insert({
      session_id: sessionId,
      role: 'interviewer',
      content: question || 'Let’s start: tell me about a recent challenge and what you did.',
    });
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    const { error: uErr } = await admin
      .from('interview_sessions')
      .update({ question_count: currentCount + 1 })
      .eq('id', sessionId);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ message: { role: 'interviewer', content: question } });
  } catch (e: any) {
    // last-ditch, keep UX moving
    return NextResponse.json({
      message: { role: 'interviewer', content: 'Tell me about a recent challenge and what you did.' },
    });
  }
}
