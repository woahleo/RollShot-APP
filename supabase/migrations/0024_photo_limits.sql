-- Portfolio photo limits: a creator has 3 to 10 portfolio photos.
--  * New creators add at least 3 photos when they sign up (the app's insert is refused otherwise).
--  * Nobody can go above 10. Anyone who already has more keeps them, but can only remove.
--  * Once a creator has 3, they can't remove below 3.
--  * Creators with fewer than 3 (older accounts, or people who switched from a car owner account)
--    keep their account and page, but don't show in the creators list until they add more.
-- Avatars, car photos and shoot posts live in the same bucket but aren't portfolio photos, so they don't count.

alter table public.pros add column if not exists photo_count int generated always as (cardinality(photos)) stored;
create index if not exists pros_photo_count on public.pros (photo_count);

create or replace function public.check_pro_photos()
returns trigger language plpgsql set search_path = public as $$
declare
  n int := cardinality(new.photos);
  was int := case when tg_op = 'UPDATE' then cardinality(old.photos) else 0 end;
begin
  if n > 10 and n > was then
    raise exception 'You can have up to 10 photos. Remove one to add another.' using errcode = 'P0001';
  end if;
  -- Only sign-ups from the app need 3 up front. switch_role (a car owner becoming a creator) runs
  -- as the database owner and is let through; that creator adds photos afterwards.
  if tg_op = 'INSERT' and n < 3 and current_user = 'authenticated' then
    raise exception 'Add at least 3 photos to make your creator account.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and n < 3 and was >= 3 then
    raise exception 'Keep at least 3 photos on your page.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_pro_photos() from public, anon, authenticated;

drop trigger if exists pros_photo_limits on public.pros;
create trigger pros_photo_limits before insert or update of photos on public.pros
  for each row execute function public.check_pro_photos();

-- City counts on the creators list only count creators who show in it.
create or replace function public.city_counts()
returns table (city text, creators bigint) language sql stable security definer set search_path = public as $$
  select c.name, count(p.id) from cities c left join pros p on p.city = c.name and p.photo_count >= 3 group by c.name;
$$;

notify pgrst, 'reload schema';
