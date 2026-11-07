'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  Enquiry,
  SendEnquiryInput,
} from '@/lib/supabase/enquiries-utils';

/**
 * Parent sends an enquiry to a listed tutor for one of their children.
 * The database checks the parent-child link, the tutor listing and duplicates.
 */
export async function sendEnquiry(
  input: SendEnquiryInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_enquiry', {
    p_teacher: input.teacher_id,
    p_child: input.child_id,
    p_subject: input.subject_id,
    p_message: input.message,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Enquiries the signed-in parent has sent, or the signed-in teacher has received.
 */
export async function getMyEnquiries(): Promise<{
  me: string | null;
  role: string | null;
  enquiries: Enquiry[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { me: null, role: null, enquiries: [] };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase.rpc('my_enquiries');
  if (error || !data) {
    return { me: user.id, role: profile?.role ?? null, enquiries: [] };
  }
  return {
    me: user.id,
    role: profile?.role ?? null,
    enquiries: data as Enquiry[],
  };
}

/**
 * Parent cancels their own pending enquiry.
 */
export async function cancelEnquiry(
  enquiryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_enquiry', { p_id: enquiryId });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Teacher accepts or declines. Accepting links the child to the teacher.
 */
export async function respondToEnquiry(
  enquiryId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_enquiry', {
    p_id: enquiryId,
    p_accept: accept,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Number of pending enquiries for the signed-in teacher (dashboard badge).
 */
export async function getPendingEnquiryCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pending_enquiry_count');
  if (error) return 0;
  return Number(data ?? 0);
}