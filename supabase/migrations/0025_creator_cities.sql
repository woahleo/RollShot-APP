-- Creators can work in up to 3 cities: their home city (pros.city, which still sets their time zone)
-- plus up to 2 more in pros.more_cities. They show in the creators list for each one and hear about
-- requests and crew jobs in each one.

alter table public.pros add column if not exists more_cities text[] not null default '{}';
alter table public.pros add column if not exists all_cities text[] generated always as (array[city] || more_cities) stored;
create index if not exists pros_all_cities on public.pros using gin (all_cities);

-- Tidy the extra cities (no repeats, not the home city) and make sure each one is a real Rollshot city.
create or replace function public.check_pro_cities()
returns trigger language plpgsql set search_path = public as $$
declare bad text;
begin
  new.more_cities := coalesce(array(
    select c from unnest(new.more_cities) with ordinality as t(c, i)
    where c is not null and c <> new.city
    group by c order by min(i)
  ), '{}');
  if cardinality(new.more_cities) > 2 then
    raise exception 'Pick up to 3 cities in all: your home city and 2 more.' using errcode = 'P0001';
  end if;
  select c into bad from unnest(new.more_cities) c where not exists (select 1 from cities where name = c) limit 1;
  if bad is not null then
    raise exception '% isn''t a Rollshot city yet.', bad using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_pro_cities() from public, anon, authenticated;

drop trigger if exists pros_cities on public.pros;
create trigger pros_cities before insert or update of city, more_cities on public.pros
  for each row execute function public.check_pro_cities();

-- City counts on the creators list include creators who also work there.
create or replace function public.city_counts()
returns table (city text, creators bigint) language sql stable security definer set search_path = public as $$
  select c.name, count(p.id) from cities c left join pros p on c.name = any(p.all_cities) and p.photo_count >= 3 group by c.name;
$$;

-- New requests reach creators in any of their cities (same as 0021 otherwise).
create or replace function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.status <> 'open' then return new; end if;
  for p in
    select pr.id from pros pr
    where new.city = any(pr.all_cities)
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

-- Crew jobs too (same as 0019 otherwise).
create or replace function public.notify_gig() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if tg_op = 'INSERT' then
    if new.target_id is not null then
      perform notify(new.target_id, 'crew', format('%s wants to hire you', first_name(new.poster_id)), gig_line(new), '/crew');
    else
      for p in select id from pros where new.city = any(all_cities) and id <> new.poster_id loop
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

notify pgrst, 'reload schema';
