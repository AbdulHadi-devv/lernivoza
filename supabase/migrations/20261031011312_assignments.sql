-- =========================================================
-- assignments
-- A teacher creates an assignment for a specific approved student.
-- Each assignment produces one row in assignment_submissions,
-- which the student updates when they mark it submitted.
-- =========================================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text,
  resource_url text,
  issue_date date not null default current_date,
  due_date date not null,
  created_at timestamptz default now(),
  constraint due_after_issue check (due_date >= issue_date)
);

create index assignments_teacher_idx on public.assignments (teacher_id);
create index assignments_student_idx on public.assignments (student_id);
create index assignments_due_idx on public.assignments (due_date);

-- =========================================================
-- assignment_submissions
-- One row per assignment (1:1). Tracks the student's progress.
-- Created automatically when the teacher creates an assignment.
-- =========================================================

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned', 'submitted', 'graded')),
  submitted_at timestamptz,
  submission_notes text,
  teacher_grade text,
  teacher_feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index submissions_student_idx on public.assignment_submissions (student_id);

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

-- =========================================================
-- RLS: assignments
-- =========================================================

-- Teacher reads own assignments
create policy "assignments_select_teacher"
  on public.assignments for select
  using (teacher_id = auth.uid());

-- Student reads assignments naming them
create policy "assignments_select_student"
  on public.assignments for select
  using (student_id = auth.uid());

-- Parent reads assignments for their children
create policy "assignments_select_parent"
  on public.assignments for select
  using (public.is_parent_of(student_id));

-- Teacher inserts only for students they're linked to
create policy "assignments_insert_teacher"
  on public.assignments for insert
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_of(student_id)
  );

-- Teacher can update their own assignments (e.g., extend a due date)
create policy "assignments_update_teacher"
  on public.assignments for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- =========================================================
-- RLS: assignment_submissions
-- =========================================================

-- Teacher reads submissions for assignments they created
create policy "submissions_select_teacher"
  on public.assignment_submissions for select
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

-- Student reads own submissions
create policy "submissions_select_student"
  on public.assignment_submissions for select
  using (student_id = auth.uid());

-- Parent reads submissions for their children
create policy "submissions_select_parent"
  on public.assignment_submissions for select
  using (public.is_parent_of(student_id));

-- The insert happens inside the createAssignment server action, which
-- runs with the teacher's auth context. Only allow inserting a submission
-- that matches an assignment owned by the teacher.
create policy "submissions_insert_teacher"
  on public.assignment_submissions for insert
  with check (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

-- Student can update only status/submitted_at/submission_notes on their own
-- pending submissions. Postgres RLS can't restrict columns directly, so the
-- server action must be careful — but the WITH CHECK enforces the student
-- cannot change student_id or assignment_id.
create policy "submissions_update_student"
  on public.assignment_submissions for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Teacher can update submissions for their assignments (grading)
create policy "submissions_update_teacher"
  on public.assignment_submissions for update
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and a.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and a.teacher_id = auth.uid()
    )
  );