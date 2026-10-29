'use client';

import { useEffect, useState } from 'react';
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
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface Child {
  id: string;
  full_name: string;
}

export default function ParentChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<ReturnType<
    typeof summarizeAttendance
  > | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Load children via parent_child_links
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('parent_child_links')
        .select('child:child_id(id, full_name)')
        .eq('parent_id', user.id)
        .eq('status', 'approved');

      const kids: Child[] = (data ?? [])
        .map((row: any) => row.child)
        .filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) setSelected(kids[0].id);
      setLoadingChildren(false);
    })();
  }, []);

  // Load assessments and attendance when a child is selected
  useEffect(() => {
    if (!selected) return;
    setLoadingGrades(true);
    Promise.all([
      getChildAssessments(selected),
      getChildAttendance(selected),
    ]).then(([gradeData, attendanceData]) => {
      setAssessments(gradeData);
      setSummary(summarize(gradeData));
      setAttendance(attendanceData);
      setAttendanceSummary(summarizeAttendance(attendanceData));
      setLoadingGrades(false);
    });
  }, [selected]);

  if (loadingChildren) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (children.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No children linked to your account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Children</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View each child's assessment and attendance history.
        </p>
      </div>

      <div className="flex gap-2">
        {children.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={selected === c.id ? 'default' : 'outline'}
            onClick={() => setSelected(c.id)}
          >
            {c.full_name}
          </Button>
        ))}
      </div>

      {loadingGrades ? (
        <p className="text-sm text-muted-foreground">Loading grades…</p>
      ) : (
        <>
          {/* Attendance summary */}
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

          {/* Grade summary */}
          {summary && summary.total_assessments > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Assessments</p>
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
        </>
      )}
    </div>
  );
}