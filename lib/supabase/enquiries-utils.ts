// Plain types and constants (no 'use server') so server and client code can share them.

export const MAX_ENQUIRY_MESSAGE_LENGTH = 1000;

export type EnquiryStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Enquiry {
  id: string;
  parent_id: string;
  parent_name: string;
  child_id: string;
  child_name: string;
  teacher_id: string;
  teacher_name: string;
  subject_name: string | null;
  message: string | null;
  status: EnquiryStatus;
  created_at: string;
  responded_at: string | null;
}

export interface SendEnquiryInput {
  teacher_id: string;
  child_id: string;
  subject_id: string | null;
  message: string;
}

export function enquiryStatusLabel(status: EnquiryStatus): string {
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending';
}

export function enquiryStatusClass(status: EnquiryStatus): string {
  if (status === 'accepted') return 'bg-green-100 text-green-800';
  if (status === 'declined') return 'bg-red-100 text-red-800';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-yellow-100 text-yellow-800';
}