'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type ProfileForm = {
  name: string;
  title: string;
  linkedin: string;
};

export default function ProfilePage() {
  const supabase = supabaseBrowser();

  const [form, setForm] = useState<ProfileForm>({ name: '', title: '', linkedin: '' });
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        toast.error(userErr.message);
        return;
      }
      if (!user) { window.location.href = '/login'; return; }

      const { data, error } = await supabase
        .from('users')
        .select('name,title,linkedin')
        .eq('external_user_id', user.id)
        .single();

      if (error) {
        // if no row yet, /api/user/sync should create it on login
        console.warn('users row missing, run /api/user/sync on login');
      }

      setForm({
        name: data?.name ?? '',
        title: data?.title ?? '',
        linkedin: data?.linkedin ?? '',
      });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); window.location.href = '/login'; return; }

    const { error } = await supabase
      .from('users')
      .update(form)
      .eq('external_user_id', user.id);

    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Profile saved');
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }

    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from('resumes')
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });

    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('resumes')
      .createSignedUrl(path, 60 * 60); // 1 hour

    setUploading(false);
    if (signErr) {
      toast.error(signErr.message);
      return;
    }

    setResumeUrl(signed?.signedUrl ?? '');
    toast.success('Resume uploaded');
  }

  if (loading) return <Card className="p-6">Loading…</Card>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card className="p-6 grid gap-4 max-w-xl">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="title">Job Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Data Scientist"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="linkedin">LinkedIn URL</Label>
          <Input
            id="linkedin"
            value={form.linkedin}
            onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))}
            placeholder="https://www.linkedin.com/in/you"
          />
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Card>

      <Card className="p-6 max-w-xl grid gap-3">
        <div className="font-medium">Resume</div>
        <Input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={onUpload}
          disabled={uploading}
        />
        {resumeUrl && (
          <a className="underline text-sm" href={resumeUrl} target="_blank" rel="noreferrer">
            View uploaded resume (temp link)
          </a>
        )}
        <p className="text-xs text-zinc-400">
          Your file is private. Links expire automatically for security.
        </p>
      </Card>
    </div>
  );
}
