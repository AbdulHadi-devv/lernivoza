-- =========================================================
-- Verification needs a qualification on file
--
--   * A tutor cannot request verification without a qualification
--     (at least 5 characters).
--   * An administrator cannot verify a tutor who has none, so the
--     "Verified" badge always vouches for something.
-- Replaces two functions from the admin migration.
-- =========================================================

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
        if new.verification_status = 'pending'
           and char_length(btrim(coalesce(new.qualification, ''))) < 5 then
          raise exception 'Add your qualification before requesting verification.'
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

  if p_status = 'verified' and not exists (
    select 1 from public.teacher_profiles tp
    where tp.id = p_teacher
      and char_length(btrim(coalesce(tp.qualification, ''))) >= 5
  ) then
    raise exception 'This tutor has no qualification on file, so they cannot be verified.'
      using errcode = '22023';
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
