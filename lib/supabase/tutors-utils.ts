// Plain helpers and types (no 'use server') so server and client code can share them.

export type TeachingMode = 'online' | 'in_person' | 'both';
export type VerificationStatus = 'unverified' | 'pending' | 'verified';
export type TutorSort = 'fee_asc' | 'fee_desc' | 'verified';

export interface TutorCard {
  id: string;
  full_name: string;
  bio: string | null;
  qualification: string | null;
  teaching_mode: TeachingMode | null;
  hourly_fee_pkr: number | null;
  city: string | null;
  area: string | null;
  grade_min: number | null;
  grade_max: number | null;
  verification_status: VerificationStatus;
  subjects: string[];
}

export interface TutorFilters {
  subject?: string;
  grade?: number;
  mode?: 'online' | 'in_person';
  max_fee?: number;
  city?: string;
  area?: string;
  q?: string;
  sort?: TutorSort;
}

export interface MyTutorProfile {
  id: string;
  bio: string | null;
  qualification: string | null;
  teaching_mode: TeachingMode | null;
  hourly_fee_pkr: number | null;
  city: string | null;
  area: string | null;
  grade_min: number | null;
  grade_max: number | null;
  is_listed: boolean;
  verification_status: VerificationStatus;
  subject_ids: string[];
}

export interface SaveTutorProfileInput {
  bio: string;
  qualification: string;
  teaching_mode: TeachingMode | null;
  hourly_fee_pkr: number | null;
  city: string;
  area: string;
  grade_min: number | null;
  grade_max: number | null;
  subject_ids: string[];
  is_listed: boolean;
}

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export const MAX_BIO_LENGTH = 1000;
export const MIN_LISTING_BIO_LENGTH = 20;

export const CITY_SUGGESTIONS = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sargodha',
  'Jauharabad',
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function modeLabel(mode: TeachingMode | null): string {
  if (mode === 'online') return 'Online';
  if (mode === 'in_person') return 'In person';
  if (mode === 'both') return 'Online & in person';
  return 'Not set';
}

export function verificationLabel(status: VerificationStatus): string {
  if (status === 'verified') return 'Verified';
  if (status === 'pending') return 'Verification pending';
  return 'Not yet verified';
}

export function formatFee(fee: number | null): string {
  if (fee === null || fee === undefined) return 'Fee not set';
  return `Rs ${fee.toLocaleString('en-US')} / hour`;
}

export function formatGrades(min: number | null, max: number | null): string {
  if (min === null || max === null) return 'Classes not set';
  return min === max ? `Class ${min}` : `Classes ${min}–${max}`;
}

export function formatLocation(
  mode: TeachingMode | null,
  city: string | null,
  area: string | null
): string {
  const place = [area, city].filter(Boolean).join(', ');
  if (mode === 'online') return place ? `Online (based in ${place})` : 'Online';
  return place || 'Location not set';
}

// ---------------------------------------------------------
// Search-form parsing
// ---------------------------------------------------------
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface SearchFormValues {
  subject: string;
  grade: string;
  mode: string;
  max_fee: string;
  city: string;
  area: string;
  q: string;
  sort: string;
}

function first(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? '').trim();
}

/**
 * Turns the URL query string into validated filters (for the database call)
 * plus the cleaned strings to show back in the form.
 */
export function parseTutorFilters(raw: RawSearchParams): {
  filters: TutorFilters;
  values: SearchFormValues;
} {
  const subject = first(raw.subject);
  const gradeNum = Number(first(raw.grade));
  const feeNum = Number(first(raw.max_fee));
  const mode = first(raw.mode);
  const sort = first(raw.sort);

  const filters: TutorFilters = {};
  const values: SearchFormValues = {
    subject: '',
    grade: '',
    mode: '',
    max_fee: '',
    city: '',
    area: '',
    q: '',
    sort: 'fee_asc',
  };

  if (isUuid(subject)) {
    filters.subject = subject;
    values.subject = subject;
  }
  if (Number.isInteger(gradeNum) && gradeNum >= 1 && gradeNum <= 12) {
    filters.grade = gradeNum;
    values.grade = String(gradeNum);
  }
  if (mode === 'online' || mode === 'in_person') {
    filters.mode = mode;
    values.mode = mode;
  }
  if (first(raw.max_fee) !== '' && Number.isFinite(feeNum) && feeNum >= 0) {
    filters.max_fee = Math.min(Math.floor(feeNum), 100000);
    values.max_fee = String(filters.max_fee);
  }

  const city = first(raw.city).slice(0, 80);
  if (city) {
    filters.city = city;
    values.city = city;
  }
  const area = first(raw.area).slice(0, 80);
  if (area) {
    filters.area = area;
    values.area = area;
  }
  const q = first(raw.q).slice(0, 80);
  if (q) {
    filters.q = q;
    values.q = q;
  }

  if (sort === 'fee_desc' || sort === 'verified' || sort === 'fee_asc') {
    filters.sort = sort;
    values.sort = sort;
  }

  return { filters, values };
}