'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare } from 'lucide-react';

type Persona = 'HR' | 'Tech' | 'Manager';

type SessionRow = {
  id: string;
  persona: Persona | null;
  created_at: string;
  question_count: number | null;
  company_name: string | null;
  role_title: string | null;
};

export default function DashboardPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<'free' | 'pro' | 'unknown'>('unknown');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      // fetch sessions
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('id, persona, created_at, question_count, company_name, role_title')
        .order('created_at', { ascending: false });

      if (!error) setRows((data as any[]) ?? []);

      // fetch current plan
      const { data: u } = await supabase
        .from('users')
        .select('plan')
        .eq('external_user_id', user.id)
        .single();

      setPlan((u?.plan as 'free' | 'pro' | undefined) ?? 'free');

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-24 bg-zinc-900/40 animate-pulse" />
        ))}
      </div>
    );
  }

  // 🔢 quick stats (no hooks)
  const completed = rows.filter(r => (r.question_count ?? 0) >= 8).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link href="/pricing"><Button variant="secondary">Pricing</Button></Link>
          <Link href="/new"><Button>New Interview</Button></Link>
        </div>
      </div>

      {/* 🔔 Upgrade banner (Free plan) */}
      {plan === 'free' && (
        <Card className="p-4 border-yellow-800 bg-yellow-950/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Free plan limit: 2 interviews / month</div>
              <div className="text-sm text-zinc-400">
                Upgrade to Pro for unlimited interviews, coaching tips, and resume uploads.
              </div>
            </div>
            <Link href="/pricing">
              <Button>See pricing</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* 📊 My Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-zinc-400">Total Sessions</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-zinc-400">Completed</div>
          <div className="text-2xl font-bold">{completed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-zinc-400">Active</div>
          <div className="text-2xl font-bold">{rows.length - completed}</div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <div className="text-zinc-300">No sessions yet.</div>
          <Link href="/new" className="inline-block mt-3">
            <Button>Start your first interview</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((r) => {
            const count = r.question_count ?? 0;
            return (
              <Card key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{r.persona ?? 'Unknown'}</Badge>
                    <span className="text-sm text-zinc-400 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">
                    {r.company_name ?? 'Company'} — {r.role_title ?? 'Role'}
                  </div>
                  <div className="text-sm text-zinc-400 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> {count}/8 questions
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/summary/${r.id}`}>
                    <Button variant="secondary">Summary</Button>
                  </Link>
                  <Link href={`/interview/${r.id}`}>
                    <Button>Open</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
