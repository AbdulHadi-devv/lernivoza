'use client';

import { useEffect, useState } from 'react';
import {
  getMyAssignments,
  markAssignmentSubmitted,
  type Assignment,
} from '@/lib/supabase/assignments';
import {
  summarizeAssignments,
  isOverdue,
  type AssignmentSummary,
} from '@/lib/supabase/assignments-utils';
import { Button } from '@/components/ui/button';

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function load() {
    const data = await getMyAssignments();
    setAssignments(data);
    const t = new Date().toISOString().slice(0, 10);
    setToday(t);
    setSummary(summarizeAssignments(data, t));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(id: string) {
    setError(null);
    setSubmittingId(id);
    const result = await markAssignmentSubmitted(id);
    if (result.error) {
      setError(result.error);
      setSubmittingId(null);
      return;
    }
    await load();
    setSubmittingId(null);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Homework and tasks from your teachers.
        </p>
      </div>

      {summary && summary.total > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-semibold mt-1">{summary.total}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-xl font-semibold mt-1">{summary.submitted}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-xl font-semibold mt-1">{summary.overdue}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-xl font-semibold mt-1">
              {summary.completion_rate !== null
                ? `${summary.completion_rate.toFixed(0)}%`
                : '—'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No assignments yet. When a teacher gives you work, it will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => {
            const overdue = isOverdue(a, today);
            const status = a.submission_status ?? 'assigned';
            return (
              <div
                key={a.id}
                className={`rounded-lg border p-4 ${overdue ? 'border-red-300 bg-red-50/40' : ''}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{a.title}</h3>
                      <StatusBadge status={status} overdue={overdue} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {a.subject_name} · From {a.teacher_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due {new Date(a.due_date).toLocaleDateString()}
                    </p>
                    {a.description && (
                      <p className="text-sm mt-2">{a.description}</p>
                    )}
                    {a.resource_url && (
                      <a
                        href={a.resource_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-4 text-muted-foreground mt-2 inline-block"
                      >
                        Open resource →
                      </a>
                    )}
                  </div>
                  <div>
                    {status === 'assigned' && (
                      <Button
                        size="sm"
                        onClick={() => handleSubmit(a.id)}
                        disabled={submittingId === a.id}
                      >
                        {submittingId === a.id
                          ? 'Submitting…'
                          : 'Mark submitted'}
                      </Button>
                    )}
                    {status === 'submitted' && (
                      <p className="text-xs text-muted-foreground text-right">
                        Submitted
                        {a.submitted_at &&
                          ` ${new Date(a.submitted_at).toLocaleDateString()}`}
                      </p>
                    )}
                    {status === 'graded' && (
                      <p className="text-xs text-muted-foreground text-right">Graded</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, overdue }: { status: string; overdue: boolean }) {
  if (overdue) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        overdue
      </span>
    );
  }
  const styles: Record<string, string> = {
    assigned: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-green-100 text-green-800',
    graded: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}