'use server';

import { createClient } from '@/lib/supabase/server';
import { getLinksForTeacher } from '@/lib/supabase/links';

export interface Assessment {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_id: string | null;
  title: string;
  score: number;
  max_score: number;
  assessment_date: string;
  teacher_comment: string | null;
  created_at: string;
  student_name?: string;
  subject_name?: string;
}

export interface ApprovedStudent {
  id: string;
  full_name: string;
}

export interface CreateAssessmentInput {
  student_id: string;
  subject_id: string;
  title: string;
  score: number;
  max_score: number;
  assessment_date: string;
  teacher_comment?: string;
}

/**
 * Returns students where the current teacher has an approved link.
 * Used to populate the student dropdown in the assessment form.
 */
export async function getApprovedStudents(): Promise<ApprovedStudent[]> {
  const links = await getLinksForTeacher();
  return links
    .filter((l) => l.status === 'approved')
    .map((l) => ({
      id: l.student_id,
      full_name: l.student_name ?? 'Unknown',
    }));
}

/**
 * Returns all subjects available for selection.
 */
export async function getSubjects(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name');
  if (error || !data) return [];
  return data;
}

/**
 * Creates a new assessment for an approved student.
 * The RLS policy enforces that teacher_id = auth.uid() AND the teacher
 * has an approved link to the student.
 */
export async function createAssessment(
  input: CreateAssessmentInput
): Promise<{ assessment?: Assessment; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  console.log('[createAssessment] auth.uid() =', user.id);

  // Client-side validation mirrors server constraints so we can give
  // a clearer message before the DB rejects it.
  if (!input.title.trim()) return { error: 'Title is required.' };
  if (!input.subject_id) return { error: 'Please choose a subject.' };
  if (!Number.isFinite(input.score) || input.score < 0) {
    return { error: 'Score cannot be negative.' };
  }
  if (!Number.isFinite(input.max_score) || input.max_score <= 0) {
    return { error: 'Maximum score must be greater than zero.' };
  }
  if (input.score > input.max_score) {
    return { error: 'Score cannot exceed the maximum score.' };
  }
  if (!input.assessment_date) {
    return { error: 'Please choose an assessment date.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (input.assessment_date > today) {
    return { error: 'Assessment date cannot be in the future.' };
  }

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      student_id: input.student_id,
      teacher_id: user.id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      score: input.score,
      max_score: input.max_score,
      assessment_date: input.assessment_date,
      teacher_comment: input.teacher_comment?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    // Helpful message for the RLS rejection case
    if (error.code === '42501') {
      return {
        error:
          'You can only record marks for students you are linked to. ' +
          'Ask the student or their parent to approve your link request.',
      };
    }
    return { error: error.message };
  }

  return { assessment: data as Assessment };
}

/**
 * Returns all assessments created by the current teacher,
 * with the student's name and subject name joined.
 */
export async function getAssessmentsByTeacher(): Promise<Assessment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assessments')
    .select('*, student:student_id(full_name), subject:subject_id(name)')
    .eq('teacher_id', user.id)
    .order('assessment_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    student_name: row.student?.full_name ?? 'Unknown student',
    subject_name: row.subject?.name ?? '—',
  }));
}