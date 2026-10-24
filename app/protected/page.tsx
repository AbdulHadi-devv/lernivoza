import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function ProtectedContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="p-4 rounded-lg border border-yellow-300 bg-yellow-50">
        <p className="text-sm">
          Profile not found. This usually means the signup profile insert failed.
          Please contact support or try signing up again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Welcome, {profile.full_name}</h1>
      <p className="text-muted-foreground">
        You are signed in as: <strong>{profile.role}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        Your role-specific dashboard will appear here in the next step.
      </p>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your dashboard…</p>}>
      <ProtectedContent />
    </Suspense>
  );
}