-- =========================================================
-- Messaging: private parent <-> teacher conversations
--
-- Safeguarding rules built in:
--   * A parent and a teacher can talk only while the teacher has an
--     approved link to a child of that parent (both links approved).
--   * Students have no messaging.
--   * Clients can only READ their own conversations. Every write goes
--     through a function that re-checks the links, so a revoked link
--     stops new messages immediately.
-- =========================================================

-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_ordered check (user_a < user_b),
  constraint conversations_pair_unique unique (user_a, user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index messages_unread_idx
  on public.messages (conversation_id) where read_at is null;

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- ---------------------------------------------------------
-- RLS: read-only for participants, no client writes at all
-- ---------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;

create policy "conversations_select_member"
  on public.conversations for select
  using (auth.uid() in (user_a, user_b));

create policy "messages_select_member"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  );

create policy "message_reports_select_own"
  on public.message_reports for select
  using (reporter_id = auth.uid());

revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select on public.message_reports to authenticated;

-- ---------------------------------------------------------
-- Private permission check (not callable through the API,
-- so it cannot be used to probe other people's links)
-- ---------------------------------------------------------
create or replace function public.can_message(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_student_links l
    join public.parent_child_links p
      on p.child_id = l.student_id and p.status = 'approved'
    where l.status = 'approved'
      and (
        (l.teacher_id = a and p.parent_id = b)
        or (l.teacher_id = b and p.parent_id = a)
      )
  );
$$;

revoke execute on function public.can_message(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------
-- People the signed-in user is currently allowed to message
-- ---------------------------------------------------------
create or replace function public.my_contacts()
returns table (user_id uuid, full_name text, role text, context text)
language sql
stable
security definer
set search_path = public
as $$
  -- a teacher's contacts: parents of their approved students
  select p.id, p.full_name::text, p.role::text,
         ('Parent of ' || string_agg(distinct s.full_name, ', '))::text
  from public.teacher_student_links l
  join public.parent_child_links pl
    on pl.child_id = l.student_id and pl.status = 'approved'
  join public.profiles p on p.id = pl.parent_id
  join public.profiles s on s.id = l.student_id
  where l.teacher_id = auth.uid() and l.status = 'approved'
  group by p.id, p.full_name, p.role

  union all

  -- a parent's contacts: teachers of their approved children
  select t.id, t.full_name::text, t.role::text,
         ('Teaches ' || string_agg(distinct s.full_name, ', '))::text
  from public.parent_child_links pl
  join public.teacher_student_links l
    on l.student_id = pl.child_id and l.status = 'approved'
  join public.profiles t on t.id = l.teacher_id
  join public.profiles s on s.id = pl.child_id
  where pl.parent_id = auth.uid() and pl.status = 'approved'
  group by t.id, t.full_name, t.role;
$$;

-- ---------------------------------------------------------
-- Conversation list with the other person, last message, unread count
-- ---------------------------------------------------------
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_name text,
  other_role text,
  context text,
  can_send boolean,
  last_body text,
  last_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    o.id,
    o.full_name::text,
    o.role::text,
    k.context,
    (k.user_id is not null),
    (select m.body from public.messages m
       where m.conversation_id = c.id
       order by m.created_at desc limit 1),
    c.last_message_at,
    (select count(*) from public.messages m
       where m.conversation_id = c.id
         and m.sender_id <> auth.uid()
         and m.read_at is null)
  from public.conversations c
  join public.profiles o
    on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join public.my_contacts() k on k.user_id = o.id
  where auth.uid() in (c.user_a, c.user_b)
  order by c.last_message_at desc;
$$;

-- ---------------------------------------------------------
-- Start (or reopen) a conversation with a permitted contact
-- ---------------------------------------------------------
create or replace function public.start_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  conv uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if other is null or other = me then
    raise exception 'Choose someone else to message.' using errcode = '22023';
  end if;
  if not public.can_message(me, other) then
    raise exception 'You can only message people you are linked to.'
      using errcode = '42501';
  end if;

  a := least(me, other);
  b := greatest(me, other);

  insert into public.conversations (user_a, user_b)
  values (a, b)
  on conflict (user_a, user_b) do nothing;

  select id into conv
  from public.conversations
  where user_a = a and user_b = b;

  return conv;
end;
$$;

-- ---------------------------------------------------------
-- Send a message (links are re-checked every time)
-- ---------------------------------------------------------
create or replace function public.send_message(conv uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  c public.conversations%rowtype;
  other uuid;
  cleaned text := btrim(coalesce(message_body, ''));
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if char_length(cleaned) = 0 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;
  if char_length(cleaned) > 2000 then
    raise exception 'Messages can be at most 2000 characters.'
      using errcode = '22023';
  end if;

  select * into c
  from public.conversations
  where id = conv and me in (user_a, user_b);
  if not found then
    raise exception 'Conversation not found.' using errcode = '42501';
  end if;

  other := case when c.user_a = me then c.user_b else c.user_a end;
  if not public.can_message(me, other) then
    raise exception 'You can no longer message this person because your link has ended.'
      using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (conv, me, cleaned)
  returning id into new_id;

  update public.conversations set last_message_at = now() where id = conv;

  return new_id;
end;
$$;

-- ---------------------------------------------------------
-- Mark messages from the other person as read
-- ---------------------------------------------------------
create or replace function public.mark_conversation_read(conv uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;

  update public.messages m
  set read_at = now()
  where m.conversation_id = conv
    and m.sender_id <> me
    and m.read_at is null
    and exists (
      select 1 from public.conversations c
      where c.id = conv and me in (c.user_a, c.user_b)
    );
end;
$$;

-- ---------------------------------------------------------
-- Unread total (dashboard badges)
-- ---------------------------------------------------------
create or replace function public.unread_message_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where auth.uid() in (c.user_a, c.user_b)
    and m.sender_id <> auth.uid()
    and m.read_at is null;
$$;

-- ---------------------------------------------------------
-- Report a message you received
-- ---------------------------------------------------------
create or replace function public.report_message(msg uuid, report_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cleaned text := btrim(coalesce(report_reason, ''));
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if char_length(cleaned) < 3 then
    raise exception 'Please describe the problem (at least 3 characters).'
      using errcode = '22023';
  end if;
  if char_length(cleaned) > 500 then
    raise exception 'Reports can be at most 500 characters.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = msg
      and me in (c.user_a, c.user_b)
      and m.sender_id <> me
  ) then
    raise exception 'You can only report messages sent to you.'
      using errcode = '42501';
  end if;

  insert into public.message_reports (message_id, reporter_id, reason)
  values (msg, me, cleaned)
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

-- ---------------------------------------------------------
-- Only signed-in users can call the public functions
-- ---------------------------------------------------------
revoke execute on function
  public.my_contacts(),
  public.my_conversations(),
  public.start_conversation(uuid),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid),
  public.unread_message_count(),
  public.report_message(uuid, text)
from public, anon;

grant execute on function
  public.my_contacts(),
  public.my_conversations(),
  public.start_conversation(uuid),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid),
  public.unread_message_count(),
  public.report_message(uuid, text)
to authenticated;