'use client';

import { useEffect, useState } from 'react';
import {
  recordAttendance,
  getAttendanceByTeacher,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/lib/supabase/attendance';
import { summarizeAttendance } from '@/lib/supabase/attendance-utils';
import { getApprovedStudents, type ApprovedStudent } from '@/lib/supabase/assessments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TeacherAttendancePage() {
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [date, setDate] = useState('');
  const [today, setToday] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [s, r] = await Promise.all([
      getApprovedStudents(),
      getAttendanceByTeacher(),
    ]);
    setStudents(s);
    setRecords(r);
    setLoadingLists(false);
  }

  useEffect(() => {
    const now = new Date().toISOString().slice(0, 10);
    setDate(now);
    setToday(now);
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!studentId) {
      setError('Please choose a student.');
      return;
    }

    setSubmitting(true);
    const result = await recordAttendance({
      student_id: studentId,
      status,
      class_date: date,
      notes,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(`Recorded ${status} for ${date}.`);
    setNotes('');
    await load();
    setSubmitting(false);
  }

  if (loadingLists) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const summary = summarizeAttendance(records);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record attendance for approved students and review history.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You need at least one approved student before you can record attendance.
          </p>
          <a
            href="/teacher/students"
            className="text-sm underline underline-offset-4 mt-3 inline-block"
          >
            Go to My Students →
          </a>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border p-5 flex flex-col gap-4"
        >
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Class date</Label>
              <Input
                id="date"
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Arrived 15 minutes late"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600" role="status">
              {success}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? 'Saving…' : 'Record attendance'}
          </Button>
        </form>
      )}

      {/* Summary */}
      {records.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Stat label="Total" value={summary.total} />
          <Stat label="Present" value={summary.present} />
          <Stat label="Absent" value={summary.absent} />
          <Stat label="Late" value={summary.late} />
          <Stat
            label="Attendance %"
            value={
              summary.percentage !== null
                ? `${summary.percentage.toFixed(1)}%`
                : '—'
            }
          />
        </div>
      )}

      {/* History */}
      <section>
        <h2 className="text-lg font-medium mb-3">History</h2>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance recorded yet.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.class_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{r.student_name}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    excused: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}