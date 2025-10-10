'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, User, PlusCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/LogoutButton';

type Props = { children: React.ReactNode };

export default function AppShell({ children }: Props) {
  const pathname = usePathname();

  const NavLink = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 ${
        pathname === href
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-300 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-zinc-950 border-zinc-800">
                <nav className="mt-6 grid gap-2">
                  <NavLink href="/dashboard" label="Dashboard" />
                  <NavLink href="/new" label="New Interview" />
                  <NavLink href="/profile" label="Profile" />
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/" className="font-semibold tracking-tight">
              AI Interview Coach
            </Link>

            <nav className="hidden md:flex items-center gap-2 ml-6">
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/new" label="New Interview" />
              <NavLink href="/profile" label="Profile" />
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/new">
              <Button size="sm">
                <PlusCircle className="h-4 w-4 mr-1" />
                Start
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="secondary" size="sm">
                <User className="h-4 w-4 mr-1" />
                Profile
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-400">
          © {new Date().getFullYear()} AI Interview Coach ·{' '}
          <Link className="underline" href="/privacy">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link className="underline" href="/terms">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
