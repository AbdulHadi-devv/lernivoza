'use server';

import { createClient } from '@/lib/supabase/server';

export interface StudentAssessment {
  id: string;
  title: string;
  score: number;
  max_score: number;
  assessment_date: string;
  teacher_comment: string | null;
  subject_name: string;
  teacher_name: string;
  percentage: number;
}

export interface SubjectSummary {
  subject_name: string;
  count: number;
  average_percentage: number;
}

export interface StudentSummary {
  total_assessments: number;
  average_percentage: number | null;
  subjects: SubjectSummary[];
}

/**
 * Returns all assessments for the currently signed-in student.
 * RLS policy `assessments_select_student` enforces student_id = auth.uid().
 */
export async function getMyAssessments(): Promise<StudentAssessment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assessments')
    .select(
      'id, title, score, max_score, assessment_date, teacher_comment, ' +
        'subject:subject_id(name), teacher:teacher_id(full_name)'
    )
    .eq('student_id', user.id)
    .order('assessment_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    score: Number(row.score),
    max_score: Number(row.max_score),
    assessment_date: row.assessment_date,
    teacher_comment: row.teacher_comment,
    subject_name: row.subject?.name ?? '—',
    teacher_name: row.teacher?.full_name ?? '—',
    percentage: row.max_score > 0 ? (row.score / row.max_score) * 100 : 0,
  }));
}

/**
 * Returns assessments for a specific child, for use by a parent.
 * RLS policy `assessments_select_parent` enforces is_parent_of(student_id).
 */
export async function getChildAssessments(
  childId: string
): Promise<StudentAssessment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assessments')
    .select(
      'id, title, score, max_score, assessment_date, teacher_comment, ' +
        'subject:subject_id(name), teacher:teacher_id(full_name)'
    )
    .eq('student_id', childId)
    .order('assessment_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    score: Number(row.score),
    max_score: Number(row.max_score),
    assessment_date: row.assessment_date,
    teacher_comment: row.teacher_comment,
    subject_name: row.subject?.name ?? '—',
    teacher_name: row.teacher?.full_name ?? '—',
    percentage: row.max_score > 0 ? (row.score / row.max_score) * 100 : 0,
  }));
}