import { headers } from 'next/headers';

export async function getClientIp(fallback = '127.0.0.1') {
  const h = await headers();
  const xff = h.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0]?.trim() || h.get('x-real-ip') || fallback;
  return ip as string;
}
