import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/profile';

async function TeacherDashboard() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'teacher') redirect('/protected');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.full_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Students</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No students linked yet.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Gradebook</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No assessments recorded yet.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No attendance recorded yet.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TeacherPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <TeacherDashboard />
        </Suspense>
      </div>
    </div>
  );
}