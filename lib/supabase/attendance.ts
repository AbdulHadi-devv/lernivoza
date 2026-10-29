'use server';

import { createClient } from '@/lib/supabase/server';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  status: AttendanceStatus;
  class_date: string;
  notes: string | null;
  created_at: string;
  student_name?: string;
  teacher_name?: string;
}

export interface CreateAttendanceInput {
  student_id: string;
  status: AttendanceStatus;
  class_date: string;
  notes?: string;
}

/**
 * Records an attendance entry for an approved student.
 * The RLS policy `attendance_insert_teacher` requires
 * teacher_id = auth.uid() AND is_teacher_of(student_id).
 */
export async function recordAttendance(
  input: CreateAttendanceInput
): Promise<{ record?: AttendanceRecord; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  if (!['present', 'absent', 'late', 'excused'].includes(input.status)) {
    return { error: 'Invalid attendance status.' };
  }
  if (!input.class_date) {
    return { error: 'Please choose a class date.' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.class_date > today) {
    return { error: 'Class date cannot be in the future.' };
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      student_id: input.student_id,
      teacher_id: user.id,
      status: input.status,
      class_date: input.class_date,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      return {
        error:
          'You can only record attendance for students you are linked to. ' +
          'Ask the student or their parent to approve your link request.',
      };
    }
    return { error: error.message };
  }

  return { record: data as AttendanceRecord };
}

/**
 * Returns all attendance entries created by the current teacher,
 * with the student name joined.
 */
export async function getAttendanceByTeacher(): Promise<AttendanceRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('attendance')
    .select('*, student:student_id(full_name)')
    .eq('teacher_id', user.id)
    .order('class_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    student_name: row.student?.full_name ?? 'Unknown student',
  }));
}

/**
 * Returns all attendance entries for the current student.
 */
export async function getMyAttendance(): Promise<AttendanceRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('attendance')
    .select('*, teacher:teacher_id(full_name)')
    .eq('student_id', user.id)
    .order('class_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    teacher_name: row.teacher?.full_name ?? 'Unknown teacher',
  }));
}

/**
 * Returns attendance entries for a specific child (parent view).
 * RLS `attendance_select_parent` allows this if the parent is linked to the child.
 */
export async function getChildAttendance(
  childId: string
): Promise<AttendanceRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('attendance')
    .select('*, teacher:teacher_id(full_name)')
    .eq('student_id', childId)
    .order('class_date', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    teacher_name: row.teacher?.full_name ?? 'Unknown teacher',
  }));
}