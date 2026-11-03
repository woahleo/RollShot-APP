-- Car owners add their own photos of each car in their garage, so creators can see what they'd be shooting.
-- The photos show on the car's page and on the owner's profile, which creators open from their name.
-- Needs 0009_shoot_posts.sql first. Safe to run more than once.

alter table public.cars add column if not exists photos text[] not null default '{}'; -- paths in the "portfolio" bucket

-- Every photo has to sit in the owner's own folder, and a car holds up to 12.
create or replace function public.paths_in_folder(p_paths text[], p_owner uuid) returns boolean
language sql immutable as $$
  select coalesce(bool_and(split_part(p, '/', 1) = p_owner::text), true) from unnest(p_paths) p;
$$;
alter table public.cars drop constraint if exists cars_photos_own_folder;
alter table public.cars add constraint cars_photos_own_folder
  check (cardinality(photos) <= 12 and public.paths_in_folder(photos, owner_id));
