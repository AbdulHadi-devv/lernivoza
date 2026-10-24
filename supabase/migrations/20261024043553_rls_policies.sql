-- =========================================================
-- Helper function: is the current user a parent of the given child?
-- =========================================================
create or replace function public.is_parent_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_child_links
    where parent_id = auth.uid()
      and child_id = child
      and status = 'approved'
  );
$$;

-- =========================================================
-- Helper function: is the current user a teacher of the given student?
-- A teacher is considered linked to a student if that teacher
-- has already recorded an assessment or attendance for them.
-- =========================================================
create or replace function public.is_teacher_of(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assessments a
    where a.teacher_id = auth.uid() and a.student_id = student
    union
    select 1 from public.attendance at
    where at.teacher_id = auth.uid() and at.student_id = student
  );
$$;

-- =========================================================
-- PROFILES
-- =========================================================
-- Read: your own row, or any profile you're authorized to see
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_select_linked_children"
  on public.profiles for select
  using (public.is_parent_of(id));

create policy "profiles_select_linked_students"
  on public.profiles for select
  using (public.is_teacher_of(id));

-- Insert: you can only create your own profile row
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- Update: your own row, but not the role column
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================
-- PARENT_CHILD_LINKS
-- =========================================================
-- Read: a parent sees their own links, a child sees links where they are the child
create policy "links_select_own"
  on public.parent_child_links for select
  using (parent_id = auth.uid() or child_id = auth.uid());

-- Insert: a parent can only create a link where they are the parent,
-- and the initial status must be 'pending'
create policy "links_insert_own_pending"
  on public.parent_child_links for insert
  with check (parent_id = auth.uid() and status = 'pending');

-- Update: only the child can approve or revoke a link
create policy "links_update_by_child"
  on public.parent_child_links for update
  using (child_id = auth.uid());

-- =========================================================
-- TEACHER_PROFILES
-- =========================================================
create policy "teacher_profiles_select_public"
  on public.teacher_profiles for select
  using (true);

create policy "teacher_profiles_insert_own"
  on public.teacher_profiles for insert
  with check (id = auth.uid());

create policy "teacher_profiles_update_own"
  on public.teacher_profiles for update
  using (id = auth.uid());

-- =========================================================
-- SUBJECTS  (public read; writes only via admin/service role)
-- =========================================================
create policy "subjects_select_public"
  on public.subjects for select
  using (true);

-- =========================================================
-- TEACHER_SUBJECTS
-- =========================================================
create policy "teacher_subjects_select_public"
  on public.teacher_subjects for select
  using (true);

create policy "teacher_subjects_insert_own"
  on public.teacher_subjects for insert
  with check (teacher_id = auth.uid());

create policy "teacher_subjects_delete_own"
  on public.teacher_subjects for delete
  using (teacher_id = auth.uid());

-- =========================================================
-- ASSESSMENTS
-- =========================================================
-- Read: a student sees their own, a parent sees their linked child's,
-- and a teacher sees ones they wrote
create policy "assessments_select_student"
  on public.assessments for select
  using (student_id = auth.uid());

create policy "assessments_select_parent"
  on public.assessments for select
  using (public.is_parent_of(student_id));

create policy "assessments_select_teacher"
  on public.assessments for select
  using (teacher_id = auth.uid());

-- Insert: a teacher can write only their own assessments
create policy "assessments_insert_teacher"
  on public.assessments for insert
  with check (teacher_id = auth.uid());

-- Update: teacher can only edit their own assessments
create policy "assessments_update_teacher"
  on public.assessments for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- No DELETE policy: assessments are never deleted, only corrected

-- =========================================================
-- ATTENDANCE
-- =========================================================
create policy "attendance_select_student"
  on public.attendance for select
  using (student_id = auth.uid());

create policy "attendance_select_parent"
  on public.attendance for select
  using (public.is_parent_of(student_id));

create policy "attendance_select_teacher"
  on public.attendance for select
  using (teacher_id = auth.uid());

create policy "attendance_insert_teacher"
  on public.attendance for insert
  with check (teacher_id = auth.uid());

create policy "attendance_update_teacher"
  on public.attendance for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());