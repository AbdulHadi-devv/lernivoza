-- =========================================================
-- Enrolment: parent enquiry -> teacher accepts -> link created
--
--   * Only a parent with an approved link to the child can send an
--     enquiry, and only to a listed tutor.
--   * Accepting creates the approved teacher-student link itself
--     (the parent consented by sending the enquiry, the teacher
--     consents by accepting).
--   * Clients can only READ their own enquiries. Every write goes
--     through a function that re-checks the rules.
-- =========================================================

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint enquiries_distinct_people
    check (parent_id <> teacher_id and child_id <> teacher_id and parent_id <> child_id)
);

-- One open enquiry per parent, child and tutor
create unique index enquiries_one_pending
  on public.enquiries (parent_id, child_id, teacher_id)
  where status = 'pending';

create index enquiries_teacher_idx on public.enquiries (teacher_id, status);
create index enquiries_parent_idx on public.enquiries (parent_id, created_at desc);

-- ---------------------------------------------------------
-- RLS: read-only for the two people involved, no client writes
-- ---------------------------------------------------------
alter table public.enquiries enable row level security;

create policy "enquiries_select_parent"
  on public.enquiries for select
  using (parent_id = auth.uid());

create policy "enquiries_select_teacher"
  on public.enquiries for select
  using (teacher_id = auth.uid());

revoke all on public.enquiries from anon, authenticated;
grant select on public.enquiries to authenticated;

-- ---------------------------------------------------------
-- Send an enquiry (parent)
-- ---------------------------------------------------------
create or replace function public.send_enquiry(
  p_teacher uuid,
  p_child uuid,
  p_subject uuid default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cleaned text := nullif(btrim(coalesce(p_message, '')), '');
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if coalesce(public.my_role(), '') <> 'parent' then
    raise exception 'Only parent accounts can send enquiries.'
      using errcode = '42501';
  end if;
  if cleaned is not null and char_length(cleaned) > 1000 then
    raise exception 'Messages can be at most 1000 characters.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.parent_child_links pl
    where pl.parent_id = me and pl.child_id = p_child and pl.status = 'approved'
  ) then
    raise exception 'You can only send enquiries for children linked to your account.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.teacher_profiles tp
    join public.profiles pr on pr.id = tp.id and pr.role = 'teacher'
    where tp.id = p_teacher and tp.is_listed
  ) then
    raise exception 'This tutor is not accepting enquiries.'
      using errcode = '22023';
  end if;

  if p_subject is not null and not exists (
    select 1 from public.teacher_subjects ts
    where ts.teacher_id = p_teacher and ts.subject_id = p_subject
  ) then
    raise exception 'That subject is not taught by this tutor.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.teacher_student_links l
    where l.teacher_id = p_teacher and l.student_id = p_child
      and l.status = 'approved'
  ) then
    raise exception 'This child is already linked to this tutor.'
      using errcode = '22023';
  end if;

  begin
    insert into public.enquiries (parent_id, child_id, teacher_id, subject_id, message)
    values (me, p_child, p_teacher, p_subject, cleaned)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'You already have a pending enquiry for this child and tutor.'
      using errcode = '23505';
  end;

  return new_id;
end;
$$;

-- ---------------------------------------------------------
-- Cancel your own pending enquiry (parent)
-- ---------------------------------------------------------
create or replace function public.cancel_enquiry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.enquiries
  set status = 'cancelled', responded_at = now()
  where id = p_id and parent_id = me and status = 'pending';

  if not found then
    raise exception 'There is no pending enquiry to cancel.'
      using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- Accept or decline an enquiry (teacher)
-- Accepting creates the approved teacher-student link.
-- ---------------------------------------------------------
create or replace function public.respond_enquiry(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  enq public.enquiries%rowtype;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select * into enq
  from public.enquiries
  where id = p_id and teacher_id = me
  for update;
  if not found then
    raise exception 'Enquiry not found.' using errcode = '42501';
  end if;
  if enq.status <> 'pending' then
    raise exception 'This enquiry has already been answered or cancelled.'
      using errcode = '22023';
  end if;

  if p_accept then
    if not exists (
      select 1 from public.parent_child_links pl
      where pl.parent_id = enq.parent_id
        and pl.child_id = enq.child_id
        and pl.status = 'approved'
    ) then
      raise exception 'The parent no longer has an approved link to this child.'
        using errcode = '42501';
    end if;

    -- Replace any old pending / declined / revoked link for this pair
    delete from public.teacher_student_links
    where teacher_id = me and student_id = enq.child_id and status <> 'approved';

    insert into public.teacher_student_links
      (teacher_id, student_id, requested_by, status, decided_at, decided_by)
    values
      (me, enq.child_id, enq.parent_id, 'approved', now(), enq.parent_id)
    on conflict (teacher_id, student_id) do nothing;

    update public.enquiries
    set status = 'accepted', responded_at = now()
    where id = p_id;
  else
    update public.enquiries
    set status = 'declined', responded_at = now()
    where id = p_id;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- Enquiry list for the signed-in parent or teacher (with names)
-- ---------------------------------------------------------
create or replace function public.my_enquiries()
returns table (
  id uuid,
  parent_id uuid,
  parent_name text,
  child_id uuid,
  child_name text,
  teacher_id uuid,
  teacher_name text,
  subject_name text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.parent_id,
    pa.full_name::text,
    e.child_id,
    ch.full_name::text,
    e.teacher_id,
    te.full_name::text,
    s.name::text,
    e.message,
    e.status,
    e.created_at,
    e.responded_at
  from public.enquiries e
  join public.profiles pa on pa.id = e.parent_id
  join public.profiles ch on ch.id = e.child_id
  join public.profiles te on te.id = e.teacher_id
  left join public.subjects s on s.id = e.subject_id
  where auth.uid() in (e.parent_id, e.teacher_id)
  order by (e.status = 'pending') desc, e.created_at desc;
$$;

-- Pending enquiries waiting for the signed-in teacher (dashboard badge)
create or replace function public.pending_enquiry_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.enquiries e
  where e.teacher_id = auth.uid() and e.status = 'pending';
$$;

-- ---------------------------------------------------------
-- Only signed-in users can call these
-- ---------------------------------------------------------
revoke execute on function
  public.send_enquiry(uuid, uuid, uuid, text),
  public.cancel_enquiry(uuid),
  public.respond_enquiry(uuid, boolean),
  public.my_enquiries(),
  public.pending_enquiry_count()
from public, anon;

grant execute on function
  public.send_enquiry(uuid, uuid, uuid, text),
  public.cancel_enquiry(uuid),
  public.respond_enquiry(uuid, boolean),
  public.my_enquiries(),
  public.pending_enquiry_count()
to authenticated;