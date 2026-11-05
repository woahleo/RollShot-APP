-- An admin page for the owner of Rollshot, and notifications: a bell in the app for new requests,
-- offers, bookings and crew jobs, plus phone alerts for those and new messages.
-- Safe to run more than once.

-- 1) Admins -------------------------------------------------------------------------------------
-- No policies: nobody can read or change this list through the app. Add yourself in the SQL Editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Every account, including people who signed up but never picked client or creator.
create or replace function public.admin_users()
returns table (
  id uuid, email text, name text, role text, handle text, city text, avatar text,
  signed_up timestamptz, last_seen timestamptz, bookings bigint, requests bigint, messages bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return query
    select u.id, u.email::text, p.name, p.role, pr.handle, pr.city, p.avatar,
      u.created_at, u.last_sign_in_at,
      (select count(*) from bookings b where b.client_id = u.id or b.pro_id = u.id),
      (select count(*) from requests r where r.client_id = u.id),
      (select count(*) from messages m where m.sender_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    left join pros pr on pr.id = u.id
    order by u.created_at desc;
end;
$$;

create or replace function public.admin_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'clients', (select count(*) from profiles where role = 'client'),
    'creators', (select count(*) from profiles where role = 'pro'),
    'bookings', (select count(*) from bookings),
    'confirmed', (select count(*) from bookings where status in ('confirmed', 'rescheduled')),
    'upcoming', (select count(*) from bookings where status in ('confirmed', 'rescheduled') and shoot_date >= current_date),
    'open_requests', (select count(*) from requests where status = 'open' and date_to >= current_date),
    'requests', (select count(*) from requests),
    'messages_week', (select count(*) from messages where sender_id is not null and created_at > now() - interval '7 days'),
    'crew_jobs', (select count(*) from gigs),
    'push_devices', (select count(*) from push_subscriptions),
    'push_linked', (select count(*) > 0 from private.push_config),
    'push_url', (select url from private.push_config where id = 1),
    'pg_net', (select count(*) > 0 from pg_extension where extname = 'pg_net')
  );
end;
$$;

-- 2) Notifications ------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 300),
  href text not null default '/',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "see own notifications" on public.notifications;
create policy "see own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "clear own notifications" on public.notifications;
create policy "clear own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; -- already added, or no realtime locally
end $$;

-- Phones and browsers that turned on alerts. Saved through the functions below, never directly.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "see own devices" on public.push_subscriptions;
create policy "see own devices" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
grant select on public.push_subscriptions to authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then raise exception 'Sign in first'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Not a push address'; end if;
  -- A shared phone moves to whoever turned alerts on last.
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

create or replace function public.forget_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Phone alerts go out through the app: the database posts each one to /api/push, which signs it
-- with the app's push keys. The address and a shared secret live here, out of reach of the app's
-- users. Fill it in from the admin page's setup steps.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.push_config (
  id int primary key default 1 check (id = 1),
  url text not null,
  secret text not null
);
do $$ begin
  create extension if not exists pg_net;
exception when others then raise notice 'pg_net is not available here, so phone alerts are off';
end $$;

-- The app drops a phone that was switched off or uninstalled (the push service said it's gone).
create or replace function public.drop_dead_push(p_secret text, p_endpoints text[])
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from private.push_config where secret = p_secret) then raise exception 'Not allowed'; end if;
  delete from push_subscriptions where endpoint = any (p_endpoints);
end;
$$;

-- Tell one person. p_keep = false sends only a phone alert (used for chat messages, which the
-- chat bubble already shows in the app).
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_href text, p_keep boolean default true)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  cfg record;
  subs jsonb;
begin
  if p_user is null or p_user = auth.uid() then return; end if; -- never about your own action
  if p_keep then
    insert into notifications (user_id, kind, title, body, href)
      values (p_user, p_kind, left(p_title, 120), left(p_body, 300), coalesce(p_href, '/'));
  end if;
  select url, secret into cfg from private.push_config where id = 1;
  if cfg.url is null then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
    into subs from push_subscriptions where user_id = p_user;
  if subs is null then return; end if;
  begin
    perform net.http_post(
      url := cfg.url,
      body := jsonb_build_object('subs', subs, 'title', p_title, 'body', p_body, 'href', p_href, 'tag', p_kind),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret)
    );
  exception when others then null; -- an alert must never block the booking, request or message
  end;
end;
$$;

revoke execute on function public.notify(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.drop_dead_push(text, text[]) from public, authenticated;
grant execute on function public.drop_dead_push(text, text[]) to anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.admin_counts() from public, anon;
grant execute on function public.admin_users(), public.admin_counts(), public.is_admin() to authenticated;
grant execute on function public.save_push_subscription(text, text, text), public.forget_push_subscription(text) to authenticated;

create or replace function public.first_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(trim(name), ' ', 1), ''), 'Someone') from profiles where id = p_user;
$$;

create or replace function public.short_date(d date) returns text
language sql immutable as $$ select to_char(d, 'Dy, Mon FMDD') $$;

-- 3) What triggers a notification ----------------------------------------------------------------

-- A car owner posts a request: creators in that city who shoot that kind of thing.
create or replace function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.status <> 'open' then return new; end if;
  for p in
    select pr.id from pros pr
    where pr.city = new.city
      and (new.kind = 'either' or pr.kind = 'both' or pr.kind = new.kind)
  loop
    perform notify(p.id, 'request', format('New request in %s', new.city),
      format('%s · %s · %s%s', new.car, new.shoot_type,
        case when new.date_from = new.date_to then short_date(new.date_from)
             else short_date(new.date_from) || ' to ' || short_date(new.date_to) end,
        case when new.budget is null then '' else format(' · up to $%s', new.budget) end),
      '/requests/' || new.id);
  end loop;
  return new;
end;
$$;
drop trigger if exists requests_notify on public.requests;
create trigger requests_notify after insert on public.requests
  for each row execute function public.notify_new_request();

-- A creator sends an offer on a request: the owner.
create or replace function public.notify_request_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare r requests%rowtype;
begin
  if tg_op = 'UPDATE' and old.price is not distinct from new.price and old.note is not distinct from new.note then
    return new; -- a status change, not a new offer
  end if;
  select * into r from requests where id = new.request_id;
  perform notify(r.client_id, 'offer',
    format('%s sent an offer%s', first_name(new.pro_id), case when new.price is null then '' else format(': $%s', new.price) end),
    format('For your %s request', r.car), '/requests/' || r.id);
  return new;
end;
$$;
drop trigger if exists request_replies_notify on public.request_replies;
create trigger request_replies_notify after insert or update on public.request_replies
  for each row execute function public.notify_request_offer();

-- Bookings: new ones to the creator, answers and changes to the other side.
create or replace function public.notify_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare line text := format('%s · %s', new.package_name, short_date(new.shoot_date));
begin
  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      perform notify(new.pro_id, 'booking', format('%s wants to book you', first_name(new.client_id)), line, '/pro');
    else
      perform notify(new.pro_id, 'booking', format('%s booked you', first_name(new.client_id)), line || ' · confirmed', '/pro');
    end if;
    return new;
  end if;
  if new.status = old.status and new.shoot_date = old.shoot_date then return new; end if;
  if new.status = 'confirmed' and old.status = 'requested' then
    perform notify(new.client_id, 'booking', format('%s confirmed your shoot', first_name(new.pro_id)), line, '/shoots');
  elsif new.status = 'declined' then
    perform notify(new.client_id, 'booking', format('%s can''t take this one', first_name(new.pro_id)), line, '/book');
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform notify(case when new.cancelled_by = new.pro_id then new.client_id else new.pro_id end, 'booking',
      format('%s cancelled the shoot', first_name(new.cancelled_by)), line,
      case when new.cancelled_by = new.pro_id then '/shoots' else '/pro' end);
  elsif new.shoot_date <> old.shoot_date then
    perform notify(new.client_id, 'booking', 'Your shoot moved', format('%s · now %s', new.package_name, short_date(new.shoot_date)), '/shoots');
    perform notify(new.pro_id, 'booking', 'A shoot moved', format('%s · now %s', new.package_name, short_date(new.shoot_date)), '/pro');
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify after insert or update on public.bookings
  for each row execute function public.notify_booking();

-- Chat messages: a phone alert for the other person. The bell skips these; the chat bubble has them.
create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare t threads%rowtype;
begin
  if new.sender_id is null or new.kind not in ('text', 'offer') then return new; end if;
  select * into t from threads where id = new.thread_id;
  perform notify(case when new.sender_id = t.pro_id then t.client_id else t.pro_id end, 'msg-' || new.thread_id,
    (select coalesce(name, 'New message') from profiles where id = new.sender_id),
    case when new.kind = 'offer' then format('Sent you an offer: %s', new.offer_name) else left(new.body, 200) end,
    '/messages/' || new.thread_id, false);
  return new;
end;
$$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

-- Crew jobs between creators.
create or replace function public.notify_gig() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if tg_op = 'INSERT' then
    if new.target_id is not null then
      perform notify(new.target_id, 'crew', format('%s wants to hire you', first_name(new.poster_id)), gig_line(new), '/crew');
    else
      for p in select id from pros where city = new.city and id <> new.poster_id loop
        perform notify(p.id, 'crew', format('New crew job in %s', new.city), gig_line(new), '/crew');
      end loop;
    end if;
    return new;
  end if;
  if new.status = old.status then return new; end if;
  if new.status = 'filled' and new.hired_id = new.target_id then
    perform notify(new.poster_id, 'crew', format('%s is in', first_name(new.hired_id)), gig_line(new), '/crew');
  elsif new.status = 'filled' then
    perform notify(new.hired_id, 'crew', format('%s picked you', first_name(new.poster_id)), gig_line(new), '/crew');
  elsif new.status = 'declined' then
    perform notify(new.poster_id, 'crew', format('%s can''t make it', first_name(new.target_id)), gig_line(new), '/crew');
  elsif new.status = 'closed' and new.target_id is not null then
    perform notify(new.target_id, 'crew', 'Job offer withdrawn', gig_line(new), '/crew');
  end if;
  return new;
end;
$$;
drop trigger if exists gigs_notify on public.gigs;
create trigger gigs_notify after insert or update on public.gigs
  for each row execute function public.notify_gig();

create or replace function public.notify_gig_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare g gigs%rowtype;
begin
  select * into g from gigs where id = new.gig_id;
  perform notify(g.poster_id, 'crew', format('%s is interested in your job', first_name(new.pro_id)),
    coalesce(new.note, gig_line(g)), '/crew');
  return new;
end;
$$;
drop trigger if exists gig_replies_notify on public.gig_replies;
create trigger gig_replies_notify after insert on public.gig_replies
  for each row execute function public.notify_gig_reply();

-- New sign-ups, for admins.
create or replace function public.notify_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in select user_id from admins loop
    if exists (select 1 from profiles where id = a.user_id) then
      perform notify(a.user_id, 'signup',
        format('New %s: %s', case when new.role = 'pro' then 'creator' else 'car owner' end, new.name),
        null, '/admin');
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists profiles_notify on public.profiles;
create trigger profiles_notify after insert on public.profiles
  for each row execute function public.notify_signup();

revoke execute on function public.notify_new_request(), public.notify_request_offer(), public.notify_booking(),
  public.notify_message(), public.notify_gig(), public.notify_gig_reply(), public.notify_signup() from public, anon, authenticated;

notify pgrst, 'reload schema';
