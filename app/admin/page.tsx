import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/supabase/profile';
import { getAdminStats } from '@/lib/supabase/admin';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
      {count}
    </span>
  );
}

async function AdminDashboard() {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'platform_admin') redirect('/protected');

  const { stats, error } = await getAdminStats();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Console</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {profile.full_name}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">
            Tutor verification
            <Badge count={stats?.pending_verifications ?? 0} />
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review tutors who asked to be verified, and manage listings.
          </p>
          <Link
            href="/admin/tutors"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open tutors →
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">
            Message reports
            <Badge count={stats?.open_reports ?? 0} />
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review messages that users have reported.
          </p>
          <Link
            href="/admin/reports"
            className="text-sm underline underline-offset-4 mt-2 inline-block"
          >
            Open reports →
          </Link>
        </div>
      </div>

      {stats && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Platform overview</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Stat label="Parents" value={stats.parents} />
            <Stat label="Students" value={stats.students} />
            <Stat label="Teachers" value={stats.teachers} />
            <Stat label="Active teacher links" value={stats.active_teacher_links} />
            <Stat label="Listed tutors" value={stats.listed_tutors} />
            <Stat label="Verified tutors" value={stats.verified_tutors} />
            <Stat label="Pending enquiries" value={stats.pending_enquiries} />
            <Stat label="Open reports" value={stats.open_reports} />
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <AdminDashboard />
        </Suspense>
      </div>
    </div>
  );
}