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
import {
  getChildAttendance,
  type AttendanceRecord,
} from '@/lib/supabase/attendance';
import { summarizeAttendance } from '@/lib/supabase/attendance-utils';
import { Button } from '@/components/ui/button';

export default function ParentChildrenPage() {
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<ReturnType<
    typeof summarizeAttendance
  > | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);

  async function loadLinks() {
    const data = await getLinksForParent();
    setLinks(data);
    const approved = data.filter((l) => l.status === 'approved');
    if (approved.length > 0 && !selected) setSelected(approved[0].child_id);
    setLoadingLinks(false);
  }

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingGrades(true);
    Promise.all([getChildAssessments(selected), getChildAttendance(selected)]).then(
      ([gradeData, attendanceData]) => {
        setAssessments(gradeData);
        setSummary(summarize(gradeData));
        setAttendance(attendanceData);
        setAttendanceSummary(summarizeAttendance(attendanceData));
        setLoadingGrades(false);
      }
    );
  }, [selected]);

  async function handleRevoke(linkId: string) {
    await revokeParentLink(linkId);
    await loadLinks();
    setSelected(null);
  }

  if (loadingLinks) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const approved = links.filter((l) => l.status === 'approved');
  const pending = links.filter((l) => l.status === 'pending');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Children</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View each child's progress and manage your links.
          </p>
        </div>
        <Button asChild>
          <Link href="/parent/children/add">+ Add a child</Link>
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You haven't added any children yet.
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
                <p className="text-sm text-muted-foreground">Loading grades…</p>
              ) : (
                <>
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
                      <div className="flex gap-4 text-sm mt-2">
                        <span>Present: {attendanceSummary.present}</span>
                        <span>Absent: {attendanceSummary.absent}</span>
                        <span>Late: {attendanceSummary.late}</span>
                        <span>Excused: {attendanceSummary.excused}</span>
                      </div>
                    </div>
                  )}

                  {summary && summary.total_assessments > 0 && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">
                          Assessments
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {summary.total_assessments}
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Average</p>
                        <p className="text-2xl font-semibold mt-1">
                          {summary.average_percentage !== null
                            ? `${summary.average_percentage.toFixed(1)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Subjects</p>
                        <p className="text-2xl font-semibold mt-1">
                          {summary.subjects.length}
                        </p>
                      </div>
                    </div>
                  )}

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
                            <th className="px-4 py-2 font-medium text-right">
                              Score
                            </th>
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

                  {selected && (
                    <div className="text-right">
                      <button
                        onClick={() => {
                          const link = approved.find(
                            (l) => l.child_id === selected
                          );
                          if (link) handleRevoke(link.id);
                        }}
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