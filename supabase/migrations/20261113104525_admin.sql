-- =========================================================
-- Platform admin: tutor verification + message report review
--
--   * Tutors can request verification (unverified -> pending) and
--     withdraw it, but only an administrator can verify or remove a
--     verification. Editing the qualification of a verified profile
--     removes the verification until it is checked again.
--   * Admin functions check the caller's role inside the database.
--   * The first admin is created by hand in the SQL Editor
--     (roles cannot be changed through the app).
-- =========================================================

-- ---------------------------------------------------------
-- 1. Audit columns
-- ---------------------------------------------------------
alter table public.teacher_profiles
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

alter table public.message_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------
-- 2. Guard trigger (replaces the discovery version)
-- ---------------------------------------------------------
create or replace function public.guard_teacher_profile()
returns trigger
language plpgsql
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean := false;
  subject_count integer;
begin
  if caller is not null then
    is_admin := coalesce(public.my_role(), '') = 'platform_admin';
  end if;

  if caller is not null and not is_admin then
    if tg_op = 'INSERT' then
      new.verification_status := 'unverified';
      new.verified_at := null;
      new.verified_by := null;
    else
      -- Audit fields are only ever set by the admin functions
      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;

      if new.verification_status is distinct from old.verification_status then
        if not (
          (old.verification_status = 'unverified' and new.verification_status = 'pending')
          or (old.verification_status = 'pending' and new.verification_status = 'unverified')
        ) then
          raise exception 'Only an administrator can verify a profile or remove a verification.'
            using errcode = '42501';
        end if;
        if new.verification_status = 'pending' and not new.is_listed then
          raise exception 'List your complete profile before requesting verification.'
            using errcode = '23514';
        end if;
      elsif old.verification_status = 'verified'
            and new.qualification is distinct from old.qualification then
        new.verification_status := 'unverified';
        new.verified_at := null;
        new.verified_by := null;
      end if;
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

-- ---------------------------------------------------------
-- 3. Admin functions (each one checks the caller's role)
-- ---------------------------------------------------------
create or replace function public.admin_stats()
returns table (
  parents bigint,
  students bigint,
  teachers bigint,
  listed_tutors bigint,
  verified_tutors bigint,
  pending_verifications bigint,
  open_reports bigint,
  pending_enquiries bigint,
  active_teacher_links bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles p where p.role = 'parent'),
    (select count(*) from public.profiles p where p.role = 'student'),
    (select count(*) from public.profiles p where p.role = 'teacher'),
    (select count(*) from public.teacher_profiles tp where tp.is_listed),
    (select count(*) from public.teacher_profiles tp where tp.verification_status = 'verified'),
    (select count(*) from public.teacher_profiles tp where tp.verification_status = 'pending'),
    (select count(*) from public.message_reports r where r.status = 'open'),
    (select count(*) from public.enquiries e where e.status = 'pending'),
    (select count(*) from public.teacher_student_links l where l.status = 'approved');
end;
$$;

create or replace function public.admin_list_tutors()
returns table (
  id uuid,
  full_name text,
  qualification text,
  bio text,
  teaching_mode text,
  hourly_fee_pkr integer,
  city text,
  area text,
  grade_min integer,
  grade_max integer,
  is_listed boolean,
  verification_status text,
  verified_at timestamptz,
  updated_at timestamptz,
  subjects text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  return query
  select
    tp.id,
    p.full_name::text,
    tp.qualification,
    tp.bio,
    tp.teaching_mode,
    tp.hourly_fee_pkr,
    tp.city,
    tp.area,
    tp.grade_min::integer,
    tp.grade_max::integer,
    tp.is_listed,
    tp.verification_status,
    tp.verified_at,
    tp.updated_at,
    coalesce(
      (select array_agg(s.name::text order by s.name)
         from public.teacher_subjects ts
         join public.subjects s on s.id = ts.subject_id
        where ts.teacher_id = tp.id),
      '{}'::text[]
    )
  from public.teacher_profiles tp
  join public.profiles p on p.id = tp.id
  order by
    case tp.verification_status
      when 'pending' then 0
      when 'unverified' then 1
      else 2
    end,
    tp.updated_at desc;
end;
$$;

create or replace function public.admin_set_verification(p_teacher uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  if p_status not in ('unverified', 'pending', 'verified') then
    raise exception 'Unknown verification status.' using errcode = '22023';
  end if;

  update public.teacher_profiles
  set verification_status = p_status,
      verified_at = case when p_status = 'verified' then now() else null end,
      verified_by = case when p_status = 'verified' then me else null end
  where id = p_teacher;

  if not found then
    raise exception 'Tutor profile not found.' using errcode = '22023';
  end if;
end;
$$;

-- Admins can take a profile out of search, never put one in
create or replace function public.admin_unlist_tutor(p_teacher uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  update public.teacher_profiles
  set is_listed = false
  where id = p_teacher;

  if not found then
    raise exception 'Tutor profile not found.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.admin_list_reports()
returns table (
  id uuid,
  status text,
  reason text,
  created_at timestamptz,
  reviewed_at timestamptz,
  message_id uuid,
  message_body text,
  message_sent_at timestamptz,
  sender_id uuid,
  sender_name text,
  sender_role text,
  reporter_id uuid,
  reporter_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.status,
    r.reason,
    r.created_at,
    r.reviewed_at,
    m.id,
    m.body,
    m.created_at,
    m.sender_id,
    sp.full_name::text,
    sp.role::text,
    r.reporter_id,
    rp.full_name::text
  from public.message_reports r
  join public.messages m on m.id = r.message_id
  join public.profiles sp on sp.id = m.sender_id
  join public.profiles rp on rp.id = r.reporter_id
  order by (r.status = 'open') desc, r.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if coalesce(public.my_role(), '') <> 'platform_admin' then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'Unknown report status.' using errcode = '22023';
  end if;

  update public.message_reports
  set status = p_status, reviewed_at = now(), reviewed_by = me
  where id = p_id and status = 'open';

  if not found then
    raise exception 'This report was not found or has already been handled.'
      using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4. Only signed-in users can call these (the functions check the role)
-- ---------------------------------------------------------
revoke execute on function
  public.admin_stats(),
  public.admin_list_tutors(),
  public.admin_set_verification(uuid, text),
  public.admin_unlist_tutor(uuid),
  public.admin_list_reports(),
  public.admin_resolve_report(uuid, text)
from public, anon;

grant execute on function
  public.admin_stats(),
  public.admin_list_tutors(),
  public.admin_set_verification(uuid, text),
  public.admin_unlist_tutor(uuid),
  public.admin_list_reports(),
  public.admin_resolve_report(uuid, text)
to authenticated;