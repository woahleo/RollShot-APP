-- Hours for open days, and a start time on bookings.
-- Photographers can give an open day hours ("16:00-20:00"); car owners then pick a start time inside them.
-- Days without hours stay flexible: the time gets agreed in chat. Safe to run more than once; it only adds things.

-- 1) Hours per open day: { "2026-11-06": "16:00-20:00", ... }
alter table public.pros add column if not exists open_hours jsonb not null default '{}'::jsonb;
alter table public.pros drop constraint if exists pros_open_hours_object;
alter table public.pros add constraint pros_open_hours_object check (jsonb_typeof(open_hours) = 'object');

-- 2) The start time a car owner picked.
alter table public.bookings add column if not exists shoot_time time;

-- 3) Booking now takes an optional start time, checked against the day's hours.
--    Old app versions that send no time keep working on days without hours.
drop function if exists public.request_booking(uuid, date, text);
create or replace function public.request_booking(p_package uuid, p_date date, p_car text, p_time time default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pk packages%rowtype;
  bid uuid;
  cname text;
  hours text;
  t_from time;
  t_to time;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into pk from packages where id = p_package;
  if not found then raise exception 'That package no longer exists'; end if;
  if pk.pro_id = auth.uid() then raise exception 'You cannot book yourself'; end if;
  if p_date < current_date then raise exception 'Pick a future date'; end if;
  if not exists (select 1 from pros where id = pk.pro_id and p_date = any (open_dates)) then
    raise exception 'That date is not open';
  end if;

  select open_hours ->> p_date::text into hours from pros where id = pk.pro_id;
  if hours ~ '^\d\d:\d\d-\d\d:\d\d$' then
    t_from := split_part(hours, '-', 1)::time;
    t_to := split_part(hours, '-', 2)::time;
    if p_time is null then raise exception 'Pick a start time'; end if;
    if p_time < t_from or p_time >= t_to then
      raise exception 'Pick a start time between % and %', to_char(t_from, 'FMHH12:MI AM'), to_char(t_to, 'FMHH12:MI AM');
    end if;
  end if;

  insert into bookings (pro_id, client_id, package_name, price, shoot_date, car, shoot_time)
    values (pk.pro_id, auth.uid(), pk.name, pk.price, p_date, left(p_car, 120), p_time)
    returning id into bid;
  select name into cname from profiles where id = auth.uid();
  perform post_system_note(pk.pro_id, auth.uid(),
    format('%s requested %s on %s%s.', cname, pk.name, to_char(p_date, 'Dy, Mon FMDD'),
      case when p_time is null then '' else ' at ' || to_char(p_time, 'FMHH12:MI AM') end));
  return bid;
end;
$$;
revoke execute on function public.request_booking(uuid, date, text, time) from public, anon;
grant execute on function public.request_booking(uuid, date, text, time) to authenticated;
