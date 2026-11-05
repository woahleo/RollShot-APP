-- Rollshot opens in major US cities. The four South Florida cities stay as they are, so
-- nobody's profile or requests change. Each city has a time zone, used for late cancels.
-- To open another city later, add a row here and to src/lib/cities.ts.
-- Run after 0021_free_shoots.sql. Safe to run more than once.

create table if not exists public.cities (
  name text primary key,
  state text not null,
  tz text not null,
  region text not null,
  position int not null default 0
);
alter table public.cities enable row level security;
drop policy if exists "cities are public" on public.cities;
create policy "cities are public" on public.cities for select using (true);
grant select on public.cities to anon, authenticated;

insert into public.cities (name, state, tz, region, position) values
  ('Miami', 'FL', 'America/New_York', 'Florida', 1),
  ('Fort Lauderdale', 'FL', 'America/New_York', 'Florida', 2),
  ('Boca Raton', 'FL', 'America/New_York', 'Florida', 3),
  ('West Palm Beach', 'FL', 'America/New_York', 'Florida', 4),
  ('Orlando', 'FL', 'America/New_York', 'Florida', 5),
  ('Tampa', 'FL', 'America/New_York', 'Florida', 6),
  ('Jacksonville', 'FL', 'America/New_York', 'Florida', 7),
  ('New York City', 'NY', 'America/New_York', 'Northeast', 8),
  ('Boston', 'MA', 'America/New_York', 'Northeast', 9),
  ('Philadelphia', 'PA', 'America/New_York', 'Northeast', 10),
  ('Washington', 'DC', 'America/New_York', 'Northeast', 11),
  ('Atlanta', 'GA', 'America/New_York', 'South', 12),
  ('Charlotte', 'NC', 'America/New_York', 'South', 13),
  ('Raleigh', 'NC', 'America/New_York', 'South', 14),
  ('Nashville', 'TN', 'America/Chicago', 'South', 15),
  ('Houston', 'TX', 'America/Chicago', 'Texas', 16),
  ('Dallas', 'TX', 'America/Chicago', 'Texas', 17),
  ('Austin', 'TX', 'America/Chicago', 'Texas', 18),
  ('San Antonio', 'TX', 'America/Chicago', 'Texas', 19),
  ('Chicago', 'IL', 'America/Chicago', 'Midwest', 20),
  ('Detroit', 'MI', 'America/Detroit', 'Midwest', 21),
  ('Columbus', 'OH', 'America/New_York', 'Midwest', 22),
  ('Minneapolis', 'MN', 'America/Chicago', 'Midwest', 23),
  ('St. Louis', 'MO', 'America/Chicago', 'Midwest', 24),
  ('Kansas City', 'MO', 'America/Chicago', 'Midwest', 25),
  ('Denver', 'CO', 'America/Denver', 'West', 26),
  ('Phoenix', 'AZ', 'America/Phoenix', 'West', 27),
  ('Las Vegas', 'NV', 'America/Los_Angeles', 'West', 28),
  ('Salt Lake City', 'UT', 'America/Denver', 'West', 29),
  ('Los Angeles', 'CA', 'America/Los_Angeles', 'California', 30),
  ('San Diego', 'CA', 'America/Los_Angeles', 'California', 31),
  ('San Francisco', 'CA', 'America/Los_Angeles', 'California', 32),
  ('San Jose', 'CA', 'America/Los_Angeles', 'California', 33),
  ('Sacramento', 'CA', 'America/Los_Angeles', 'California', 34),
  ('Seattle', 'WA', 'America/Los_Angeles', 'Northwest', 35),
  ('Portland', 'OR', 'America/Los_Angeles', 'Northwest', 36)
on conflict (name) do update set state = excluded.state, tz = excluded.tz, region = excluded.region, position = excluded.position;

-- Creators and requests must be in an open city.
alter table public.pros drop constraint if exists pros_city_check;
alter table public.pros drop constraint if exists pros_city_fkey;
alter table public.pros add constraint pros_city_fkey foreign key (city) references public.cities (name) on update cascade;
alter table public.requests drop constraint if exists requests_city_check;
alter table public.requests drop constraint if exists requests_city_fkey;
alter table public.requests add constraint requests_city_fkey foreign key (city) references public.cities (name) on update cascade;
create index if not exists pros_city_idx on public.pros (city);
create index if not exists requests_city_idx on public.requests (city, status);

-- Today's date where a creator is, so "within 48 hours" means local days, not UTC.
create or replace function public.local_today(p_city text) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select tz from cities where name = p_city), 'America/New_York'))::date;
$$;

create or replace function public.cancel_booking(p_booking uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  me uuid := auth.uid();
  late boolean;
  who text;
  local date;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or (b.pro_id <> me and b.client_id <> me) then raise exception 'Booking not found'; end if;
  if b.status in ('declined', 'cancelled') then raise exception 'This booking is already off'; end if;
  local := local_today((select city from pros where id = b.pro_id));
  if b.shoot_date < local then raise exception 'This shoot already happened'; end if;
  -- Within 48 hours of the shoot day (today or tomorrow where the shoot is), unless it was never accepted.
  late := b.status <> 'requested' and b.shoot_date <= local + 1;
  update bookings set status = 'cancelled', cancelled_by = me, cancelled_at = now(), late_cancel = late
    where id = p_booking;
  -- The photographer is free that day again.
  if b.status <> 'requested' then
    update pros set open_dates = array_append(array_remove(open_dates, b.shoot_date), b.shoot_date)
      where id = b.pro_id;
  end if;
  select name into who from profiles where id = me;
  perform post_system_note(b.pro_id, b.client_id,
    format('%s cancelled the shoot on %s%s.%s', who, to_char(b.shoot_date, 'Dy, Mon FMDD'),
      case when late then ' (late cancel)' else '' end,
      case when coalesce(trim(p_reason), '') <> '' then ' Reason: ' || left(trim(p_reason), 200) else '' end));
end;
$$;

-- How many creators each city has, for the city pickers and "be the first" prompts.
create or replace function public.city_counts()
returns table (city text, creators bigint) language sql stable security definer set search_path = public as $$
  select c.name, count(p.id) from cities c left join pros p on p.city = c.name group by c.name;
$$;
grant execute on function public.city_counts(), public.local_today(text) to anon, authenticated;

notify pgrst, 'reload schema';
