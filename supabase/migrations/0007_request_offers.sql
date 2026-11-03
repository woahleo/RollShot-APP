-- Request board, version 2: the car owner posts a date, photographers send an offer
-- (price + short note), and the owner compares them and chooses one. Choosing books it.

alter table public.request_replies
  alter column thread_id drop not null,
  add column if not exists price integer check (price is null or price > 0),
  add column if not exists note text check (note is null or char_length(note) <= 300),
  add column if not exists status text not null default 'waiting' check (status in ('waiting', 'chosen', 'passed'));

alter table public.requests
  add column if not exists chosen_pro uuid references public.pros (id) on delete set null,
  add column if not exists booking_id uuid references public.bookings (id) on delete set null;

-- Replies used to open a chat right away; now they're offers the owner compares.
drop function if exists public.reply_to_request(uuid);

-- A photographer sends (or updates) their offer on an open request.
create or replace function public.offer_on_request(p_request uuid, p_price integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  me uuid := auth.uid();
begin
  select * into r from requests where id = p_request;
  if not found or r.status <> 'open' then raise exception 'This request is closed'; end if;
  if not exists (select 1 from pros where id = me) then raise exception 'Only photographers and videographers can send offers'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Add a price'; end if;
  if coalesce(p_note, '') ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
    raise exception 'Contact details are shared after the shoot is confirmed';
  end if;
  insert into request_replies (request_id, pro_id, price, note)
    values (p_request, me, p_price, nullif(trim(p_note), ''))
    on conflict (request_id, pro_id) do update set price = excluded.price, note = excluded.note, created_at = now();
end;
$$;

-- The owner wants to ask a photographer something before choosing: open a chat with no message limit.
create or replace function public.open_request_chat(p_request uuid, p_pro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if not exists (select 1 from requests where id = p_request and client_id = auth.uid()) then raise exception 'Request not found'; end if;
  if not exists (select 1 from request_replies where request_id = p_request and pro_id = p_pro) then raise exception 'Offer not found'; end if;
  insert into threads (pro_id, client_id, unlimited) values (p_pro, auth.uid(), true)
    on conflict (pro_id, client_id) do update set unlimited = true
    returning id into tid;
  update request_replies set thread_id = tid where request_id = p_request and pro_id = p_pro;
  return tid;
end;
$$;

-- The owner chooses one offer: it's booked and confirmed on the request's date, the request closes,
-- and the chosen photographer gets a note in chat.
create or replace function public.choose_offer(p_request uuid, p_pro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  o request_replies%rowtype;
  bid uuid;
  cname text;
begin
  select * into r from requests where id = p_request for update;
  if not found or r.client_id <> auth.uid() then raise exception 'Request not found'; end if;
  if r.status <> 'open' then raise exception 'You already chose someone for this request'; end if;
  if r.date_from < current_date then raise exception 'This date has passed'; end if;
  select * into o from request_replies where request_id = p_request and pro_id = p_pro;
  if not found then raise exception 'Offer not found'; end if;
  insert into bookings (pro_id, client_id, package_name, price, shoot_date, car, status)
    values (p_pro, r.client_id, r.shoot_type, o.price, r.date_from, r.car, 'confirmed')
    returning id into bid;
  update requests set status = 'closed', chosen_pro = p_pro, booking_id = bid where id = p_request;
  update request_replies set status = case when pro_id = p_pro then 'chosen' else 'passed' end where request_id = p_request;
  update pros set open_dates = array_remove(open_dates, r.date_from) where id = p_pro;
  update threads set unlimited = true where pro_id = p_pro and client_id = r.client_id;
  select name into cname from profiles where id = r.client_id;
  perform post_system_note(p_pro, r.client_id,
    format('%s chose your offer: %s, %s, %s for $%s. Chat is fully open now.',
      cname, r.shoot_type, r.car, to_char(r.date_from, 'Dy, Mon FMDD'), o.price));
  return bid;
end;
$$;

revoke execute on function public.offer_on_request(uuid, integer, text) from public, anon;
revoke execute on function public.open_request_chat(uuid, uuid) from public, anon;
revoke execute on function public.choose_offer(uuid, uuid) from public, anon;
grant execute on function public.offer_on_request(uuid, integer, text) to authenticated;
grant execute on function public.open_request_chat(uuid, uuid) to authenticated;
grant execute on function public.choose_offer(uuid, uuid) to authenticated;

-- Photographers keep seeing requests they offered on after they close, to know if they were chosen.
create or replace function public.has_offered(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from request_replies where request_id = p_request and pro_id = auth.uid());
$$;
grant execute on function public.has_offered(uuid) to authenticated;
drop policy if exists "pros see requests they offered on" on public.requests;
create policy "pros see requests they offered on" on public.requests for select to authenticated
  using (public.has_offered(id));
