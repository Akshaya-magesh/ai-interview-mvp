'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';

export default function Leaderboard() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<{ email: string; completed: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('leaderboard_simple');
      if (!error) setRows(data ?? []);
    })();
  }, [supabase]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Card className="p-4">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-400">No data yet.</div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="flex justify-between py-1">
              <div className="font-medium">{i + 1}. {r.email}</div>
              <div className="text-zinc-400">{r.completed} completed</div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
