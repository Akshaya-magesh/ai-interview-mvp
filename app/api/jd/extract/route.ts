import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/openai';
import { JD_EXTRACTOR } from '@/lib/prompts';

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();
    if (!jobDescription?.trim()) {
      // empty JD is allowed — return minimal shape
      return NextResponse.json({ competencies: [], skillsKeywords: [], responsibilities: [], communicationStyleHint: '' });
    }

    const prompt = `${JD_EXTRACTOR}\n\n---\n${jobDescription}`;
    const content = await chatCompletion([
      { role: 'system', content: 'You extract concise JSON only.' },
      { role: 'user', content: prompt }
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

    // Always return a predictable shape
    return NextResponse.json({
      competencies: json.competencies ?? [],
      skillsKeywords: json.skillsKeywords ?? [],
      responsibilities: json.responsibilities ?? [],
      communicationStyleHint: json.communicationStyleHint ?? ''
    });
  } catch (e: any) {
    // Log the upstream error for debugging but don't break the user flow
    console.error('JD extract error:', e?.message || e);
    return NextResponse.json({
      competencies: [],
      skillsKeywords: [],
      responsibilities: [],
      communicationStyleHint: ''
    }, { status: 200 }); // <-- return OK with empty profile so UX continues
  }
}
