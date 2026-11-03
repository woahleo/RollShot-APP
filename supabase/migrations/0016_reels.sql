-- Creators pick up to 6 of their Instagram reels (or video posts) to play on their Rollshot page.
-- Stored as clean Instagram links, in the order the creator chose. Safe to run more than once.

alter table public.pros add column if not exists reels text[] not null default '{}';

create or replace function public.valid_reel_links(p_links text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(l ~ '^https://www\.instagram\.com/(reel|p|tv)/[A-Za-z0-9_-]{5,40}/$'), true) from unnest(p_links) l;
$$;
alter table public.pros drop constraint if exists pros_reels_valid;
alter table public.pros add constraint pros_reels_valid
  check (cardinality(reels) <= 6 and public.valid_reel_links(reels));
