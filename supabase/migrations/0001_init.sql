-- Rollshot core schema: accounts, photographer profiles, bookings and chat.
-- Run in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists pgcrypto;

-- ---------- accounts ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('client', 'pro')),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  year text,
  make text,
  model text,
  color text,
  mods text,
  created_at timestamptz not null default now()
);

-- ---------- photographers ----------
create table public.pros (
  id uuid primary key references public.profiles (id) on delete cascade,
  city text not null check (city in ('West Palm Beach', 'Boca Raton', 'Fort Lauderdale', 'Miami')),
  about text check (char_length(about) <= 400),
  shoot_types text[] not null default '{}',
  open_dates date[] not null default '{}',
  photos text[] not null default '{}', -- storage paths in the "portfolio" bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contact details stay private until a shoot is confirmed (see the policy below).
create table public.pro_contacts (
  pro_id uuid primary key references public.pros (id) on delete cascade,
  instagram text check (char_length(instagram) <= 60),
  phone text check (char_length(phone) <= 30)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.pros (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  price integer not null check (price > 0 and price <= 100000),
  position smallint not null default 0
);

-- ---------- bookings ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.pros (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  package_name text not null,
  price integer not null check (price > 0),
  shoot_date date not null,
  car text,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'declined', 'rescheduled')),
  rain_from date,
  created_at timestamptz not null default now()
);
create index bookings_pro_idx on public.bookings (pro_id);
create index bookings_client_idx on public.bookings (client_id);

-- ---------- chat ----------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.pros (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (pro_id, client_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null, -- null for system notes
  kind text not null default 'text' check (kind in ('text', 'system', 'offer')),
  body text not null check (char_length(body) between 1 and 2000),
  package_id uuid references public.packages (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

-- ---------- helpers ----------
create or replace function public.has_confirmed_booking(p_pro uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where pro_id = p_pro and client_id = p_client and status in ('confirmed', 'rescheduled')
  );
$$;

create or replace function public.has_open_booking(p_pro uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where pro_id = p_pro and client_id = p_client and status <> 'declined'
  );
$$;

create or replace function public.is_thread_member(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from threads
    where id = p_thread and (pro_id = auth.uid() or client_id = auth.uid())
  );
$$;

-- Chat rules, enforced on the server:
-- 1. Before a shoot is confirmed, phone numbers, handles and outside payment apps are blocked.
-- 2. Before any booking request, a client can send at most 3 messages to a photographer.
create or replace function public.check_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t threads%rowtype;
  sent integer;
begin
  select * into t from threads where id = new.thread_id;
  if new.kind = 'system' then
    new.sender_id := null;
  else
    new.sender_id := auth.uid();
  end if;
  if new.kind = 'offer' and new.sender_id is distinct from t.pro_id then
    raise exception 'Only the photographer can send an offer';
  end if;
  if new.kind <> 'system' and not has_confirmed_booking(t.pro_id, t.client_id) then
    if new.body ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
      raise exception 'Contact details are shared after the shoot is confirmed';
    end if;
    if new.sender_id = t.client_id and not has_open_booking(t.pro_id, t.client_id) then
      select count(*) into sent from messages
        where thread_id = new.thread_id and sender_id = t.client_id and kind = 'text';
      if sent >= 3 then
        raise exception 'Request a booking to keep chatting';
      end if;
    end if;
  end if;
  update threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;
create trigger messages_check before insert on public.messages
  for each row execute function public.check_message();

-- Posts a system note into the pair's thread, creating the thread if needed.
create or replace function public.post_system_note(p_pro uuid, p_client uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  insert into threads (pro_id, client_id) values (p_pro, p_client)
    on conflict (pro_id, client_id) do update set updated_at = now()
    returning id into tid;
  insert into messages (thread_id, kind, body) values (tid, 'system', p_body);
end;
$$;
revoke execute on function public.post_system_note(uuid, uuid, text) from public, anon, authenticated;

-- ---------- booking actions (the only way bookings change) ----------
create or replace function public.request_booking(p_package uuid, p_date date, p_car text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pk packages%rowtype;
  bid uuid;
  cname text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into pk from packages where id = p_package;
  if not found then raise exception 'That package no longer exists'; end if;
  if pk.pro_id = auth.uid() then raise exception 'You cannot book yourself'; end if;
  if p_date < current_date then raise exception 'Pick a future date'; end if;
  if not exists (select 1 from pros where id = pk.pro_id and p_date = any (open_dates)) then
    raise exception 'That date is not open';
  end if;
  insert into bookings (pro_id, client_id, package_name, price, shoot_date, car)
    values (pk.pro_id, auth.uid(), pk.name, pk.price, p_date, left(p_car, 120))
    returning id into bid;
  select name into cname from profiles where id = auth.uid();
  perform post_system_note(pk.pro_id, auth.uid(),
    format('%s requested %s on %s.', cname, pk.name, to_char(p_date, 'Dy, Mon FMDD')));
  return bid;
end;
$$;

create or replace function public.respond_booking(p_booking uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.pro_id <> auth.uid() then raise exception 'Booking not found'; end if;
  if b.status <> 'requested' then raise exception 'This request was already answered'; end if;
  update bookings set status = case when p_accept then 'confirmed' else 'declined' end where id = p_booking;
  if p_accept then -- a confirmed date is no longer open to other clients
    update pros set open_dates = array_remove(open_dates, b.shoot_date) where id = b.pro_id;
  end if;
  perform post_system_note(b.pro_id, b.client_id,
    case when p_accept
      then format('Booking confirmed for %s. Chat is fully open now.', to_char(b.shoot_date, 'Dy, Mon FMDD'))
      else 'Booking declined.' end);
end;
$$;

create or replace function public.rain_check(p_booking uuid, p_new_date date)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or (b.pro_id <> auth.uid() and b.client_id <> auth.uid()) then
    raise exception 'Booking not found';
  end if;
  if b.status = 'declined' then raise exception 'This booking was declined'; end if;
  if p_new_date < current_date or p_new_date = b.shoot_date then raise exception 'Pick another future date'; end if;
  if not exists (select 1 from pros where id = b.pro_id and p_new_date = any (open_dates)) then
    raise exception 'That date is not open';
  end if;
  update bookings
    set rain_from = b.shoot_date, shoot_date = p_new_date,
        status = case when b.status = 'requested' then 'requested' else 'rescheduled' end
    where id = p_booking;
  if b.status <> 'requested' then -- free the old date, hold the new one
    update pros set open_dates = array_append(array_remove(open_dates, p_new_date), b.shoot_date)
      where id = b.pro_id;
  end if;
  perform post_system_note(b.pro_id, b.client_id,
    format('Rain check: shoot moved from %s to %s. No fee.',
      to_char(b.shoot_date, 'Dy, Mon FMDD'), to_char(p_new_date, 'Dy, Mon FMDD')));
end;
$$;

-- Opens (or finds) the chat thread between the signed-in client and a photographer.
create or replace function public.open_thread(p_pro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_pro = auth.uid() then raise exception 'You cannot message yourself'; end if;
  if not exists (select 1 from pros where id = p_pro) then raise exception 'Photographer not found'; end if;
  insert into threads (pro_id, client_id) values (p_pro, auth.uid())
    on conflict (pro_id, client_id) do update set updated_at = threads.updated_at
    returning id into tid;
  return tid;
end;
$$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.pros enable row level security;
alter table public.packages enable row level security;
alter table public.pro_contacts enable row level security;
alter table public.bookings enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "create own profile" on public.profiles for insert with check (id = auth.uid());
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own cars" on public.cars for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "photographers are public" on public.pros for select using (true);
create policy "create own pro profile" on public.pros for insert with check (id = auth.uid());
create policy "edit own pro profile" on public.pros for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own contact details" on public.pro_contacts for all
  using (pro_id = auth.uid()) with check (pro_id = auth.uid());
create policy "contact details after a confirmed shoot" on public.pro_contacts for select
  using (public.has_confirmed_booking(pro_id, auth.uid()));

create policy "packages are public" on public.packages for select using (true);
create policy "manage own packages" on public.packages for all using (pro_id = auth.uid()) with check (pro_id = auth.uid());

-- Bookings are read by the two people involved and changed only through the functions above.
create policy "see own bookings" on public.bookings for select
  using (client_id = auth.uid() or pro_id = auth.uid());

create policy "see own threads" on public.threads for select
  using (client_id = auth.uid() or pro_id = auth.uid());

create policy "see own messages" on public.messages for select using (public.is_thread_member(thread_id));
create policy "send in own threads" on public.messages for insert
  with check (kind <> 'system' and public.is_thread_member(thread_id));

grant execute on function public.request_booking(uuid, date, text) to authenticated;
grant execute on function public.respond_booking(uuid, boolean) to authenticated;
grant execute on function public.rain_check(uuid, date) to authenticated;
grant execute on function public.open_thread(uuid) to authenticated;

-- ---------- live updates ----------
alter publication supabase_realtime add table public.messages, public.bookings;

-- ---------- portfolio photos ----------
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true)
  on conflict (id) do nothing;
create policy "portfolio photos are public" on storage.objects for select
  using (bucket_id = 'portfolio');
create policy "upload to own portfolio folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own portfolio photos" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
