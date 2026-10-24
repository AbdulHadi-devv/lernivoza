import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/profile';

async function RoleDispatcher() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/auth/login');
  }

  switch (profile.role) {
    case 'parent':
      redirect('/parent');
    case 'student':
      redirect('/student');
    case 'teacher':
      redirect('/teacher');
    case 'institute_admin':
    case 'platform_admin':
      // Not built yet; land them on a placeholder
      return (
        <div className="p-4 rounded-lg border">
          <p className="text-sm">
            Admin dashboards are not available yet. You are signed in as{' '}
            <strong>{profile.role}</strong>.
          </p>
        </div>
      );
    default:
      return (
        <div className="p-4 rounded-lg border border-red-300 bg-red-50">
          <p className="text-sm">Unknown role: {profile.role}</p>
        </div>
      );
  }
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Redirecting…</p>}>
      <RoleDispatcher />
    </Suspense>
  );
}