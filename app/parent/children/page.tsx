'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getLinksForParent,
  revokeParentLink,
  type ParentChildLink,
} from '@/lib/supabase/parent-links';
import {
  getChildAssessments,
  type StudentAssessment,
  type StudentSummary,
} from '@/lib/supabase/student';
import { summarize } from '@/lib/supabase/student-utils';
import { getChildAttendance } from '@/lib/supabase/attendance';
import {
  summarizeAttendance,
  type AttendanceSummary,
} from '@/lib/supabase/attendance-utils';
import {
  getChildAssignments,
  type Assignment,
} from '@/lib/supabase/assignments';
import {
  summarizeAssignments,
  isOverdue,
  type AssignmentSummary,
} from '@/lib/supabase/assignments-utils';
import { Button } from '@/components/ui/button';

const MAX_ASSIGNMENT_ROWS = 10;

export default function ParentChildrenPage() {
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] =
    useState<AttendanceSummary | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentSummary, setAssignmentSummary] =
    useState<AssignmentSummary | null>(null);
  const [today, setToday] = useState('');

  const [loadingLinks, setLoadingLinks] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLinks() {
    const data = await getLinksForParent();
    setLinks(data);
    const approvedLinks = data.filter((l) => l.status === 'approved');
    // Keep the current child if still approved, otherwise fall back to the first one
    setSelected((prev) =>
      prev && approvedLinks.some((l) => l.child_id === prev)
        ? prev
        : (approvedLinks[0]?.child_id ?? null)
    );
    setLoadingLinks(false);
  }

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setAssessments([]);
      setSummary(null);
      setAttendanceSummary(null);
      setAssignments([]);
      setAssignmentSummary(null);
      return;
    }

    let active = true;
    setLoadingGrades(true);

    Promise.all([
      getChildAssessments(selected),
      getChildAttendance(selected),
      getChildAssignments(selected),
    ]).then(([gradeData, attendanceData, assignmentData]) => {
      if (!active) return;
      const t = new Date().toISOString().slice(0, 10);
      setToday(t);
      setAssessments(gradeData);
      setSummary(summarize(gradeData));
      setAttendanceSummary(summarizeAttendance(attendanceData));
      setAssignments(assignmentData);
      setAssignmentSummary(summarizeAssignments(assignmentData, t));
      setLoadingGrades(false);
    });

    return () => {
      active = false;
    };
  }, [selected]);

  async function handleRevoke(linkId: string, childName: string) {
    if (
      !window.confirm(
        `Revoke your access to ${childName}'s records? You can send a new link request later.`
      )
    ) {
      return;
    }
    setError(null);
    const result = await revokeParentLink(linkId);
    if (!result.success) {
      setError(result.error ?? 'Could not revoke access.');
      return;
    }
    await loadLinks();
  }

  if (loadingLinks) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const approved = links.filter((l) => l.status === 'approved');
  const pending = links.filter((l) => l.status === 'pending');
  const selectedLink = approved.find((l) => l.child_id === selected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Children</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View each child&apos;s progress and manage your links.
          </p>
        </div>
        <Button asChild>
          <Link href="/parent/children/add">+ Add a child</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {links.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t added any children yet.
          </p>
          <Button asChild className="mt-3">
            <Link href="/parent/children/add">Add your first child</Link>
          </Button>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-lg font-medium mb-2">Pending</h2>
              <div className="flex flex-col gap-2">
                {pending.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{l.child_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Waiting for the child to approve.
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      pending
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {approved.length > 0 && (
            <>
              <div className="flex gap-2 flex-wrap">
                {approved.map((l) => (
                  <Button
                    key={l.id}
                    size="sm"
                    variant={selected === l.child_id ? 'default' : 'outline'}
                    onClick={() => setSelected(l.child_id)}
                  >
                    {l.child_name}
                  </Button>
                ))}
              </div>

              {loadingGrades ? (
                <p className="text-sm text-muted-foreground">Loading progress…</p>
              ) : (
                <>
                  {/* Attendance */}
                  {attendanceSummary && attendanceSummary.total > 0 && (
                    <div className="rounded-lg border p-4">
                      <h2 className="font-medium">Attendance</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {attendanceSummary.total} sessions recorded ·{' '}
                        <span className="font-medium text-foreground">
                          {(attendanceSummary.percentage ?? 0).toFixed(1)}%
                        </span>{' '}
                        attendance
                      </p>
                      <div className="flex gap-4 text-sm mt-2 flex-wrap">
                        <span>Present: {attendanceSummary.present}</span>
                        <span>Absent: {attendanceSummary.absent}</span>
                        <span>Late: {attendanceSummary.late}</span>
                        <span>Excused: {attendanceSummary.excused}</span>
                      </div>
                    </div>
                  )}

                  {/* Assignments */}
                  {assignmentSummary && assignmentSummary.total > 0 && (
                    <section className="flex flex-col gap-3">
                      <h2 className="text-lg font-medium">Assignments</h2>
                      <div className="grid gap-4 md:grid-cols-4">
                        <Stat label="Total" value={assignmentSummary.total} />
                        <Stat
                          label="Submitted"
                          value={
                            assignmentSummary.submitted + assignmentSummary.graded
                          }
                        />
                        <Stat label="Overdue" value={assignmentSummary.overdue} />
                        <Stat
                          label="Completion"
                          value={
                            assignmentSummary.completion_rate !== null
                              ? `${assignmentSummary.completion_rate.toFixed(0)}%`
                              : '—'
                          }
                        />
                      </div>

                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-left">
                            <tr>
                              <th className="px-4 py-2 font-medium">Due</th>
                              <th className="px-4 py-2 font-medium">Subject</th>
                              <th className="px-4 py-2 font-medium">Title</th>
                              <th className="px-4 py-2 font-medium">Teacher</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignments.slice(0, MAX_ASSIGNMENT_ROWS).map((a) => (
                              <tr key={a.id} className="border-t">
                                <td className="px-4 py-2 text-muted-foreground">
                                  {new Date(a.due_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2">{a.subject_name}</td>
                                <td className="px-4 py-2">{a.title}</td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  {a.teacher_name}
                                </td>
                                <td className="px-4 py-2">
                                  <AssignmentBadge
                                    status={a.submission_status ?? 'assigned'}
                                    overdue={isOverdue(a, today)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {assignments.length > MAX_ASSIGNMENT_ROWS && (
                        <p className="text-xs text-muted-foreground">
                          Showing {MAX_ASSIGNMENT_ROWS} of {assignments.length}{' '}
                          assignments.
                        </p>
                      )}
                    </section>
                  )}

                  {/* Grades summary */}
                  {summary && summary.total_assessments > 0 && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Stat label="Assessments" value={summary.total_assessments} />
                      <Stat
                        label="Average"
                        value={
                          summary.average_percentage !== null
                            ? `${summary.average_percentage.toFixed(1)}%`
                            : '—'
                        }
                      />
                      <Stat label="Subjects" value={summary.subjects.length} />
                    </div>
                  )}

                  {/* Assessments table */}
                  {assessments.length === 0 ? (
                    <div className="rounded-lg border p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No assessments recorded yet for this child.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="px-4 py-2 font-medium">Date</th>
                            <th className="px-4 py-2 font-medium">Subject</th>
                            <th className="px-4 py-2 font-medium">Title</th>
                            <th className="px-4 py-2 font-medium">Teacher</th>
                            <th className="px-4 py-2 font-medium text-right">Score</th>
                            <th className="px-4 py-2 font-medium text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessments.map((a) => (
                            <tr key={a.id} className="border-t">
                              <td className="px-4 py-2 text-muted-foreground">
                                {new Date(a.assessment_date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2">{a.subject_name}</td>
                              <td className="px-4 py-2">
                                <div>{a.title}</div>
                                {a.teacher_comment && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {a.teacher_comment}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {a.teacher_name}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {a.score} / {a.max_score}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {a.percentage.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedLink && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleRevoke(
                            selectedLink.id,
                            selectedLink.child_name ?? 'this child'
                          )
                        }
                        className="text-xs text-red-600 underline underline-offset-4"
                      >
                        Revoke access to this child
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function AssignmentBadge({
  status,
  overdue,
}: {
  status: string;
  overdue: boolean;
}) {
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
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

