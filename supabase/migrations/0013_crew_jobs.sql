-- Crew jobs: a photographer or videographer hires another creator to help on a shoot
-- (a second shooter, a videographer, a drone pilot, an editor, an assistant).
-- Two ways in:
--   1. Hire someone directly from their page: they accept or decline.
--   2. Post the job: creators reply "I'm in", and the poster picks one.
-- Pay is agreed between the two creators for now. Once someone is hired, chat between them fully
-- opens (phone numbers and handles too), the same as after a confirmed shoot.
-- Safe to run more than once; it only adds things.

create table if not exists public.gigs (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.pros (id) on delete cascade,
  target_id uuid references public.pros (id) on delete cascade, -- set when hiring someone directly
  role text not null check (role in ('Second shooter', 'Photographer', 'Videographer', 'Drone', 'Editor', 'Assistant')),
  city text not null check (char_length(city) between 1 and 60),
  shoot_date date not null,
  shoot_time time,
  pay integer not null check (pay between 1 and 100000),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'filled', 'declined', 'closed')),
  hired_id uuid references public.pros (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gigs_open_idx on public.gigs (status, shoot_date) where target_id is null;
create index if not exists gigs_poster_idx on public.gigs (poster_id);
create index if not exists gigs_target_idx on public.gigs (target_id);

create table if not exists public.gig_replies (
  gig_id uuid not null references public.gigs (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  note text check (char_length(note) <= 300),
  status text not null default 'waiting' check (status in ('waiting', 'chosen', 'passed')),
  created_at timestamptz not null default now(),
  primary key (gig_id, pro_id)
);

alter table public.gigs enable row level security;
alter table public.gig_replies enable row level security;

create or replace function public.is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pros where id = p_user);
$$;

create or replace function public.replied_to_gig(p_gig uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gig_replies where gig_id = p_gig and pro_id = auth.uid());
$$;

create or replace function public.owns_gig(p_gig uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gigs where id = p_gig and poster_id = auth.uid());
$$;

-- Open posted jobs are visible to every creator. Direct offers only to the two people on them.
drop policy if exists "creators see open jobs and their own" on public.gigs;
create policy "creators see open jobs and their own" on public.gigs for select using (
  (target_id is null and status = 'open' and public.is_pro(auth.uid()))
  or auth.uid() in (poster_id, target_id, hired_id)
  or public.replied_to_gig(id)
);
drop policy if exists "replies seen by the replier and the poster" on public.gig_replies;
create policy "replies seen by the replier and the poster" on public.gig_replies for select using (
  pro_id = auth.uid() or public.owns_gig(gig_id)
);
revoke all on public.gigs, public.gig_replies from anon, authenticated;
grant select on public.gigs, public.gig_replies to authenticated;
grant all on public.gigs, public.gig_replies to service_role;

-- Hiring someone unlocks contact details between the two, like a confirmed shoot does.
create or replace function public.has_confirmed_booking(p_pro uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where pro_id = p_pro and client_id = p_client and status in ('confirmed', 'rescheduled')
  ) or exists (
    select 1 from gigs
    where status = 'filled'
      and ((poster_id = p_client and hired_id = p_pro) or (poster_id = p_pro and hired_id = p_client))
  );
$$;

-- The chat between two creators: the existing one either way round, else a new one with no message limit.
create or replace function public.crew_thread(p_a uuid, p_b uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select id into tid from threads
    where (pro_id = p_a and client_id = p_b) or (pro_id = p_b and client_id = p_a)
    order by updated_at desc limit 1;
  if tid is null then
    insert into threads (pro_id, client_id, unlimited) values (p_a, p_b, true)
      on conflict (pro_id, client_id) do update set unlimited = true
      returning id into tid;
  else
    update threads set unlimited = true where id = tid;
  end if;
  return tid;
end;
$$;

create or replace function public.crew_note(p_a uuid, p_b uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid := crew_thread(p_a, p_b);
begin
  insert into messages (thread_id, kind, body) values (tid, 'system', p_body);
  return tid;
end;
$$;

create or replace function public.gig_line(g gigs) returns text
language sql stable as $$
  select format('%s on %s%s in %s for $%s', lower(g.role), to_char(g.shoot_date, 'Dy, Mon FMDD'),
    case when g.shoot_time is null then '' else ' at ' || to_char(g.shoot_time, 'FMHH12:MI AM') end,
    g.city, g.pay);
$$;

-- Post a job, or (with p_target) offer it to one creator directly. Returns the job id.
create or replace function public.post_gig(p_role text, p_city text, p_date date, p_time time, p_pay integer, p_note text, p_target uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g gigs%rowtype;
  me uuid := auth.uid();
  who text;
begin
  if not is_pro(me) then raise exception 'Only photographers and videographers can hire crew'; end if;
  if p_date is null or p_date < current_date then raise exception 'Pick a future date'; end if;
  if p_target is not null then
    if p_target = me then raise exception 'You cannot hire yourself'; end if;
    if not is_pro(p_target) then raise exception 'That creator was not found'; end if;
    if exists (select 1 from gigs where poster_id = me and target_id = p_target and status = 'open' and shoot_date = p_date) then
      raise exception 'You already sent them an offer for that day';
    end if;
  end if;
  insert into gigs (poster_id, target_id, role, city, shoot_date, shoot_time, pay, note)
    values (me, p_target, p_role, trim(p_city), p_date, p_time, p_pay, nullif(left(trim(coalesce(p_note, '')), 500), ''))
    returning * into g;
  if p_target is not null then
    select name into who from profiles where id = me;
    perform crew_note(p_target, me, format('%s wants to hire you: %s.%s Open Crew to accept or decline.',
      who, gig_line(g), case when g.note is null then '' else ' "' || g.note || '"' end));
  end if;
  return g.id;
end;
$$;

-- Answer a direct offer.
create or replace function public.answer_gig(p_gig uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g gigs%rowtype;
  who text;
begin
  select * into g from gigs where id = p_gig for update;
  if not found or g.target_id is distinct from auth.uid() then raise exception 'Job not found'; end if;
  if g.status <> 'open' then raise exception 'This offer was already answered'; end if;
  if g.shoot_date < current_date then raise exception 'This date has passed'; end if;
  update gigs set status = case when p_accept then 'filled' else 'declined' end,
    hired_id = case when p_accept then auth.uid() else null end
    where id = p_gig;
  select name into who from profiles where id = auth.uid();
  return crew_note(auth.uid(), g.poster_id,
    case when p_accept then format('%s is in: %s. Chat is fully open now.', who, gig_line(g))
    else format('%s can''t make it: %s.', who, gig_line(g)) end);
end;
$$;

-- Reply "I'm in" to a posted job. Opens a chat with the poster. Returns the chat id.
create or replace function public.reply_gig(p_gig uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g gigs%rowtype;
  me uuid := auth.uid();
  who text;
  n text := nullif(left(trim(coalesce(p_note, '')), 300), '');
begin
  if not is_pro(me) then raise exception 'Only photographers and videographers can reply'; end if;
  select * into g from gigs where id = p_gig;
  if not found or g.target_id is not null then raise exception 'Job not found'; end if;
  if g.poster_id = me then raise exception 'This is your job'; end if;
  if g.status <> 'open' then raise exception 'This job is already filled'; end if;
  if g.shoot_date < current_date then raise exception 'This date has passed'; end if;
  insert into gig_replies (gig_id, pro_id, note) values (p_gig, me, n)
    on conflict (gig_id, pro_id) do update set note = excluded.note;
  select name into who from profiles where id = me;
  return crew_note(me, g.poster_id, format('%s is interested in your job: %s.%s', who, gig_line(g),
    case when n is null then '' else ' "' || n || '"' end));
end;
$$;

-- The poster picks one of the replies.
create or replace function public.choose_gig_reply(p_gig uuid, p_pro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g gigs%rowtype;
  who text;
begin
  select * into g from gigs where id = p_gig for update;
  if not found or g.poster_id <> auth.uid() then raise exception 'Job not found'; end if;
  if g.status <> 'open' then raise exception 'You already picked someone for this job'; end if;
  if not exists (select 1 from gig_replies where gig_id = p_gig and pro_id = p_pro) then raise exception 'Reply not found'; end if;
  update gigs set status = 'filled', hired_id = p_pro where id = p_gig;
  update gig_replies set status = case when pro_id = p_pro then 'chosen' else 'passed' end where gig_id = p_gig;
  select name into who from profiles where id = auth.uid();
  -- Let everyone else who replied know, so nobody keeps the day free for nothing.
  perform crew_note(r.pro_id, g.poster_id, format('%s went with someone else for the %s. Thanks for replying.', who, gig_line(g)))
    from gig_replies r where r.gig_id = p_gig and r.pro_id <> p_pro;
  return crew_note(p_pro, g.poster_id, format('%s picked you: %s. Chat is fully open now.', who, gig_line(g)));
end;
$$;

-- The poster takes down an open job, or withdraws a direct offer.
create or replace function public.close_gig(p_gig uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g gigs%rowtype;
begin
  select * into g from gigs where id = p_gig for update;
  if not found or g.poster_id <> auth.uid() then raise exception 'Job not found'; end if;
  if g.status <> 'open' then raise exception 'This job is not open'; end if;
  update gigs set status = 'closed' where id = p_gig;
  if g.target_id is not null then
    perform crew_note(g.target_id, g.poster_id, format('Offer withdrawn: %s.', gig_line(g)));
  end if;
end;
$$;

revoke execute on function public.crew_thread(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.crew_note(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.post_gig(text, text, date, time, integer, text, uuid) from public, anon;
revoke execute on function public.answer_gig(uuid, boolean) from public, anon;
revoke execute on function public.reply_gig(uuid, text) from public, anon;
revoke execute on function public.choose_gig_reply(uuid, uuid) from public, anon;
revoke execute on function public.close_gig(uuid) from public, anon;
grant execute on function public.post_gig(text, text, date, time, integer, text, uuid) to authenticated;
grant execute on function public.answer_gig(uuid, boolean) to authenticated;
grant execute on function public.reply_gig(uuid, text) to authenticated;
grant execute on function public.choose_gig_reply(uuid, uuid) to authenticated;
grant execute on function public.close_gig(uuid) to authenticated;
grant execute on function public.is_pro(uuid) to authenticated;
grant execute on function public.replied_to_gig(uuid) to authenticated;
grant execute on function public.owns_gig(uuid) to authenticated;
