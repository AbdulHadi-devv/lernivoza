import { createClient } from '@/lib/supabase/server';

export type UserRole = 'parent' | 'student' | 'teacher' | 'institute_admin' | 'platform_admin';

export interface CurrentProfile {
  id: string;
  role: UserRole;
  full_name: string;
}

/**
 * Returns the logged-in user's profile, or null if not signed in
 * or if the profile row is missing.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  return profile as CurrentProfile | null;
}