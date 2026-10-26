'use server';

import { createClient } from '@/lib/supabase/server';

export type LinkStatus = 'pending' | 'approved' | 'declined' | 'revoked';

export interface TeacherStudentLink {
  id: string;
  teacher_id: string;
  student_id: string;
  requested_by: string;
  status: LinkStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  // Joined display fields (populated by the query)
  teacher_name?: string;
  student_name?: string;
}

// =========================================================
// Teacher side
// =========================================================

/**
 * Teacher requests a link to a student by email.
 * Returns the new link row, or an error message.
 */
export async function requestStudentLink(
  studentEmail: string
): Promise<{ link?: TeacherStudentLink; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  // Look up the student by email in profiles
  // (profiles doesn't store email; we need auth.users for that.
  //  So instead, ask the user for the student_id — but email is more usable,
  //  so we use a security-definer function that lives in Postgres.)
  const { data: student, error: lookupError } = await supabase
    .rpc('find_profile_by_email', { email_input: studentEmail.trim().toLowerCase() });

  if (lookupError) return { error: lookupError.message };
  if (!student || student.length === 0) {
    return { error: 'No user found with that email.' };
  }
  const studentId = student[0].id as string;
  const studentRole = student[0].role as string;
  if (studentRole !== 'student') {
    return { error: 'That email does not belong to a student account.' };
  }

  const { data: link, error: insertError } = await supabase
    .from('teacher_student_links')
    .insert({
      teacher_id: user.id,
      student_id: studentId,
      requested_by: user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'A link request already exists for this student.' };
    }
    return { error: insertError.message };
  }

  return { link: link as TeacherStudentLink };
}

/**
 * Returns all links (any status) where the current user is the teacher,
 * joined with the student's name.
 */
export async function getLinksForTeacher(): Promise<TeacherStudentLink[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teacher_student_links')
    .select('*, student:student_id(full_name)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    student_name: row.student?.full_name ?? 'Unknown student',
  }));
}

// =========================================================
// Student / Parent side
// =========================================================

/**
 * Returns all links naming the current user (as student)
 * or their linked children (as parent), joined with teacher name.
 */
export async function getIncomingLinks(): Promise<TeacherStudentLink[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teacher_student_links')
    .select('*, teacher:teacher_id(full_name), student:student_id(full_name)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    teacher_name: row.teacher?.full_name ?? 'Unknown teacher',
    student_name: row.student?.full_name ?? 'Unknown student',
  }));
}

/**
 * Approve or decline a pending link. Called by student or parent.
 */
export async function decideLink(
  linkId: string,
  decision: 'approved' | 'declined'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('teacher_student_links')
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq('id', linkId)
    .eq('status', 'pending'); // only pending links can be decided

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Revoke an already-approved link. Called by parent, student, or teacher.
 */
export async function revokeLink(
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('teacher_student_links')
    .update({
      status: 'revoked',
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq('id', linkId)
    .eq('status', 'approved');

  if (error) return { success: false, error: error.message };
  return { success: true };
}