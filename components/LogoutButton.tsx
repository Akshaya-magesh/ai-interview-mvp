'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export function LogoutButton() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  async function onLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onLogout}
      aria-label="Logout"
    >
      <LogOut className="h-4 w-4 mr-1" />
      Logout
    </Button>
  );
}
