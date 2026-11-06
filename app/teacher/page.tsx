import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/profile';
import { getUnreadCount } from '@/lib/supabase/messages';
import Link from 'next/link';

async function TeacherDashboard() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'teacher') redirect('/protected');

  const unread = await getUnreadCount();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.full_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Students</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Link to students and manage your roster.
          </p>
          <Link
            href="/teacher/students"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open students page →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Gradebook</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record and review student assessments.
          </p>
          <Link
            href="/teacher/assessments"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open gradebook →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Assignments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Give homework and track submissions.
          </p>
          <Link
            href="/teacher/assignments"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open assignments →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record and review attendance.
          </p>
          <Link
            href="/teacher/attendance"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open attendance →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Tutor Profile</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set your fee, subjects and area so parents can find you.
          </p>
          <Link
            href="/teacher/profile"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Edit profile →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">
            Messages
            {unread > 0 && (
              <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                {unread}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Message the parents of your students.
          </p>
          <Link
            href="/messages"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open messages →
          </Link>
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