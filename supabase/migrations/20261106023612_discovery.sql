-- =========================================================
-- Discovery: tutor profiles + public search
--
--   * teacher_profiles gets fee, location, grade range and a
--     "listed" switch (default: not listed)
--   * Only teachers can create a profile, only listed profiles are
--     public, and nobody can verify themselves
--   * Public search goes through two functions that return only
--     public fields (name, bio, fee, subjects, area) - never phone
--       or any other private column
-- =========================================================

-- ---------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------
alter table public.teacher_profiles
  add column if not exists hourly_fee_pkr integer
    check (hourly_fee_pkr between 0 and 100000),
  add column if not exists city text,
  add column if not exists area text,
  add column if not exists grade_min smallint
    check (grade_min between 1 and 12),
  add column if not exists grade_max smallint
    check (grade_max between 1 and 12),
  add column if not exists is_listed boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.teacher_profiles
  add constraint teacher_profiles_grade_range
  check (grade_min is null or grade_max is null or grade_min <= grade_max);

create index if not exists teacher_profiles_listed_idx
  on public.teacher_profiles (is_listed, hourly_fee_pkr)
  where is_listed;

-- ---------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------
-- Only listed profiles are public; a teacher always sees their own
drop policy if exists "teacher_profiles_select_public" on public.teacher_profiles;
create policy "teacher_profiles_select_listed_or_own"
  on public.teacher_profiles for select
  using (is_listed or id = auth.uid());

-- Only real teachers can create a profile
drop policy if exists "teacher_profiles_insert_own" on public.teacher_profiles;
create policy "teacher_profiles_insert_own"
  on public.teacher_profiles for insert
  with check (id = auth.uid() and public.my_role() = 'teacher');

drop policy if exists "teacher_profiles_update_own" on public.teacher_profiles;
create policy "teacher_profiles_update_own"
  on public.teacher_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Subjects of a teacher are public only while the profile is listed
drop policy if exists "teacher_subjects_select_public" on public.teacher_subjects;
create policy "teacher_subjects_select_listed_or_own"
  on public.teacher_subjects for select
  using (
    teacher_id = auth.uid()
    or exists (
      select 1 from public.teacher_profiles tp
      where tp.id = teacher_subjects.teacher_id and tp.is_listed
    )
  );

-- ---------------------------------------------------------
-- 3. Guard trigger
--    * nobody can verify themselves (only a platform admin)
--    * a profile can only be listed when it is complete
-- ---------------------------------------------------------
create or replace function public.guard_teacher_profile()
returns trigger
language plpgsql
as $$
declare
  caller uuid := auth.uid();
  subject_count integer;
begin
  if caller is not null then
    if tg_op = 'INSERT' then
      new.verification_status := 'unverified';
    elsif new.verification_status is distinct from old.verification_status
          and coalesce(public.my_role(), '') <> 'platform_admin' then
      raise exception 'Verification status can only be changed by an administrator.'
        using errcode = '42501';
    end if;
  end if;

  if new.is_listed then
    if coalesce(char_length(btrim(new.bio)), 0) < 20 then
      raise exception 'Add a bio of at least 20 characters before listing your profile.'
        using errcode = '23514';
    end if;
    if new.hourly_fee_pkr is null then
      raise exception 'Set your hourly fee before listing your profile.'
        using errcode = '23514';
    end if;
    if new.teaching_mode is null then
      raise exception 'Choose online, in person or both before listing your profile.'
        using errcode = '23514';
    end if;
    if new.grade_min is null or new.grade_max is null then
      raise exception 'Set the classes you teach before listing your profile.'
        using errcode = '23514';
    end if;
    if new.city is null or btrim(new.city) = '' then
      raise exception 'Add your city before listing your profile.'
        using errcode = '23514';
    end if;

    select count(*) into subject_count
    from public.teacher_subjects
    where teacher_id = new.id;
    if subject_count = 0 then
      raise exception 'Choose at least one subject before listing your profile.'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger teacher_profiles_guard
  before insert or update on public.teacher_profiles
  for each row execute function public.guard_teacher_profile();

-- ---------------------------------------------------------
-- 4. Public search (anonymous visitors allowed)
-- ---------------------------------------------------------
create or replace function public.search_tutors(
  p_subject uuid default null,
  p_grade integer default null,
  p_mode text default null,
  p_max_fee integer default null,
  p_city text default null,
  p_area text default null,
  p_query text default null,
  p_sort text default 'fee_asc',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  bio text,
  qualification text,
  teaching_mode text,
  hourly_fee_pkr integer,
  city text,
  area text,
  grade_min integer,
  grade_max integer,
  verification_status text,
  subjects text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tp.id,
    p.full_name::text,
    tp.bio,
    tp.qualification,
    tp.teaching_mode,
    tp.hourly_fee_pkr,
    tp.city,
    tp.area,
    tp.grade_min::integer,
    tp.grade_max::integer,
    tp.verification_status,
    coalesce(
      (select array_agg(s.name::text order by s.name)
         from public.teacher_subjects ts
         join public.subjects s on s.id = ts.subject_id
        where ts.teacher_id = tp.id),
      '{}'::text[]
    )
  from public.teacher_profiles tp
  join public.profiles p on p.id = tp.id and p.role = 'teacher'
  where tp.is_listed
    and (p_subject is null or exists (
          select 1 from public.teacher_subjects ts
          where ts.teacher_id = tp.id and ts.subject_id = p_subject))
    and (p_grade is null or (tp.grade_min <= p_grade and tp.grade_max >= p_grade))
    and (p_mode is null or p_mode not in ('online', 'in_person')
         or tp.teaching_mode = 'both' or tp.teaching_mode = p_mode)
    and (p_max_fee is null or tp.hourly_fee_pkr <= p_max_fee)
    and (p_city is null or btrim(p_city) = ''
         or lower(tp.city) = lower(btrim(p_city)))
    and (p_area is null or btrim(p_area) = ''
         or tp.area ilike '%' || btrim(p_area) || '%')
    and (p_query is null or btrim(p_query) = ''
         or p.full_name ilike '%' || btrim(p_query) || '%'
         or tp.bio ilike '%' || btrim(p_query) || '%'
         or tp.qualification ilike '%' || btrim(p_query) || '%')
  order by
    case when p_sort = 'verified' and tp.verification_status = 'verified'
         then 0 else 1 end,
    case when p_sort = 'fee_desc' then -tp.hourly_fee_pkr
         else tp.hourly_fee_pkr end,
    p.full_name
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_tutor(p_id uuid)
returns table (
  id uuid,
  full_name text,
  bio text,
  qualification text,
  teaching_mode text,
  hourly_fee_pkr integer,
  city text,
  area text,
  grade_min integer,
  grade_max integer,
  verification_status text,
  subjects text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tp.id,
    p.full_name::text,
    tp.bio,
    tp.qualification,
    tp.teaching_mode,
    tp.hourly_fee_pkr,
    tp.city,
    tp.area,
    tp.grade_min::integer,
    tp.grade_max::integer,
    tp.verification_status,
    coalesce(
      (select array_agg(s.name::text order by s.name)
         from public.teacher_subjects ts
         join public.subjects s on s.id = ts.subject_id
        where ts.teacher_id = tp.id),
      '{}'::text[]
    )
  from public.teacher_profiles tp
  join public.profiles p on p.id = tp.id and p.role = 'teacher'
  where tp.id = p_id and tp.is_listed;
$$;

-- Cities that currently have at least one listed tutor (filter dropdown)
create or replace function public.listed_cities()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct tp.city
  from public.teacher_profiles tp
  join public.profiles p on p.id = tp.id and p.role = 'teacher'
  where tp.is_listed and tp.city is not null and btrim(tp.city) <> ''
  order by 1;
$$;

revoke execute on function
  public.search_tutors(uuid, integer, text, integer, text, text, text, text, integer, integer),
  public.get_tutor(uuid),
  public.listed_cities()
from public;

grant execute on function
  public.search_tutors(uuid, integer, text, integer, text, text, text, text, integer, integer),
  public.get_tutor(uuid),
  public.listed_cities()
to anon, authenticated;