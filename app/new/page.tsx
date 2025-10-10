'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { z } from 'zod';
import UserSync from '@/components/UserSync';

const Persona = z.enum(['HR', 'Technical', 'Manager']);

export default function NewInterviewPage() {
  const supabase = supabaseBrowser();
  const [persona, setPersona] = useState<'HR' | 'Technical' | 'Manager' | null>(null);
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [jd, setJd] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
  if (!persona) return alert('Pick a persona');
  console.log('[start] clicked', { persona, company, roleTitle, jdLen: jd.length });
  setBusy(true);

  // 1) who is logged in?
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[start] user', user?.id);
  if (!user) {
    setBusy(false);
    alert('Please log in again');
    return;
  }

  // 2) Optional JD extraction — non-blocking
  let roleProfileJSON: any = null;
  if (jd.trim()) {
    console.log('[start] calling /api/jd/extract…');
    try {
      const resp = await fetch('/api/jd/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });
      console.log('[start] /api/jd/extract status', resp.status);
      if (resp.ok) {
        roleProfileJSON = await resp.json();
      } else {
        console.warn('JD extract failed', resp.status);
      }
    } catch (err) {
      console.warn('JD extract threw', err);
    }
  }

  // 3) Create session (Pattern 1: send external_user_id)
  console.log('[start] calling /api/sessions…');
  try {
    const resp2 = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona,
        company_name: company || null,
        role_title: roleTitle || null,
        role_profile_json: roleProfileJSON,
        external_user_id: user.id, // IMPORTANT
      }),
    });

    console.log('[start] /api/sessions status', resp2.status);
    let data2: any = {};
    try { data2 = await resp2.json(); } catch { /* ignore parse error for non-200 */ }
    console.log('[start] /api/sessions resp', data2);

    setBusy(false);

    if (!resp2.ok || !data2?.id) {
      alert(data2?.error || 'Could not create session');
      return;
    }

    // 4) Go to the interview
    window.location.href = `/interview/${data2.id}`;
  } catch (err) {
    setBusy(false);
    console.error('[start] sessions error', err);
    alert('Network error creating session');
  }
};



  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <UserSync />
      <h1 className="text-2xl font-bold">New Interview</h1>
      <div className="grid grid-cols-3 gap-3">
        {(['HR','Technical','Manager'] as const).map(p => (
          <button key={p}
            onClick={() => setPersona(p)}
            className={`rounded border p-3 ${persona===p?'border-black':'border-gray-300'}`}>
            <div className="font-semibold">{p}</div>
            <div className="text-sm text-gray-500">
              {p==='HR' && 'Behavioral, STAR'}
              {p==='Technical' && 'Problem solving, design'}
              {p==='Manager' && 'Leadership, stakeholders'}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <input className="border rounded p-2" placeholder="Company (optional)" value={company} onChange={(e)=>setCompany(e.target.value)} />
        <input className="border rounded p-2" placeholder="Role title (optional)" value={roleTitle} onChange={(e)=>setRoleTitle(e.target.value)} />
        <textarea className="border rounded p-2" rows={6} placeholder="Paste job description (optional)" value={jd} onChange={(e)=>setJd(e.target.value)} />
      </div>

      <button disabled={busy} onClick={start} className="rounded bg-black text-white px-3 py-2">
        {busy? 'Starting...' : 'Start interview'}
      </button>
    </div>
  );
}
