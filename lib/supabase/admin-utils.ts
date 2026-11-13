// Plain types (no 'use server') so server and client code can share them.

import type {
  TeachingMode,
  VerificationStatus,
} from '@/lib/supabase/tutors-utils';

export interface AdminStats {
  parents: number;
  students: number;
  teachers: number;
  listed_tutors: number;
  verified_tutors: number;
  pending_verifications: number;
  open_reports: number;
  pending_enquiries: number;
  active_teacher_links: number;
}

export interface AdminTutor {
  id: string;
  full_name: string;
  qualification: string | null;
  bio: string | null;
  teaching_mode: TeachingMode | null;
  hourly_fee_pkr: number | null;
  city: string | null;
  area: string | null;
  grade_min: number | null;
  grade_max: number | null;
  is_listed: boolean;
  verification_status: VerificationStatus;
  verified_at: string | null;
  updated_at: string;
  subjects: string[];
}

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface AdminReport {
  id: string;
  status: ReportStatus;
  reason: string;
  created_at: string;
  reviewed_at: string | null;
  message_id: string;
  message_body: string;
  message_sent_at: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  reporter_id: string;
  reporter_name: string;
}