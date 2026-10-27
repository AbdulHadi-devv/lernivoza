'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAssessmentsByTeacher, type Assessment } from '@/lib/supabase/assessments';
import { Button } from '@/components/ui/button';

export default function TeacherAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssessmentsByTeacher().then((data) => {
      setAssessments(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gradebook</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All assessments you have recorded.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/assessments/new">+ Record assessment</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : assessments.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No assessments recorded yet.
          </p>
          <Button asChild className="mt-3">
            <Link href="/teacher/assessments/new">Record your first mark</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium text-right">Score</th>
                <th className="px-4 py-2 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const pct = ((a.score / a.max_score) * 100).toFixed(1);
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(a.assessment_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{a.student_name}</td>
                    <td className="px-4 py-2">{a.subject_name}</td>
                    <td className="px-4 py-2">{a.title}</td>
                    <td className="px-4 py-2 text-right">
                      {a.score} / {a.max_score}
                    </td>
                    <td className="px-4 py-2 text-right">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}