'use server';

import { createClient } from '@/lib/supabase/server';
import {
  GRADES,
  MAX_BIO_LENGTH,
  MIN_LISTING_BIO_LENGTH,
  type MyTutorProfile,
  type SaveTutorProfileInput,
  type TutorCard,
  type TutorFilters,
} from '@/lib/supabase/tutors-utils';

export interface SubjectOption {
  id: string;
  name: string;
}

/**
 * Public search. Works for signed-out visitors too.
 */
export async function searchTutors(filters: TutorFilters): Promise<TutorCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_tutors', {
    p_subject: filters.subject ?? null,
    p_grade: filters.grade ?? null,
    p_mode: filters.mode ?? null,
    p_max_fee: filters.max_fee ?? null,
    p_city: filters.city ?? null,
    p_area: filters.area ?? null,
    p_query: filters.q ?? null,
    p_sort: filters.sort ?? 'fee_asc',
    p_limit: 24,
    p_offset: 0,
  });
  if (error || !data) return [];
  return data as TutorCard[];
}

/**
 * One listed tutor, or null when the profile does not exist or is not listed.
 */
export async function getTutor(id: string): Promise<TutorCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_tutor', { p_id: id });
  if (error || !data || data.length === 0) return null;
  return data[0] as TutorCard;
}

export async function getSubjects(): Promise<SubjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data as SubjectOption[];
}

export async function getListedCities(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('listed_cities');
  if (error || !data) return [];
  return data as string[];
}

/**
 * The signed-in teacher's own profile (null if they have not created one yet).
 */
export async function getMyTutorProfile(): Promise<MyTutorProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('teacher_profiles')
    .select(
      'id, bio, qualification, teaching_mode, hourly_fee_pkr, city, area, grade_min, grade_max, is_listed, verification_status'
    )
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: subjectRows } = await supabase
    .from('teacher_subjects')
    .select('subject_id')
    .eq('teacher_id', user.id);

  return {
    ...(profile as Omit<MyTutorProfile, 'subject_ids'>),
    subject_ids: (subjectRows ?? []).map((r: { subject_id: string }) => r.subject_id),
  };
}

/**
 * Create or update the signed-in teacher's profile and subjects.
 * Order matters: fields first, then subjects, then the "listed" switch,
 * so the database can check that a listed profile is complete.
 */
export async function saveMyTutorProfile(
  input: SaveTutorProfileInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const bio = input.bio.trim();
  const qualification = input.qualification.trim();
  const city = input.city.trim();
  const area = input.area.trim();

  // ---- Validation ----
  if (bio.length > MAX_BIO_LENGTH) {
    return { success: false, error: `Bio can be at most ${MAX_BIO_LENGTH} characters.` };
  }
  if (qualification.length > 200) {
    return { success: false, error: 'Qualification can be at most 200 characters.' };
  }
  if (city.length > 80 || area.length > 80) {
    return { success: false, error: 'City and area can be at most 80 characters.' };
  }
  if (
    input.hourly_fee_pkr !== null &&
    (!Number.isInteger(input.hourly_fee_pkr) ||
      input.hourly_fee_pkr < 0 ||
      input.hourly_fee_pkr > 100000)
  ) {
    return { success: false, error: 'Fee must be a whole number between 0 and 100,000.' };
  }
  const { grade_min, grade_max } = input;
  if ((grade_min === null) !== (grade_max === null)) {
    return { success: false, error: 'Set both the first and last class you teach.' };
  }
  if (grade_min !== null && grade_max !== null) {
    if (!GRADES.includes(grade_min) || !GRADES.includes(grade_max)) {
      return { success: false, error: 'Classes must be between 1 and 12.' };
    }
    if (grade_min > grade_max) {
      return { success: false, error: 'The first class cannot be higher than the last class.' };
    }
  }
  if (input.is_listed) {
    if (bio.length < MIN_LISTING_BIO_LENGTH) {
      return { success: false, error: `Write a bio of at least ${MIN_LISTING_BIO_LENGTH} characters to list your profile.` };
    }
    if (input.subject_ids.length === 0) {
      return { success: false, error: 'Choose at least one subject to list your profile.' };
    }
    if (input.hourly_fee_pkr === null) {
      return { success: false, error: 'Set your hourly fee to list your profile.' };
    }
    if (!input.teaching_mode) {
      return { success: false, error: 'Choose how you teach to list your profile.' };
    }
    if (grade_min === null || grade_max === null) {
      return { success: false, error: 'Set the classes you teach to list your profile.' };
    }
    if (!city) {
      return { success: false, error: 'Add your city to list your profile.' };
    }
  }

  const fields = {
    bio: bio || null,
    qualification: qualification || null,
    teaching_mode: input.teaching_mode,
    hourly_fee_pkr: input.hourly_fee_pkr,
    city: city || null,
    area: area || null,
    grade_min,
    grade_max,
  };

  // ---- 1. Profile fields (never listed yet at creation) ----
  const { data: existing } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('teacher_profiles')
      .update(fields)
      .eq('id', user.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('teacher_profiles')
      .insert({ id: user.id, ...fields });
    if (error) {
      if (error.code === '42501') {
        return { success: false, error: 'Only teacher accounts can create a tutor profile.' };
      }
      return { success: false, error: error.message };
    }
  }

  // ---- 2. Subjects: add new, remove unticked ----
  const { data: currentRows } = await supabase
    .from('teacher_subjects')
    .select('subject_id')
    .eq('teacher_id', user.id);
  const current = new Set((currentRows ?? []).map((r: { subject_id: string }) => r.subject_id));
  const wanted = new Set(input.subject_ids);

  const toAdd = [...wanted].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('teacher_subjects')
      .delete()
      .eq('teacher_id', user.id)
      .in('subject_id', toRemove);
    if (error) return { success: false, error: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('teacher_subjects')
      .insert(toAdd.map((subject_id) => ({ teacher_id: user.id, subject_id })));
    if (error) return { success: false, error: error.message };
  }

  // ---- 3. Listed switch (the database checks the profile is complete) ----
  const { error: listError } = await supabase
    .from('teacher_profiles')
    .update({ is_listed: input.is_listed })
    .eq('id', user.id);
  if (listError) return { success: false, error: listError.message };

  return { success: true, id: user.id };
}