'use server';

import { createClient } from '@/lib/supabase/server';

export interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  resource_url: string | null;
  issue_date: string;
  due_date: string;
  created_at: string;
  // Joined display fields
  student_name?: string;
  subject_name?: string;
  teacher_name?: string;
  submission_status?: 'assigned' | 'submitted' | 'graded';
  submission_id?: string;
  submitted_at?: string | null;
}

export interface CreateAssignmentInput {
  student_id: string;
  subject_id: string;
  title: string;
  description?: string;
  resource_url?: string;
  issue_date: string;
  due_date: string;
}

/**
 * Teacher creates an assignment and an associated submission row.
 */
export async function createAssignment(
  input: CreateAssignmentInput
): Promise<{ assignment?: Assignment; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  if (!input.title.trim()) return { error: 'Title is required.' };
  if (!input.subject_id) return { error: 'Please choose a subject.' };
  if (!input.issue_date) return { error: 'Issue date is required.' };
  if (!input.due_date) return { error: 'Due date is required.' };
  if (input.due_date < input.issue_date) {
    return { error: 'Due date cannot be before the issue date.' };
  }
  if (input.resource_url && !/^https?:\/\//i.test(input.resource_url.trim())) {
    return { error: 'Resource link must start with http:// or https://.' };
  }

  // 1. Create the assignment
  const { data: assignment, error: assignError } = await supabase
    .from('assignments')
    .insert({
      teacher_id: user.id,
      student_id: input.student_id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      resource_url: input.resource_url?.trim() || null,
      issue_date: input.issue_date,
      due_date: input.due_date,
    })
    .select()
    .single();

  if (assignError) {
    if (assignError.code === '42501') {
      return {
        error:
          'You can only create assignments for students you are linked to.',
      };
    }
    return { error: assignError.message };
  }

  // 2. Create the submission row
  const { error: subError } = await supabase
    .from('assignment_submissions')
    .insert({
      assignment_id: assignment.id,
      student_id: input.student_id,
      status: 'assigned',
    });

  if (subError) {
    // Roll back the assignment row so we don't leave a stranded record
    await supabase.from('assignments').delete().eq('id', assignment.id);
    return { error: `Failed to create submission: ${subError.message}` };
  }

  return { assignment: assignment as Assignment };
}

/**
 * Teacher's assignments with student name, subject name, and submission status.
 */
export async function getAssignmentsByTeacher(): Promise<Assignment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, title, description, resource_url, issue_date, due_date, created_at, teacher_id, student_id, subject_id, ' +
        'student:student_id(full_name), subject:subject_id(name), ' +
        'submission:assignment_submissions(status, id, submitted_at)'
    )
    .eq('teacher_id', user.id)
    .order('due_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const sub = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    return {
      ...row,
      student_name: row.student?.full_name ?? 'Unknown',
      subject_name: row.subject?.name ?? '—',
      submission_status: sub?.status,
      submission_id: sub?.id,
      submitted_at: sub?.submitted_at,
    };
  });
}

/**
 * Student's assignments with teacher/subject names and submission status.
 */
export async function getMyAssignments(): Promise<Assignment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, title, description, resource_url, issue_date, due_date, created_at, teacher_id, student_id, subject_id, ' +
        'teacher:teacher_id(full_name), subject:subject_id(name), ' +
        'submission:assignment_submissions(status, id, submitted_at, submission_notes)'
    )
    .eq('student_id', user.id)
    .order('due_date', { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => {
    const sub = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    return {
      ...row,
      teacher_name: row.teacher?.full_name ?? 'Unknown',
      subject_name: row.subject?.name ?? '—',
      submission_status: sub?.status,
      submission_id: sub?.id,
      submitted_at: sub?.submitted_at,
    };
  });
}

/**
 * Student marks an assignment as submitted. Only works on 'assigned' status.
 */
export async function markAssignmentSubmitted(
  assignmentId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submission_notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .eq('status', 'assigned');

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Parent view: all assignments for a child.
 */
export async function getChildAssignments(
  childId: string
): Promise<Assignment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, title, description, resource_url, issue_date, due_date, created_at, teacher_id, student_id, subject_id, ' +
        'teacher:teacher_id(full_name), subject:subject_id(name), ' +
        'submission:assignment_submissions(status, id, submitted_at)'
    )
    .eq('student_id', childId)
    .order('due_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const sub = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    return {
      ...row,
      teacher_name: row.teacher?.full_name ?? 'Unknown',
      subject_name: row.subject?.name ?? '—',
      submission_status: sub?.status,
      submission_id: sub?.id,
      submitted_at: sub?.submitted_at,
    };
  });
}