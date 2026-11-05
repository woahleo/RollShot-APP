-- Free portfolio shoots: car owners can post a request for a free shoot, creators can offer to
-- shoot for free ($0), and creators can post unpaid crew jobs for experience.
-- Run after 0020_edit_posts.sql. Safe to run more than once.

-- 1) A request can be a free portfolio shoot. Free requests have no budget.
alter table public.requests add column if not exists free boolean not null default false;
alter table public.requests drop constraint if exists requests_free_no_budget;
alter table public.requests add constraint requests_free_no_budget check (not free or budget is null);

-- 2) $0 is allowed for offers, bookings and crew pay. Packages on a creator's page stay paid.
alter table public.request_replies drop constraint if exists request_replies_price_check;
alter table public.request_replies add constraint request_replies_price_check check (price is null or price >= 0);
alter table public.bookings drop constraint if exists bookings_price_check;
alter table public.bookings add constraint bookings_price_check check (price >= 0);
alter table public.gigs drop constraint if exists gigs_pay_check;
alter table public.gigs add constraint gigs_pay_check check (pay between 0 and 100000);

create or replace function public.price_text(n integer) returns text
language sql immutable as $$ select case when n = 0 then 'free' else '$' || n end $$;

-- Offers: $0 means "I'll shoot it free".
create or replace function public.offer_on_request(p_request uuid, p_price integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  me uuid := auth.uid();
begin
  select * into r from requests where id = p_request;
  if not found or r.status <> 'open' then raise exception 'This request is closed'; end if;
  if not exists (select 1 from pros where id = me) then raise exception 'Only photographers and videographers can send offers'; end if;
  if p_price is null or p_price < 0 then raise exception 'Add a price, or 0 to shoot it free'; end if;
  if coalesce(p_note, '') ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
    raise exception 'Contact details are shared after the shoot is confirmed';
  end if;
  insert into request_replies (request_id, pro_id, price, note)
    values (p_request, me, p_price, nullif(trim(p_note), ''))
    on conflict (request_id, pro_id) do update set price = excluded.price, note = excluded.note, created_at = now();
end;
$$;

-- Choosing an offer: same as before, with "free" in the chat note for a $0 offer.
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
    values (p_pro, r.client_id, r.shoot_type, coalesce(o.price, 0), r.date_from, r.car, 'confirmed')
    returning id into bid;
  update requests set status = 'closed', chosen_pro = p_pro, booking_id = bid where id = p_request;
  update request_replies set status = case when pro_id = p_pro then 'chosen' else 'passed' end where request_id = p_request;
  update pros set open_dates = array_remove(open_dates, r.date_from) where id = p_pro;
  update threads set unlimited = true where pro_id = p_pro and client_id = r.client_id;
  select name into cname from profiles where id = r.client_id;
  perform post_system_note(p_pro, r.client_id,
    format('%s chose your offer: %s, %s, %s, %s. Chat is fully open now.',
      cname, r.shoot_type, r.car, to_char(r.date_from, 'Dy, Mon FMDD'), price_text(coalesce(o.price, 0))));
  return bid;
end;
$$;

-- Crew job lines read "unpaid, for experience" instead of "$0".
create or replace function public.gig_line(g gigs) returns text
language sql stable as $$
  select format('%s on %s%s in %s, %s', lower(g.role), to_char(g.shoot_date, 'Dy, Mon FMDD'),
    case when g.shoot_time is null then '' else ' at ' || to_char(g.shoot_time, 'FMHH12:MI AM') end,
    g.city, case when g.pay = 0 then 'unpaid, for experience' else 'for $' || g.pay end);
$$;

-- 3) Notifications say when it's free.
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
    perform notify(p.id, 'request',
      case when new.free then format('Free portfolio shoot in %s', new.city) else format('New request in %s', new.city) end,
      format('%s · %s · %s%s', new.car, new.shoot_type,
        case when new.date_from = new.date_to then short_date(new.date_from)
             else short_date(new.date_from) || ' to ' || short_date(new.date_to) end,
        case when new.free then ' · for your portfolio' when new.budget is null then '' else format(' · up to $%s', new.budget) end),
      '/requests/' || new.id);
  end loop;
  return new;
end;
$$;

create or replace function public.notify_request_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare r requests%rowtype;
begin
  if tg_op = 'UPDATE' and old.price is not distinct from new.price and old.note is not distinct from new.note then
    return new;
  end if;
  select * into r from requests where id = new.request_id;
  perform notify(r.client_id, 'offer',
    case when new.price = 0 then format('%s offered to shoot it free', first_name(new.pro_id))
         else format('%s sent an offer%s', first_name(new.pro_id), case when new.price is null then '' else format(': $%s', new.price) end) end,
    format('For your %s request', r.car), '/requests/' || r.id);
  return new;
end;
$$;

revoke execute on function public.notify_new_request(), public.notify_request_offer() from public, anon, authenticated;

notify pgrst, 'reload schema';
