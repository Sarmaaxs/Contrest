/**
 * Contrest verification = profiles.is_verified in Supabase only.
 * Must be the boolean true — never truthy strings / missing fields.
 *
 *   UPDATE public.profiles SET is_verified = true WHERE username = 'ceo';
 *   UPDATE public.profiles SET is_verified = false WHERE is_verified = true; -- reset all
 */
export function isVerified(profile?: { is_verified?: boolean | null } | null): boolean {
  return profile?.is_verified === true;
}

