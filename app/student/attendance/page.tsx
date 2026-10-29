'use client';

import { useEffect, useState } from 'react';
import {
  getMyAttendance,
  type AttendanceRecord,
} from '@/lib/supabase/attendance';
import { summarizeAttendance } from '@/lib/supabase/attendance-utils';

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAttendance().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const summary = summarizeAttendance(records);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every attendance record your teachers have marked.
        </p>
      </div>

      {summary.total > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Stat label="Total" value={summary.total} />
          <Stat label="Present" value={summary.present} />
          <Stat label="Absent" value={summary.absent} />
          <Stat label="Late" value={summary.late} />
          <Stat
            label="Attendance %"
            value={`${(summary.percentage ?? 0).toFixed(1)}%`}
          />
        </div>
      )}

      {records.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No attendance records yet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Teacher</th>
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
                  <td className="px-4 py-2">{r.teacher_name}</td>
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