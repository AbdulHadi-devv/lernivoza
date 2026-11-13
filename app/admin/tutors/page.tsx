'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAdminTutors,
  setTutorVerification,
  unlistTutor,
} from '@/lib/supabase/admin';
import type { AdminTutor } from '@/lib/supabase/admin-utils';
import {
  formatFee,
  formatGrades,
  formatLocation,
  modeLabel,
  verificationLabel,
} from '@/lib/supabase/tutors-utils';
import { Button } from '@/components/ui/button';

type Filter = 'pending' | 'all' | 'verified' | 'unverified';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'unverified', label: 'Not verified' },
  { key: 'verified', label: 'Verified' },
  { key: 'all', label: 'All' },
];

function statusClass(status: string): string {
  if (status === 'verified') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-muted text-muted-foreground';
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<AdminTutor[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getAdminTutors();
    if (result.error) setError(result.error);
    setTutors(result.tutors);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(
    tutor: AdminTutor,
    confirmText: string | null,
    action: () => Promise<{ success: boolean; error?: string }>
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(tutor.id);
    setError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  const visible = tutors.filter((t) =>
    filter === 'all' ? true : t.verification_status === filter
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tutor verification</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify tutors after you have checked their qualifications. A
              verified badge is shown to parents.
            </p>
          </div>
          <Link href="/admin" className="text-sm underline underline-offset-4">
            ← Admin
          </Link>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const count =
              f.key === 'all'
                ? tutors.length
                : tutors.filter((t) => t.verification_status === f.key).length;
            return (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                onClick={() => setFilter(f.key)}
              >
                {f.label} ({count})
              </Button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No tutors in this list.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((t) => {
              const busy = busyId === t.id;
              return (
                <div key={t.id} className="rounded-lg border p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-lg">{t.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.qualification ?? 'No qualification entered'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(
                          t.verification_status
                        )}`}
                      >
                        {verificationLabel(t.verification_status)}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          t.is_listed
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {t.is_listed ? 'Listed' : 'Not listed'}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm grid gap-1 text-muted-foreground">
                    <p>
                      {formatFee(t.hourly_fee_pkr)} · {modeLabel(t.teaching_mode)} ·{' '}
                      {formatGrades(t.grade_min, t.grade_max)}
                    </p>
                    <p>{formatLocation(t.teaching_mode, t.city, t.area)}</p>
                    <p>
                      Subjects:{' '}
                      {t.subjects.length > 0 ? t.subjects.join(', ') : 'none chosen'}
                    </p>
                    {t.verified_at && (
                      <p>
                        Verified on {new Date(t.verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {t.bio && (
                    <p className="text-sm whitespace-pre-wrap break-words rounded bg-muted/50 p-3">
                      {t.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {t.verification_status !== 'verified' && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(
                            t,
                            `Verify ${t.full_name}? Parents will see a Verified badge.`,
                            () => setTutorVerification(t.id, 'verified')
                          )
                        }
                      >
                        Verify
                      </Button>
                    )}
                    {t.verification_status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(t, `Reject the verification request from ${t.full_name}?`, () =>
                            setTutorVerification(t.id, 'unverified')
                          )
                        }
                      >
                        Reject request
                      </Button>
                    )}
                    {t.verification_status === 'verified' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(t, `Remove the verification from ${t.full_name}?`, () =>
                            setTutorVerification(t.id, 'unverified')
                          )
                        }
                      >
                        Remove verification
                      </Button>
                    )}
                    {t.is_listed && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(
                            t,
                            `Remove ${t.full_name} from tutor search? They can list themselves again.`,
                            () => unlistTutor(t.id)
                          )
                        }
                      >
                        Unlist from search
                      </Button>
                    )}
                    {t.is_listed && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/tutors/${t.id}`}>View public profile</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}