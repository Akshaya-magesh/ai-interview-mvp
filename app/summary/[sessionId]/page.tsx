'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Point = { idx: number; score: number };

export default function SummaryPage() {
  const pathname = usePathname();
  const sessionId = pathname.split('/').pop() || '';
  const supabase = supabaseBrowser();

  const [summary, setSummary] = useState('');
  const [series, setSeries] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  // sharing state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      // fetch summary + messages series
      const [{ data: sess }, { data: msgs }] = await Promise.all([
        supabase
          .from('interview_sessions')
          .select('feedback_summary, public_slug')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('messages')
          .select('role, eval_json')
          .eq('session_id', sessionId)
          .order('ts', { ascending: true }),
      ]);

      setSummary((sess as any)?.feedback_summary ?? '');

      // if already shared, prebuild public URL
      const slug = (sess as any)?.public_slug as string | null | undefined;
      if (slug) {
        const origin =
          typeof window !== 'undefined' ? window.location.origin : '';
        setShareUrl(`${origin}/p/${slug}`);
      } else {
        setShareUrl(null);
      }

      const points =
        (msgs ?? [])
          .filter(
            (m: any) => m.role === 'candidate' && m.eval_json?.overallScore
          )
          .map((_: any, i: number) => ({
            idx: i + 1,
            score: (msgs as any[])[i * 2]?.eval_json?.overallScore ?? 0, // best effort
          })) || [];

      // better mapping: strictly map by candidate-only order
      const candPoints =
        (msgs ?? [])
          .filter((m: any) => m.role === 'candidate')
          .map((m: any, i: number) => ({
            idx: i + 1,
            score: m.eval_json?.overallScore ?? 0,
          })) || [];

      setSeries(candPoints.length ? candPoints : points);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleShare = async (makePublic: boolean) => {
    if (!sessionId || shareLoading) return;
    setShareLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in');
        return;
      }

      const res = await fetch('/api/sessions/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          makePublic,
          external_user_id: user.id,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error || 'Failed to update sharing');
        return;
      }

      if (j?.url) {
        setShareUrl(j.url);
        // copy link to clipboard for a nice UX
        try {
          await navigator.clipboard.writeText(j.url);
          toast.success('Public link enabled — copied!');
        } catch {
          toast.success('Public link enabled');
        }
      } else {
        setShareUrl(null);
        toast.success('Public link disabled');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Share failed');
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Summary</h1>

        <div className="flex items-center gap-2">
          {shareUrl ? (
            <>
              <Button
                variant="secondary"
                disabled={shareLoading}
                onClick={() => toggleShare(false)}
                title="Disable public link"
              >
                {shareLoading ? 'Updating…' : 'Disable Share'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!shareUrl) return;
                  navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => toast.success('Link copied'))
                    .catch(() => toast.error('Copy failed'));
                }}
              >
                Copy Link
              </Button>
            </>
          ) : (
            <Button
              onClick={() => toggleShare(true)}
              disabled={shareLoading}
              title="Create a public link to share this summary"
            >
              {shareLoading ? 'Enabling…' : 'Share public link'}
            </Button>
          )}

          <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        </div>
      </div>

      <Card className="p-4">
        {loading ? (
          'Generating summary…'
        ) : summary ? (
          <pre className="whitespace-pre-wrap">{summary}</pre>
        ) : (
          'No summary yet.'
        )}
      </Card>

      <Card className="p-4">
        <div className="font-medium mb-2">Answer Scores Over Time</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="idx" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {shareUrl && (
        <Card className="p-3 text-sm text-zinc-400">
          Public link:&nbsp;
          <a
            className="underline"
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
          >
            {shareUrl}
          </a>
        </Card>
      )}
    </div>
  );
}
