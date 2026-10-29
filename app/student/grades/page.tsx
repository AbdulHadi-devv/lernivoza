'use client';

import { useEffect, useState } from 'react';
import {
  getMyAssessments,
  type StudentAssessment,
  type StudentSummary,
} from '@/lib/supabase/student';
import { summarize } from '@/lib/supabase/student-utils';

export default function StudentGradesPage() {
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAssessments().then((data) => {
      setAssessments(data);
      setSummary(summarize(data));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Grades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every assessment your teachers have recorded for you.
        </p>
      </div>

      {summary && summary.total_assessments > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Total assessments</p>
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
            No assessments recorded yet. When a teacher records a mark, it will
            appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Subject breakdown */}
          {summary && summary.subjects.length > 0 && (
            <section>
              <h2 className="text-lg font-medium mb-3">By Subject</h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Subject</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Assessments
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Average
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.subjects.map((s) => (
                      <tr key={s.subject_name} className="border-t">
                        <td className="px-4 py-2">{s.subject_name}</td>
                        <td className="px-4 py-2 text-right">{s.count}</td>
                        <td className="px-4 py-2 text-right">
                          {s.average_percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Individual assessments */}
          <section>
            <h2 className="text-lg font-medium mb-3">All Assessments</h2>
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
          </section>
        </>
      )}
    </div>
  );
}