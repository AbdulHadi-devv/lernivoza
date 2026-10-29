import type { StudentAssessment, StudentSummary } from '@/lib/supabase/student';

/**
 * Computes summary statistics from a list of assessments.
 * Pure function — safe to import from Client Components.
 */
export function summarize(assessments: StudentAssessment[]): StudentSummary {
  if (assessments.length === 0) {
    return { total_assessments: 0, average_percentage: null, subjects: [] };
  }

  const totalPct = assessments.reduce((sum, a) => sum + a.percentage, 0);
  const average = totalPct / assessments.length;

  const bySubject = new Map<string, number[]>();
  for (const a of assessments) {
    const list = bySubject.get(a.subject_name) ?? [];
    list.push(a.percentage);
    bySubject.set(a.subject_name, list);
  }

  const subjects = Array.from(bySubject.entries()).map(
    ([subject_name, percentages]) => ({
      subject_name,
      count: percentages.length,
      average_percentage:
        percentages.reduce((s, p) => s + p, 0) / percentages.length,
    })
  );

  subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  return {
    total_assessments: assessments.length,
    average_percentage: average,
    subjects,
  };
}