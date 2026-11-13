'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  AdminReport,
  AdminStats,
  AdminTutor,
} from '@/lib/supabase/admin-utils';

/**
 * Platform numbers for the admin dashboard.
 * The database rejects anyone who is not a platform admin.
 */
export async function getAdminStats(): Promise<{
  stats?: AdminStats;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: 'No data.' };
  return {
    stats: {
      parents: Number(row.parents),
      students: Number(row.students),
      teachers: Number(row.teachers),
      listed_tutors: Number(row.listed_tutors),
      verified_tutors: Number(row.verified_tutors),
      pending_verifications: Number(row.pending_verifications),
      open_reports: Number(row.open_reports),
      pending_enquiries: Number(row.pending_enquiries),
      active_teacher_links: Number(row.active_teacher_links),
    },
  };
}

export async function getAdminTutors(): Promise<{
  tutors: AdminTutor[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_tutors');
  if (error) return { tutors: [], error: error.message };
  return { tutors: (data ?? []) as AdminTutor[] };
}

export async function setTutorVerification(
  teacherId: string,
  status: 'unverified' | 'pending' | 'verified'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_verification', {
    p_teacher: teacherId,
    p_status: status,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function unlistTutor(
  teacherId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_unlist_tutor', {
    p_teacher: teacherId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getAdminReports(): Promise<{
  reports: AdminReport[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_reports');
  if (error) return { reports: [], error: error.message };
  return { reports: (data ?? []) as AdminReport[] };
}

export async function resolveReport(
  reportId: string,
  status: 'reviewed' | 'dismissed'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_id: reportId,
    p_status: status,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}