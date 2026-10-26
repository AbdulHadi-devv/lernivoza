create or replace function public.find_profile_by_email(email_input text)
returns table (id uuid, role text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(email_input)
  limit 1;
$$;

-- Only signed-in users can call this function
revoke all on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;