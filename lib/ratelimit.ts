// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Lazy singleton. If env vars are missing (or during local dev),
 * we return a NO-OP ratelimiter so routes never crash.
 */
let _rl: Ratelimit | null = null;

export function getRatelimit() {
  if (_rl) return _rl;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // No Upstash config → return a no-op that always allows
    const noop = {
      // match Ratelimit.limit signature enough for our use
      limit: async (_key: string) =>
        ({ success: true, remaining: 999, reset: 0, pending: 0 } as const),
    };
    // @ts-expect-error – intentional loose typing for noop
    _rl = noop;
    return _rl;
  }

  _rl = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(20, '1 m'),
  });
  return _rl;
}
