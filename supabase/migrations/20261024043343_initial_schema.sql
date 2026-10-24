-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'student', 'teacher', 'institute_admin', 'platform_admin')),
  full_name text not null,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Parent-child link
create table public.parent_child_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  created_at timestamptz default now(),
  unique(parent_id, child_id)
);

-- 3. Subjects
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- 4. Teacher profiles
create table public.teacher_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  qualification text,
  teaching_mode text check (teaching_mode in ('online', 'in_person', 'both')),
  verification_status text default 'unverified' check (verification_status in ('unverified', 'pending', 'verified')),
  created_at timestamptz default now()
);

-- 5. Teacher-subject relationship
create table public.teacher_subjects (
  teacher_id uuid references public.teacher_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

-- 6. Assessments (marks)
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id),
  subject_id uuid references public.subjects(id),
  title text not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  assessment_date date not null,
  teacher_comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_score check (score <= max_score)
);

-- 7. Attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(id),
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  class_date date not null,
  notes text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.parent_child_links enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.attendance enable row level security;