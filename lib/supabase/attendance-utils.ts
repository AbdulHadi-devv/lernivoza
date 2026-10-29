import type { AttendanceRecord, AttendanceStatus } from '@/lib/supabase/attendance';

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number | null; // present + late + excused divided by total, or null if no rows
}

/**
 * Computes attendance statistics.
 *
 * Formula:
 *   attended = present + late + excused
 *   percentage = attended / total * 100
 *
 * Absences are counted against attendance. Late and excused are counted as
 * present for the percentage, because the student attended. If you want late
 * to count differently, adjust here — the formula is intentionally
 * centralized so dashboards and reports cannot drift.
 */
export function summarizeAttendance(
  records: AttendanceRecord[]
): AttendanceSummary {
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };
  for (const r of records) counts[r.status]++;

  const total = records.length;
  const attended = counts.present + counts.late + counts.excused;

  return {
    total,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    excused: counts.excused,
    percentage: total > 0 ? (attended / total) * 100 : null,
  };
}