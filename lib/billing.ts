import type { SupabaseClient } from '@supabase/supabase-js';

export const FREE_LIMIT = 2;

function startOfThisMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function checkAndConsumeInterview(
  admin: SupabaseClient,
  external_user_id: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: user } = await admin
    .from('users')
    .select('id, plan, monthly_interviews_used, monthly_reset_at')
    .eq('external_user_id', external_user_id)
    .single();

  if (!user) return { allowed: false, reason: 'User not found' };

  const needsReset =
    !user.monthly_reset_at ||
    new Date(user.monthly_reset_at).getTime() < new Date(startOfThisMonthISO()).getTime();

  if (needsReset) {
    await admin
      .from('users')
      .update({ monthly_interviews_used: 0, monthly_reset_at: startOfThisMonthISO() })
      .eq('id', user.id);
    user.monthly_interviews_used = 0;
  }

  if (user.plan !== 'pro' && user.monthly_interviews_used >= FREE_LIMIT) {
    return { allowed: false, reason: `Free plan allows ${FREE_LIMIT} interviews per month.` };
  }

  await admin
    .from('users')
    .update({ monthly_interviews_used: (user.monthly_interviews_used ?? 0) + 1 })
    .eq('id', user.id);

  return { allowed: true };
}
