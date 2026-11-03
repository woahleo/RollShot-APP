-- Chat tools for photographers and videographers:
-- 1. Let a car owner keep messaging before they book (lifts the 3-message limit for that chat).
-- 2. Send an offer in chat: a package or custom price plus a few dates; the car owner taps a date to book it.

alter table public.threads add column if not exists unlimited boolean not null default false;

alter table public.messages
  add column if not exists offer_name text,
  add column if not exists offer_price integer,
  add column if not exists offer_dates date[],
  add column if not exists booking_id uuid references public.bookings (id) on delete set null;

-- Same rules as before, plus: the limit is lifted when the photographer allows it,
-- and offers can only be made through send_offer().
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
  if new.kind = 'offer' and (new.sender_id is distinct from t.pro_id or current_setting('rollshot.offer', true) is distinct from 'on') then
    raise exception 'Only the photographer can send an offer';
  end if;
  if new.kind = 'text' then
    new.offer_name := null; new.offer_price := null; new.offer_dates := null; new.booking_id := null;
  end if;
  if new.kind <> 'system' and not has_confirmed_booking(t.pro_id, t.client_id) then
    if new.body ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
      raise exception 'Contact details are shared after the shoot is confirmed';
    end if;
    if new.sender_id = t.client_id and not t.unlimited and not has_open_booking(t.pro_id, t.client_id) then
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

-- Photographer turns unlimited messaging on or off for one chat.
create or replace function public.set_thread_unlimited(p_thread uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t threads%rowtype;
begin
  select * into t from threads where id = p_thread;
  if not found or t.pro_id <> auth.uid() then raise exception 'Chat not found'; end if;
  if t.unlimited = p_on then return; end if;
  update threads set unlimited = p_on where id = p_thread;
  insert into messages (thread_id, kind, body) values (p_thread, 'system',
    case when p_on then 'You can message as much as you like now.' else 'Message limit is back on until a date is requested.' end);
end;
$$;

-- Photographer offers a package (or a custom price) on up to 5 dates.
create or replace function public.send_offer(p_thread uuid, p_name text, p_price integer, p_dates date[], p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t threads%rowtype;
  ds date[];
  mid uuid;
begin
  select * into t from threads where id = p_thread;
  if not found or t.pro_id <> auth.uid() then raise exception 'Chat not found'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name the shoot'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Add a price'; end if;
  select array_agg(d order by d) into ds from (select distinct unnest(p_dates) d) x where d >= current_date;
  if ds is null then raise exception 'Pick at least one date'; end if;
  if array_length(ds, 1) > 5 then raise exception 'Offer up to 5 dates'; end if;
  perform set_config('rollshot.offer', 'on', true);
  insert into messages (thread_id, kind, body, offer_name, offer_price, offer_dates)
    values (p_thread, 'offer', coalesce(nullif(trim(p_note), ''), 'Pick a date that works for you.'), left(trim(p_name), 80), p_price, ds)
    returning id into mid;
  perform set_config('rollshot.offer', 'off', true);
  return mid;
end;
$$;

-- Car owner picks one of the offered dates. The photographer proposed it, so it's confirmed right away.
create or replace function public.accept_offer(p_message uuid, p_date date, p_car text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m messages%rowtype;
  t threads%rowtype;
  bid uuid;
begin
  select * into m from messages where id = p_message for update;
  if not found or m.kind <> 'offer' then raise exception 'Offer not found'; end if;
  select * into t from threads where id = m.thread_id;
  if t.client_id <> auth.uid() then raise exception 'Offer not found'; end if;
  if m.booking_id is not null then raise exception 'This offer was already booked'; end if;
  if p_date < current_date or not (p_date = any (m.offer_dates)) then raise exception 'Pick one of the offered dates'; end if;
  insert into bookings (pro_id, client_id, package_name, price, shoot_date, car, status)
    values (t.pro_id, t.client_id, m.offer_name, m.offer_price, p_date, left(p_car, 120), 'confirmed')
    returning id into bid;
  update messages set booking_id = bid where id = p_message;
  update pros set open_dates = array_remove(open_dates, p_date) where id = t.pro_id;
  insert into messages (thread_id, kind, body) values (t.id, 'system',
    format('Booked: %s on %s for $%s. Chat is fully open now.', m.offer_name, to_char(p_date, 'Dy, Mon FMDD'), m.offer_price));
  return bid;
end;
$$;

revoke execute on function public.set_thread_unlimited(uuid, boolean) from public, anon;
revoke execute on function public.send_offer(uuid, text, integer, date[], text) from public, anon;
revoke execute on function public.accept_offer(uuid, date, text) from public, anon;
grant execute on function public.set_thread_unlimited(uuid, boolean) to authenticated;
grant execute on function public.send_offer(uuid, text, integer, date[], text) to authenticated;
grant execute on function public.accept_offer(uuid, date, text) to authenticated;
