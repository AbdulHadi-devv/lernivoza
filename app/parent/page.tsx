import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCurrentProfile } from '@/lib/supabase/profile';
import Link from 'next/link';

async function ParentDashboard() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'parent') redirect('/protected');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Parent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.full_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">My Children</h2>
          <p className="text-sm text-muted-foreground mt-1">
            No children added yet.
          </p>
          <Link
            href="#"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Add a child (coming soon)
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Teacher Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Approve teachers who want to work with your child.
          </p>
          <Link
            href="/parent/approvals"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Review requests →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Find Tutors</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Search for tutors and institutes.
          </p>
          <Link
            href="#"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Search (coming soon)
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Progress</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track your child's academic progress.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ParentPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ParentDashboard />
        </Suspense>
      </div>
    </div>
  );
}