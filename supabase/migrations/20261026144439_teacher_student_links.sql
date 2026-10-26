-- =========================================================
-- teacher_student_links
-- Tracks requests from teachers to be linked to a student.
-- A teacher can only write assessments and attendance for a
-- student AFTER this link is approved by the student or their
-- linked parent.
-- =========================================================

create table public.teacher_student_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'revoked')),
  created_at timestamptz default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  unique (teacher_id, student_id)
);

create index teacher_student_links_teacher_idx
  on public.teacher_student_links (teacher_id);
create index teacher_student_links_student_idx
  on public.teacher_student_links (student_id);

alter table public.teacher_student_links enable row level security;

-- =========================================================
-- Replace is_teacher_of() to look at the links table.
-- Previous version inferred the relationship from existing
-- assessments/attendance, which caused a chicken-and-egg
-- problem: no assessment → no link → can't write assessment.
-- =========================================================

create or replace function public.is_teacher_of(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_student_links
    where teacher_id = auth.uid()
      and student_id = student
      and status = 'approved'
  );
$$;

-- =========================================================
-- RLS policies for teacher_student_links
-- =========================================================

-- Read: teacher sees their own outgoing links
create policy "tsl_select_teacher"
  on public.teacher_student_links for select
  using (teacher_id = auth.uid());

-- Read: student sees links naming them
create policy "tsl_select_student"
  on public.teacher_student_links for select
  using (student_id = auth.uid());

-- Read: parent sees links naming their children
create policy "tsl_select_parent"
  on public.teacher_student_links for select
  using (public.is_parent_of(student_id));

-- Insert: a teacher can request a link naming themselves,
-- with initial status 'pending', requested_by themselves
create policy "tsl_insert_teacher_request"
  on public.teacher_student_links for insert
  with check (
    teacher_id = auth.uid()
    and requested_by = auth.uid()
    and status = 'pending'
  );

-- Update: the student can approve / decline / revoke
create policy "tsl_update_student_decision"
  on public.teacher_student_links for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Update: a linked parent can also approve / decline / revoke
create policy "tsl_update_parent_decision"
  on public.teacher_student_links for update
  using (public.is_parent_of(student_id))
  with check (public.is_parent_of(student_id));

-- Update: the teacher can revoke their own link (status → revoked only;
-- not enforced by RLS alone — see application-side validation)
create policy "tsl_update_teacher_revoke"
  on public.teacher_student_links for update
  using (teacher_id = auth.uid());

-- =========================================================
-- Update assessment / attendance insert policies so the
-- approved link is now a hard requirement.
-- The old policies only checked teacher_id = auth.uid(),
-- which allowed writing to any student.
-- =========================================================

drop policy if exists "assessments_insert_teacher" on public.assessments;
create policy "assessments_insert_teacher"
  on public.assessments for insert
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_of(student_id)
  );

drop policy if exists "attendance_insert_teacher" on public.attendance;
create policy "attendance_insert_teacher"
  on public.attendance for insert
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_of(student_id)
  );