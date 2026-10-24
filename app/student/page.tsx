import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/profile';

async function StudentDashboard() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'student') redirect('/protected');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Student Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.full_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Subjects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No subjects enrolled yet.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Grades</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No assessments recorded yet.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No attendance records yet.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StudentPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <StudentDashboard />
        </Suspense>
      </div>
    </div>
  );
}