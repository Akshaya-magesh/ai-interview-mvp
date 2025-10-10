'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
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

export default function PublicSummary() {
  const slug = usePathname().split('/').pop()!;
  const supabase = supabaseBrowser();

  const [summary, setSummary] = useState<string | null>(null);
  const [rawMsgs, setRawMsgs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Delay mounting the chart until layout is stable (prevents animation loop)
  const [chartReady, setChartReady] = useState(false);
  const readyOnce = useRef(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // 1) get the session by slug
      const { data: sess, error: sErr } = await supabase
        .from('interview_sessions')
        .select('id, feedback_summary')
        .eq('public_slug', slug)
        .maybeSingle();

      if (sErr || !sess) {
        setSummary(null);
        setRawMsgs([]);
        setLoading(false);
        return;
      }

      setSummary((sess as any)?.feedback_summary ?? '');

      // 2) fetch ordered messages (candidate scores)
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, eval_json')
        .eq('session_id', (sess as any).id)
        .order('ts', { ascending: true });

      setRawMsgs(msgs ?? []);
      setLoading(false);

      // let layout settle, then allow chart mount (next frame + small delay)
      if (!readyOnce.current) {
        readyOnce.current = true;
        requestAnimationFrame(() => {
          setTimeout(() => setChartReady(true), 60);
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Stable, memoized series so object identity doesn't change each render
  const series: Point[] = useMemo(() => {
    if (!rawMsgs) return [];
    const pts: Point[] = [];
    for (const m of rawMsgs) {
      if (m.role !== 'candidate') continue;
      const val = Number(m?.eval_json?.overallScore);
      if (Number.isFinite(val)) pts.push({ idx: pts.length + 1, score: val });
    }
    return pts;
  }, [rawMsgs]);

  const notFound = !loading && summary == null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Shared Summary</h1>

      <Card className="p-4">
        {loading ? (
          'Loading…'
        ) : notFound ? (
          'Not found or not shared.'
        ) : (
          <pre className="whitespace-pre-wrap">{summary}</pre>
        )}
      </Card>

      {!notFound && (
        <Card className="p-4">
          <div className="font-medium mb-2">Answer Scores Over Time</div>

          {/* Give the chart a stable, fixed-height container to avoid resize thrash */}
          <div className="h-64 w-full">
            {chartReady && series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis domain={[0, 5]} allowDecimals tickCount={6} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              // lightweight skeleton to avoid zero-height mount
              <div className="h-full w-full animate-pulse rounded bg-zinc-900/40" />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
