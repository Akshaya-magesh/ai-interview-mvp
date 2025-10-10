// lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

// Creates a Supabase client for use inside Next.js Route Handlers (/app/api/*)
export function supabaseServer(): SupabaseClient {
  // `createRouteHandlerClient` knows how to read/write auth cookies
  return createRouteHandlerClient({ cookies }) as unknown as SupabaseClient;
}
