'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApprovedStudents, getSubjects, type ApprovedStudent } from '@/lib/supabase/assessments';
import { createAssignment } from '@/lib/supabase/assignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewAssignmentPage() {
  const router = useRouter();
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getApprovedStudents(), getSubjects()]).then(([s, sub]) => {
      setStudents(s);
      setSubjects(sub);
      const today = new Date().toISOString().slice(0, 10);
      setIssueDate(today);
      // Default due date = 7 days later
      const later = new Date();
      later.setDate(later.getDate() + 7);
      setDueDate(later.toISOString().slice(0, 10));
      setLoadingLists(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId) {
      setError('Please choose a student.');
      return;
    }
    setSubmitting(true);
    const result = await createAssignment({
      student_id: studentId,
      subject_id: subjectId,
      title,
      description,
      resource_url: resourceUrl,
      issue_date: issueDate,
      due_date: dueDate,
    });
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push('/teacher/assignments');
    router.refresh();
  }

  if (loadingLists) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Create Assignment</h1>
        <p className="text-sm text-muted-foreground">
          You need at least one approved student before you can create an assignment.
        </p>
        <a href="/teacher/students" className="text-sm underline underline-offset-4">
          Go to My Students →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">Create Assignment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign homework or tasks to an approved student.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="student">Student</Label>
          <select
            id="student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <select
            id="subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select a subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Practice questions 1-20 from Chapter 3"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-24"
            placeholder="Any instructions or details the student should know"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="resource">Resource link (optional)</Label>
          <Input
            id="resource"
            type="url"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="issue">Issue date</Label>
            <Input
              id="issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              min={issueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create assignment'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/teacher/assignments')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}