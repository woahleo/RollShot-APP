-- Request board: a car owner posts what they want shot; photographers and videographers reply
-- with an offer in chat. Only the city is shown, never an address or the owner's name.

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  car text not null check (char_length(car) between 2 and 120),
  city text not null check (city in ('West Palm Beach', 'Boca Raton', 'Fort Lauderdale', 'Miami')),
  kind text not null default 'either' check (kind in ('photo', 'video', 'either')),
  shoot_type text not null check (char_length(shoot_type) between 2 and 40),
  date_from date not null,
  date_to date not null,
  budget integer check (budget is null or budget > 0),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists requests_open_idx on public.requests (status, date_to);

-- One row per photographer who replied, so the owner sees how many and nobody replies twice.
create table if not exists public.request_replies (
  request_id uuid not null references public.requests (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, pro_id)
);

-- Notes and the car must not carry contact details either.
create or replace function public.check_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.client_id := auth.uid();
  if not exists (select 1 from profiles where id = new.client_id and role = 'client') then
    raise exception 'Only car owner accounts can post requests';
  end if;
  if tg_op = 'INSERT' and new.date_to < current_date then raise exception 'Pick dates in the future'; end if;
  if new.date_to > new.date_from + 60 then raise exception 'Keep the window under two months'; end if;
  if concat_ws(' ', new.car, new.note) ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
    raise exception 'Contact details are shared after the shoot is confirmed';
  end if;
  return new;
end;
$$;
drop trigger if exists requests_check on public.requests;
create trigger requests_check before insert or update on public.requests
  for each row execute function public.check_request();

alter table public.requests enable row level security;
alter table public.request_replies enable row level security;

create policy "open requests are public" on public.requests for select
  using (status = 'open' or client_id = auth.uid());
create policy "owners post requests" on public.requests for insert to authenticated
  with check (client_id = auth.uid());
create policy "owners edit requests" on public.requests for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "owners delete requests" on public.requests for delete to authenticated
  using (client_id = auth.uid());

create policy "replies seen by both sides" on public.request_replies for select to authenticated
  using (pro_id = auth.uid() or exists (select 1 from requests r where r.id = request_id and r.client_id = auth.uid()));

-- Reply counts for the board, without exposing who replied.
create or replace function public.request_reply_counts(p_ids uuid[])
returns table (request_id uuid, replies bigint) language sql stable security definer set search_path = public as $$
  select request_id, count(*) from request_replies where request_id = any (p_ids) group by request_id;
$$;

-- A photographer replies: opens (or reuses) the chat with the owner, lifts the message limit
-- since the owner asked publicly, and posts a note with the request so both know the context.
create or replace function public.reply_to_request(p_request uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  me uuid := auth.uid();
  tid uuid;
  pname text;
begin
  select * into r from requests where id = p_request;
  if not found or r.status <> 'open' then raise exception 'This request is closed'; end if;
  if not exists (select 1 from pros where id = me) then raise exception 'Only photographers and videographers can reply'; end if;
  select thread_id into tid from request_replies where request_id = p_request and pro_id = me;
  if tid is not null then return tid; end if;
  insert into threads (pro_id, client_id, unlimited) values (me, r.client_id, true)
    on conflict (pro_id, client_id) do update set unlimited = true, updated_at = now()
    returning id into tid;
  insert into request_replies (request_id, pro_id, thread_id) values (p_request, me, tid);
  select name into pname from profiles where id = me;
  insert into messages (thread_id, kind, body) values (tid, 'system',
    format('%s replied to your request: %s · %s · %s, %s to %s%s.', pname, r.shoot_type, r.car, r.city,
      to_char(r.date_from, 'Mon FMDD'), to_char(r.date_to, 'Mon FMDD'),
      case when r.budget is not null then format(' · budget $%s', r.budget) else '' end));
  return tid;
end;
$$;

grant select on public.requests to anon, authenticated;
grant insert, update, delete on public.requests to authenticated;
grant select on public.request_replies to authenticated;
grant all on public.requests, public.request_replies to service_role;
revoke execute on function public.request_reply_counts(uuid[]) from public;
revoke execute on function public.reply_to_request(uuid) from public, anon;
grant execute on function public.request_reply_counts(uuid[]) to anon, authenticated;
grant execute on function public.reply_to_request(uuid) to authenticated;
