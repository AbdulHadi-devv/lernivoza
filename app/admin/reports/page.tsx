'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminReports, resolveReport } from '@/lib/supabase/admin';
import type { AdminReport } from '@/lib/supabase/admin-utils';
import { Button } from '@/components/ui/button';

type Filter = 'open' | 'all';

function statusClass(status: string): string {
  if (status === 'open') return 'bg-yellow-100 text-yellow-800';
  if (status === 'reviewed') return 'bg-green-100 text-green-800';
  return 'bg-muted text-muted-foreground';
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getAdminReports();
    if (result.error) setError(result.error);
    setReports(result.reports);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(report: AdminReport, status: 'reviewed' | 'dismissed') {
    setBusyId(report.id);
    setError(null);
    const result = await resolveReport(report.id, status);
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? 'Could not update the report.');
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  const openCount = reports.filter((r) => r.status === 'open').length;
  const visible = reports.filter((r) => (filter === 'open' ? r.status === 'open' : true));

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Message reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Only reported messages are shown here, not whole conversations.
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

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'open' ? 'default' : 'outline'}
            onClick={() => setFilter('open')}
          >
            Open ({openCount})
          </Button>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All ({reports.length})
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === 'open' ? 'No open reports.' : 'No reports yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Reported {new Date(r.created_at).toLocaleString()} by{' '}
                    <span className="text-foreground font-medium">
                      {r.reporter_name}
                    </span>
                  </p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reason given</p>
                  <p className="text-sm">{r.reason}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Message from{' '}
                    <span className="text-foreground font-medium">
                      {r.sender_name}
                    </span>{' '}
                    ({r.sender_role}), sent{' '}
                    {new Date(r.message_sent_at).toLocaleString()}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words rounded bg-muted/50 p-3">
                    {r.message_body}
                  </p>
                </div>

                {r.status === 'open' ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => handleResolve(r, 'reviewed')}
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => handleResolve(r, 'dismissed')}
                    >
                      Dismiss
                    </Button>
                    {r.sender_role === 'teacher' && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href="/admin/tutors">Manage tutors</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  r.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      Handled {new Date(r.reviewed_at).toLocaleString()}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}