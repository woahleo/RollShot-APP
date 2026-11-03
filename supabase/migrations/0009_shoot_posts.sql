-- Finished shoots: after the shoot day, the photographer posts the photos (and a link to the reel).
-- Every post comes from a real booking, so a post always carries a price, a package and a Book button.
-- Posts show the car and the photographer, never the owner's name. Each car gets a public page of its shoots.

create table if not exists public.shoot_posts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  pro_id uuid not null references public.pros (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  car_id uuid references public.cars (id) on delete set null,
  car text not null,
  city text not null,
  shoot_type text not null,
  price integer not null,
  shoot_date date not null,
  caption text check (caption is null or char_length(caption) <= 300),
  photos text[] not null default '{}',   -- storage paths in the "portfolio" bucket
  video_url text,                        -- a link to the reel on Instagram, TikTok or YouTube
  hidden_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shoot_posts_pro_idx on public.shoot_posts (pro_id, created_at desc);
create index if not exists shoot_posts_car_idx on public.shoot_posts (car_id, shoot_date desc);

-- Car owners choose whether their car has a public page. The page shows the car, not the owner.
alter table public.cars add column if not exists public boolean not null default true;

alter table public.shoot_posts enable row level security;
drop policy if exists "shoot posts are public" on public.shoot_posts;
create policy "shoot posts are public" on public.shoot_posts for select using (true);
-- Everything else goes through the functions below.

-- A car's page is visible when the owner leaves it on. Owners still see all their own cars.
drop policy if exists "own cars" on public.cars;
create policy "own cars" on public.cars for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "public cars" on public.cars;
create policy "public cars" on public.cars for select using (public);

-- The photographer posts a shoot once the day has passed.
create or replace function public.post_shoot(p_booking uuid, p_photos text[], p_video_url text, p_caption text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  me uuid := auth.uid();
  cid uuid;
  pid uuid;
  host text;
begin
  select * into b from bookings where id = p_booking;
  if not found or b.pro_id <> me then raise exception 'Shoot not found'; end if;
  if b.status not in ('confirmed', 'rescheduled') then raise exception 'Only a confirmed shoot can be posted'; end if;
  if b.shoot_date > current_date then raise exception 'You can post this after the shoot day'; end if;
  if coalesce(array_length(p_photos, 1), 0) = 0 and coalesce(trim(p_video_url), '') = '' then
    raise exception 'Add at least one photo, or a link to the video';
  end if;
  if coalesce(array_length(p_photos, 1), 0) > 12 then raise exception 'Up to 12 photos'; end if;
  -- Photos must be this photographer's own uploads.
  if exists (select 1 from unnest(p_photos) ph where split_part(ph, '/', 1) <> me::text) then
    raise exception 'Those photos are not yours';
  end if;
  if coalesce(trim(p_video_url), '') <> '' then
    host := lower(split_part(split_part(regexp_replace(trim(p_video_url), '^https?://', ''), '/', 1), ':', 1));
    host := regexp_replace(host, '^www\.', '');
    if host not in ('instagram.com', 'tiktok.com', 'vm.tiktok.com', 'youtube.com', 'youtu.be', 'vimeo.com') then
      raise exception 'Video links can be Instagram, TikTok, YouTube or Vimeo';
    end if;
  end if;
  if coalesce(p_caption, '') ~* '(\d[\s.()-]*){10}|@[a-z0-9_.]{2,}|instagram|whatsapp|cash ?app|venmo|zelle|paypal' then
    raise exception 'Keep contact details out of the caption';
  end if;
  -- Tie it to the owner's car when the booking's car matches one in their garage.
  select id into cid from cars
    where owner_id = b.client_id
      and lower(concat_ws(' ', nullif(trim(year), ''), nullif(trim(color), ''), nullif(trim(make), ''), nullif(trim(model), ''))) = lower(trim(coalesce(b.car, '')))
    limit 1;
  insert into shoot_posts (booking_id, pro_id, owner_id, car_id, car, city, shoot_type, price, shoot_date, caption, photos, video_url)
    select p_booking, me, b.client_id, cid, coalesce(nullif(trim(b.car), ''), 'A car'), p.city, b.package_name, b.price, b.shoot_date,
      nullif(trim(p_caption), ''), coalesce(p_photos, '{}'), nullif(trim(p_video_url), '')
    from pros p where p.id = me
  on conflict (booking_id) do update set
    car_id = excluded.car_id, caption = excluded.caption, photos = excluded.photos,
    video_url = excluded.video_url, created_at = now()
  returning id into pid;
  return pid;
end;
$$;

-- The photographer takes their own post down.
create or replace function public.delete_shoot_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from shoot_posts where id = p_post and pro_id = auth.uid();
  if not found then raise exception 'Post not found'; end if;
end;
$$;

-- The car owner hides a post of their car (it leaves the car page and the photographer's page).
create or replace function public.hide_shoot_post(p_post uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shoot_posts set hidden_by_owner = coalesce(p_hidden, true)
    where id = p_post and owner_id = auth.uid();
  if not found then raise exception 'Post not found'; end if;
end;
$$;

revoke execute on function public.post_shoot(uuid, text[], text, text) from public, anon;
revoke execute on function public.delete_shoot_post(uuid) from public, anon;
revoke execute on function public.hide_shoot_post(uuid, boolean) from public, anon;
grant execute on function public.post_shoot(uuid, text[], text, text) to authenticated;
grant execute on function public.delete_shoot_post(uuid) to authenticated;
grant execute on function public.hide_shoot_post(uuid, boolean) to authenticated;

grant select on public.shoot_posts to anon, authenticated;
grant all on public.shoot_posts to service_role;
