import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/openai';
import { EVALUATOR } from '@/lib/prompts';

const NEUTRAL_EVAL = {
  scores: { relevance: 3, star: 3, specifics: 3, reasoning: 3, clarity: 3, roleFit: 3 },
  overallScore: 3,
  briefFeedback: 'Reasonably clear. Add more specifics, structure with STAR, and highlight measurable impact.',
  improvedAnswer: 'Briefly describe the Situation and Task, your specific Actions, and the Result with metrics. Emphasize trade-offs and role-relevant skills.',
};

export async function POST(req: NextRequest) {
  try {
    const { question, answer, promptOverride } = await req.json();
    if (!answer) return NextResponse.json({ error: 'Missing answer' }, { status: 400 });

    // ✅ MOCK path
    if (process.env.MOCK_AI === 'true') {
      // If coaching requested, return a fake coaching tip shape
      if (promptOverride) {
        return NextResponse.json({
          eval: { tip: 'Add concrete metrics (%, $, time saved) and close with the specific outcome.' },
        });
      }
      // Otherwise return normal neutral eval
      return NextResponse.json({ eval: NEUTRAL_EVAL });
    }

    // Real model path
    const system = 'You return only JSON.';
    const user =
      (promptOverride ?? EVALUATOR) +
      `\n\nQuestion:\n${question ?? '(not provided)'}\n\nAnswer:\n${answer}`;

    const content = await chatCompletion([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    let json: any = {};
    try {
      json = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { json = JSON.parse(m[0]); } catch {}
      }
    }

    return NextResponse.json({ eval: json && Object.keys(json).length ? json : NEUTRAL_EVAL });
  } catch {
    return NextResponse.json({ eval: NEUTRAL_EVAL });
  }
}
