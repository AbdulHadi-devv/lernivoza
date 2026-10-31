import type { Assignment } from '@/lib/supabase/assignments';

export interface AssignmentSummary {
  total: number;
  assigned: number;
  submitted: number;
  graded: number;
  overdue: number;
  completion_rate: number | null;
}

/**
 * Computes assignment statistics for a student.
 *
 * "Overdue" = status is 'assigned' AND due_date < today.
 * "Completion rate" = (submitted + graded) / total.
 *
 * Pass `today` as an ISO date string (YYYY-MM-DD) so this stays deterministic.
 */
export function summarizeAssignments(
  assignments: Assignment[],
  today: string
): AssignmentSummary {
  const total = assignments.length;
  let assigned = 0;
  let submitted = 0;
  let graded = 0;
  let overdue = 0;

  for (const a of assignments) {
    const status = a.submission_status ?? 'assigned';
    if (status === 'assigned') {
      assigned++;
      if (a.due_date < today) overdue++;
    } else if (status === 'submitted') {
      submitted++;
    } else if (status === 'graded') {
      graded++;
    }
  }

  const completion = total > 0 ? ((submitted + graded) / total) * 100 : null;

  return {
    total,
    assigned,
    submitted,
    graded,
    overdue,
    completion_rate: completion,
  };
}

/**
 * Returns true if the assignment is overdue (due date in the past, not submitted).
 */
export function isOverdue(assignment: Assignment, today: string): boolean {
  return (
    (assignment.submission_status ?? 'assigned') === 'assigned' &&
    assignment.due_date < today
  );
}