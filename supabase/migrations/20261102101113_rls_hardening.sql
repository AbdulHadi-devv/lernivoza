-- =========================================================
-- RLS hardening
--
-- Closes gaps where a signed-in user could call the public API
-- directly to skip the approval workflow or change protected fields.
--
-- The guard triggers only apply to signed-in users (auth.uid() is
-- not null), so the Supabase SQL Editor can still repair data.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Helper: role of the signed-in user (own row only)
-- ---------------------------------------------------------
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------
-- 1. profiles: signup can only pick parent / student / teacher,
--    and the role cannot be changed afterwards
-- ---------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (
    id = auth.uid()
    and role in ('parent', 'student', 'teacher')
  );

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'An account role cannot be changed.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------
-- 2. teacher_student_links: no self-approval
-- ---------------------------------------------------------
alter table public.teacher_student_links
  add constraint tsl_not_self check (teacher_id <> student_id);

-- Only teachers can request a link
drop policy if exists "tsl_insert_teacher_request" on public.teacher_student_links;
create policy "tsl_insert_teacher_request"
  on public.teacher_student_links for insert
  with check (
    teacher_id = auth.uid()
    and requested_by = auth.uid()
    and status = 'pending'
    and public.my_role() = 'teacher'
  );

-- A teacher may only cancel a pending request or revoke an approved link
drop policy if exists "tsl_update_teacher_revoke" on public.teacher_student_links;
create policy "tsl_update_teacher_revoke"
  on public.teacher_student_links for update
  using (teacher_id = auth.uid() and status in ('pending', 'approved'))
  with check (teacher_id = auth.uid() and status = 'revoked');

-- Status transitions are enforced here for every caller
create or replace function public.guard_teacher_student_link_update()
returns trigger
language plpgsql
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return new;
  end if;

  if new.teacher_id is distinct from old.teacher_id
     or new.student_id is distinct from old.student_id
     or new.requested_by is distinct from old.requested_by then
    raise exception 'The people on a link cannot be changed.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('approved', 'declined') then
      if old.status <> 'pending' then
        raise exception 'Only pending requests can be approved or declined.'
          using errcode = '42501';
      end if;
      if not (caller = old.student_id or public.is_parent_of(old.student_id)) then
        raise exception 'Only the student or their parent can approve or decline a request.'
          using errcode = '42501';
      end if;
    elsif new.status = 'revoked' then
      if old.status not in ('pending', 'approved') then
        raise exception 'This link can no longer be revoked.'
          using errcode = '42501';
      end if;
      if not (
        caller = old.teacher_id
        or caller = old.student_id
        or public.is_parent_of(old.student_id)
      ) then
        raise exception 'You are not part of this link.'
          using errcode = '42501';
      end if;
    else
      raise exception 'A link cannot be moved back to pending.'
        using errcode = '42501';
    end if;

    -- Audit fields are set by the database, not by the client
    new.decided_at := now();
    new.decided_by := caller;
  else
    new.decided_at := old.decided_at;
    new.decided_by := old.decided_by;
  end if;

  return new;
end;
$$;

create trigger tsl_guard_update
  before update on public.teacher_student_links
  for each row execute function public.guard_teacher_student_link_update();

-- ---------------------------------------------------------
-- 3. parent_child_links: allow 'declined', let parents revoke,
--    enforce transitions
-- ---------------------------------------------------------
alter table public.parent_child_links
  drop constraint if exists parent_child_links_status_check;
alter table public.parent_child_links
  add constraint parent_child_links_status_check
  check (status in ('pending', 'approved', 'declined', 'revoked'));

alter table public.parent_child_links
  add constraint pcl_not_self check (parent_id <> child_id);

drop policy if exists "links_insert_own_pending" on public.parent_child_links;
create policy "links_insert_own_pending"
  on public.parent_child_links for insert
  with check (
    parent_id = auth.uid()
    and status = 'pending'
    and public.my_role() = 'parent'
  );

drop policy if exists "links_update_by_child" on public.parent_child_links;
create policy "links_update_by_child"
  on public.parent_child_links for update
  using (child_id = auth.uid())
  with check (child_id = auth.uid());

-- A parent can only revoke (never approve) a link
create policy "links_update_by_parent_revoke"
  on public.parent_child_links for update
  using (parent_id = auth.uid() and status in ('pending', 'approved'))
  with check (parent_id = auth.uid() and status = 'revoked');

create or replace function public.guard_parent_child_link_update()
returns trigger
language plpgsql
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return new;
  end if;

  if new.parent_id is distinct from old.parent_id
     or new.child_id is distinct from old.child_id then
    raise exception 'The people on a link cannot be changed.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('approved', 'declined') then
      if old.status <> 'pending' then
        raise exception 'Only pending requests can be approved or declined.'
          using errcode = '42501';
      end if;
      if caller <> old.child_id then
        raise exception 'Only the child can approve or decline a parent request.'
          using errcode = '42501';
      end if;
    elsif new.status = 'revoked' then
      if old.status not in ('pending', 'approved') then
        raise exception 'This link can no longer be revoked.'
          using errcode = '42501';
      end if;
      if caller not in (old.parent_id, old.child_id) then
        raise exception 'You are not part of this link.'
          using errcode = '42501';
      end if;
    else
      raise exception 'A link cannot be moved back to pending.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger pcl_guard_update
  before update on public.parent_child_links
  for each row execute function public.guard_parent_child_link_update();

-- ---------------------------------------------------------
-- 4. assessments / attendance / assignments:
--    a teacher cannot move a record to a student they are not linked to
-- ---------------------------------------------------------
drop policy if exists "assessments_update_teacher" on public.assessments;
create policy "assessments_update_teacher"
  on public.assessments for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and public.is_teacher_of(student_id));

drop policy if exists "attendance_update_teacher" on public.attendance;
create policy "attendance_update_teacher"
  on public.attendance for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and public.is_teacher_of(student_id));

drop policy if exists "assignments_update_teacher" on public.assignments;
create policy "assignments_update_teacher"
  on public.assignments for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and public.is_teacher_of(student_id));

create or replace function public.lock_record_parties()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.student_id is distinct from old.student_id
          or new.teacher_id is distinct from old.teacher_id) then
    raise exception 'The student and teacher on a record cannot be changed.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger assessments_lock_parties
  before update on public.assessments
  for each row execute function public.lock_record_parties();

create trigger attendance_lock_parties
  before update on public.attendance
  for each row execute function public.lock_record_parties();

create trigger assignments_lock_parties
  before update on public.assignments
  for each row execute function public.lock_record_parties();

-- ---------------------------------------------------------
-- 5. assignment_submissions
--    a) the submission row is created by the database, in the same
--       transaction as the assignment (no orphans)
--    b) students can only move assigned -> submitted and add notes;
--       only the teacher can grade
-- ---------------------------------------------------------
drop policy if exists "submissions_insert_teacher" on public.assignment_submissions;

create or replace function public.create_submission_for_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assignment_submissions (assignment_id, student_id, status)
  values (new.id, new.student_id, 'assigned');
  return new;
end;
$$;

create trigger assignments_create_submission
  after insert on public.assignments
  for each row execute function public.create_submission_for_assignment();

create or replace function public.guard_submission_update()
returns trigger
language plpgsql
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return new;
  end if;

  if new.assignment_id is distinct from old.assignment_id
     or new.student_id is distinct from old.student_id then
    raise exception 'A submission cannot be moved to another assignment or student.'
      using errcode = '42501';
  end if;

  if caller = old.student_id then
    -- Student rules
    if new.teacher_grade is distinct from old.teacher_grade
       or new.teacher_feedback is distinct from old.teacher_feedback then
      raise exception 'Students cannot change grades or feedback.'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if old.status = 'assigned' and new.status = 'submitted' then
        new.submitted_at := now();
      else
        raise exception 'Students can only mark an assigned item as submitted.'
          using errcode = '42501';
      end if;
    elsif new.submitted_at is distinct from old.submitted_at then
      raise exception 'The submission time cannot be edited.'
        using errcode = '42501';
    end if;

    if old.status <> 'assigned'
       and new.submission_notes is distinct from old.submission_notes then
      raise exception 'Notes cannot be changed after submitting.'
        using errcode = '42501';
    end if;
  else
    -- Teacher rules
    if new.submission_notes is distinct from old.submission_notes
       or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Teachers cannot edit the student''s submission.'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if not (new.status = 'graded' and old.status in ('submitted', 'graded')) then
        raise exception 'A teacher can only grade a submitted assignment.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger submissions_guard_update
  before update on public.assignment_submissions
  for each row execute function public.guard_submission_update();

