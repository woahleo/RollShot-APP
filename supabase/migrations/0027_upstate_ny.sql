-- Opens Buffalo, Rochester and Syracuse, listed right after New York City.
-- Safe to run more than once.

update public.cities set position = position + 3
  where position > 8 and not exists (select 1 from public.cities where name = 'Buffalo');

insert into public.cities (name, state, tz, region, position) values
  ('Buffalo', 'NY', 'America/New_York', 'Northeast', 9),
  ('Rochester', 'NY', 'America/New_York', 'Northeast', 10),
  ('Syracuse', 'NY', 'America/New_York', 'Northeast', 11)
on conflict (name) do update set state = excluded.state, tz = excluded.tz, region = excluded.region, position = excluded.position;
