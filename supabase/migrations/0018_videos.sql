-- Creators upload up to 6 of their own videos (straight from their phone) to play on their page.
-- Each is a path in the "portfolio" bucket, in the creator's own folder; its cover image sits next to it
-- with the same name ending in .jpg. Uploaded videos and Instagram links together stay at 6 or fewer.
-- Needs 0016_reels.sql first. Safe to run more than once.

alter table public.pros add column if not exists videos text[] not null default '{}';

create or replace function public.paths_in_folder(p_paths text[], p_owner uuid) returns boolean
language sql immutable as $$
  select coalesce(bool_and(split_part(p, '/', 1) = p_owner::text), true) from unnest(p_paths) p;
$$;

alter table public.pros drop constraint if exists pros_videos_valid;
alter table public.pros add constraint pros_videos_valid
  check (cardinality(videos) + cardinality(reels) <= 6 and public.paths_in_folder(videos, id));
