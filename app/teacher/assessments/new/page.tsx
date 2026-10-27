'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getApprovedStudents,
  getSubjects,
  createAssessment,
  type ApprovedStudent,
} from '@/lib/supabase/assessments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewAssessmentPage() {
  const router = useRouter();
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [date, setDate] = useState('');
  const [today, setToday] = useState('');
  const [comment, setComment] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getApprovedStudents(), getSubjects()]).then(([s, sub]) => {
      setStudents(s);
      setSubjects(sub);
      // Set today's date in the browser, after hydration.
      // This avoids Next.js prerendering a stale date.
      const now = new Date().toISOString().slice(0, 10);
      setDate(now);
      setToday(now);
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
    const result = await createAssessment({
      student_id: studentId,
      subject_id: subjectId,
      title,
      score: parseFloat(score),
      max_score: parseFloat(maxScore),
      assessment_date: date,
      teacher_comment: comment,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push('/teacher/assessments');
    router.refresh();
  }

  if (loadingLists) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Record an Assessment</h1>
        <p className="text-sm text-muted-foreground">
          You need at least one approved student before you can record a mark.
        </p>
        <a
          href="/teacher/students"
          className="text-sm underline underline-offset-4"
        >
          Go to My Students →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">Record an Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Only approved students appear in the list below.
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
          <Label htmlFor="title">Assessment title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 3 Quiz"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="score">Score obtained</Label>
            <Input
              id="score"
              type="number"
              min="0"
              step="any"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxScore">Maximum score</Label>
            <Input
              id="maxScore"
              type="number"
              min="1"
              step="any"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Assessment date</Label>
          <Input
            id="date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Comment (optional)</Label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-24"
            placeholder="Constructive feedback for the student and parent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save assessment'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/teacher/assessments')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}