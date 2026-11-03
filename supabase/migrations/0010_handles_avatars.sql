-- Readable links for photographers (/p/vic-films instead of a long id) and profile pictures.
-- Safe to run more than once. It only adds columns; existing photographers get a link made from their name.

-- 1) Profile pictures: a path in the "portfolio" bucket, inside the person's own folder.
alter table public.profiles add column if not exists avatar text;
alter table public.profiles drop constraint if exists profiles_avatar_own_folder;
alter table public.profiles add constraint profiles_avatar_own_folder
  check (avatar is null or avatar like id::text || '/%');
grant update (name, avatar) on public.profiles to authenticated;

-- 2) Usernames for photographers: 3 to 30 lowercase letters, numbers or dashes.
alter table public.pros add column if not exists handle text;
alter table public.pros drop constraint if exists pros_handle_format;
alter table public.pros add constraint pros_handle_format
  check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
create unique index if not exists pros_handle_key on public.pros (handle);

-- Turns a name into a free username: "Vic Films" -> "vic-films", then "vic-films-2" if taken.
create or replace function public.make_handle(p_name text, p_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  base text := left(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), 24);
  candidate text;
  n int := 1;
begin
  base := trim(both '-' from base);
  if length(base) < 3 then base := 'shooter'; end if;
  candidate := base;
  while exists (select 1 from pros where handle = candidate and id <> p_id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;
revoke execute on function public.make_handle(text, uuid) from public, anon, authenticated;

-- New photographers get one automatically; they can change it on their profile page.
create or replace function public.pros_default_handle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null or new.handle = '' then
    new.handle := make_handle((select name from profiles where id = new.id), new.id);
  else
    new.handle := lower(new.handle);
  end if;
  return new;
end $$;
drop trigger if exists pros_default_handle on public.pros;
create trigger pros_default_handle before insert or update of handle on public.pros
  for each row execute function public.pros_default_handle();

-- Give everyone already on Rollshot a username, one at a time so two people with the same name both get one.
do $$
declare r record;
begin
  for r in select p.id, pr.name from pros p join profiles pr on pr.id = p.id where p.handle is null order by p.created_at nulls last loop
    update pros set handle = make_handle(r.name, r.id) where id = r.id;
  end loop;
end $$;
