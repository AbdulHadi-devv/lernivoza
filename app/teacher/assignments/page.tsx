'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAssignmentsByTeacher,
  type Assignment,
} from '@/lib/supabase/assignments';
import { Button } from '@/components/ui/button';

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssignmentsByTeacher().then((data) => {
      setAssignments(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assignments you have created for your students.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/assignments/new">+ Create assignment</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No assignments created yet.
          </p>
          <Button asChild className="mt-3">
            <Link href="/teacher/assignments/new">Create your first assignment</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(a.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{a.student_name}</td>
                  <td className="px-4 py-2">{a.subject_name}</td>
                  <td className="px-4 py-2">
                    <div>{a.title}</div>
                    {a.resource_url && (
                      <a
                        href={a.resource_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-4 text-muted-foreground"
                      >
                        Resource
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={a.submission_status ?? 'assigned'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    assigned: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-green-100 text-green-800',
    graded: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}