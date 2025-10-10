'use client';
import { use, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { toast } from 'sonner';

type Message = {
  id: string;
  role: 'interviewer' | 'candidate';
  content: string;
  ts: string;
  eval_json: any | null;
};

export default function InterviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const supabase = supabaseBrowser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [coaching, setCoaching] = useState(false); // 👈 NEW
  const [qCount, setQCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!user) {
        window.location.href = '/login';
        return;
      }
      const { data, error: qErr } = await supabase
        .from('messages')
        .select('id, role, content, ts, eval_json')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true });
      if (qErr) toast.error(qErr.message);
      setMessages((data as any[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('question_count')
        .eq('id', sessionId)
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setQCount((data as any)?.question_count ?? 0);
    })();
  }, [sessionId, messages.length, supabase]);

  useEffect(() => {
    (async () => {
      if (messages.length > 0) return;
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('session_id', sessionId)
        .limit(1);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data && data.length > 0) return;

      await fetch('/api/chat/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const { data: rows, error: rErr } = await supabase
        .from('messages')
        .select('id, role, content, ts, eval_json')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true });

      if (rErr) toast.error(rErr.message);
      setMessages((rows as any[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // TTS for interviewer messages
  useEffect(() => {
    if (!ttsOn || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'interviewer') {
      const u = new SpeechSynthesisUtterance(last.content);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }, [messages, ttsOn]);

  const refreshMessages = async () => {
    const { data: rows, error } = await supabase
      .from('messages')
      .select('id, role, content, ts, eval_json')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });
    if (error) toast.error(error.message);
    setMessages((rows as any[]) ?? []);
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    if (qCount >= 8) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in again');
        window.location.href = '/login';
        return;
      }

      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content: input,
          external_user_id: user.id,
          coaching, // 👈 pass the toggle to server
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data?.error || 'Failed to send');
        return;
      }

      setInput('');

      if (data?.ended) {
        // server said we hit 8, show overlay & then go to summary
        setEnding(true);
        setTimeout(() => {
          window.location.href = `/summary/${sessionId}`;
        }, 700);
        return;
      }

      await refreshMessages();
    } finally {
      setBusy(false);
    }
  };

  const endInterview = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data?.error || 'Failed to create summary');
        setEnding(false);
        return;
      }
      // brief overlay so the user sees "Generating..."
      setTimeout(() => {
        window.location.href = `/summary/${sessionId}`;
      }, 700);
    } catch (e: any) {
      toast.error(e?.message ?? 'Summary failed');
      setEnding(false);
    }
  };

  // Auto-generate summary once we reach 8 (only once)
  const didEndRef = useRef(false);
  useEffect(() => {
    if (qCount >= 8 && !didEndRef.current) {
      didEndRef.current = true;
      void endInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qCount]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Mic (Speech-to-Text)
  const [listening, setListening] = useState(false);
  const startSpeechToText = () => {
    const SR: any =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      toast.info('Speech Recognition not supported in this browser.');
      return;
    }

    const recog = new SR();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart = () => setListening(true);
    recog.onend = () => setListening(false);
    recog.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? '';
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    recog.onerror = () => {
      setListening(false);
      toast.error('Could not transcribe. Try again.');
    };

    try {
      recog.start();
    } catch {
      toast.error('Mic permission blocked or already listening.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      {/* Full-screen overlay while generating summary */}
      {ending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 text-white">
          <div className="rounded-2xl bg-black/70 px-6 py-4 shadow-lg">
            Generating summary…
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Interview</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Questions asked: {qCount} / 8</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ttsOn}
              onChange={(e) => setTtsOn(e.target.checked)}
            />
            Voice (AI speaks)
          </label>
          {/* 👇 NEW coaching toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={coaching}
              onChange={(e) => setCoaching(e.target.checked)}
            />
            Coaching tips
          </label>
        </div>
      </div>

      <div className="border rounded p-3 h-[60vh] overflow-y-auto space-y-2 bg-white">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] p-2 rounded ${
              m.role === 'interviewer' ? 'bg-gray-100' : 'bg-blue-100 ml-auto'
            }`}
          >
            <div className="text-xs text-gray-500">{m.role}</div>
            <div>{m.content}</div>
            {m.eval_json && (
              <div className="text-xs text-gray-600 mt-1">
                Overall: {m.eval_json.overallScore} — {m.eval_json.briefFeedback}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {qCount >= 8 ? (
        <div className="flex w-full gap-2">
          <input
            className="flex-1 border rounded p-2 opacity-70"
            value="Interview complete — generating summary…"
            readOnly
            disabled
          />
          <button
            onClick={endInterview}
            disabled={ending}
            className="rounded bg-gray-800 text-white px-3 py-2"
            title="Generate final summary"
          >
            {ending ? 'Generating…' : 'View summary'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your answer..."
            disabled={qCount >= 8}
          />
          <button
            type="button"
            onClick={startSpeechToText}
            title={listening ? 'Listening…' : 'Speak your answer'}
            className={`rounded border px-3 ${listening ? 'opacity-70' : ''}`}
            disabled={qCount >= 8}
          >
            {listening ? '🎙️' : '🎤'}
          </button>
          <button
            disabled={busy || qCount >= 8}
            onClick={send}
            className="rounded bg-black text-white px-3 py-2"
          >
            {busy ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
