-- Connect Instagram: a creator logs in with their Instagram (Business or Creator) account, then picks
-- posts to show on Rollshot. The login token is stored here and only the server code uses it.
-- Needs 0016_reels.sql first. Safe to run more than once.

create table if not exists public.instagram_links (
  pro_id uuid primary key references public.pros (id) on delete cascade,
  ig_user_id text not null,
  username text,
  token text not null,
  token_expires timestamptz,
  token_refreshed timestamptz not null default now(),
  connected_at timestamptz not null default now()
);
alter table public.instagram_links enable row level security;
drop policy if exists "creators see their own instagram link" on public.instagram_links;
create policy "creators see their own instagram link" on public.instagram_links for select using (pro_id = auth.uid());
-- The token column is left out on purpose: the page can see who is connected, never the token.
revoke all on public.instagram_links from anon, authenticated;
grant select (pro_id, username, connected_at) on public.instagram_links to authenticated;
grant all on public.instagram_links to service_role;

-- Called by the server after Instagram sends the creator back.
create or replace function public.save_instagram_link(p_ig_user text, p_username text, p_token text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pros where id = auth.uid()) then raise exception 'Only creators can connect Instagram'; end if;
  insert into instagram_links (pro_id, ig_user_id, username, token, token_expires, token_refreshed, connected_at)
    values (auth.uid(), p_ig_user, p_username, p_token, p_expires, now(), now())
  on conflict (pro_id) do update set ig_user_id = excluded.ig_user_id, username = excluded.username, token = excluded.token,
    token_expires = excluded.token_expires, token_refreshed = now(), connected_at = now();
end;
$$;

-- The server reads the token to list or import the creator's own posts.
create or replace function public.my_instagram_token()
returns table (token text, token_expires timestamptz, token_refreshed timestamptz)
language sql stable security definer set search_path = public as $$
  select token, token_expires, token_refreshed from instagram_links where pro_id = auth.uid();
$$;

create or replace function public.refresh_instagram_token(p_token text, p_expires timestamptz)
returns void language sql security definer set search_path = public as $$
  update instagram_links set token = p_token, token_expires = p_expires, token_refreshed = now() where pro_id = auth.uid();
$$;

create or replace function public.forget_instagram()
returns void language sql security definer set search_path = public as $$
  delete from instagram_links where pro_id = auth.uid();
$$;

revoke execute on function public.save_instagram_link(text, text, text, timestamptz) from public, anon;
revoke execute on function public.my_instagram_token() from public, anon;
revoke execute on function public.refresh_instagram_token(text, timestamptz) from public, anon;
revoke execute on function public.forget_instagram() from public, anon;
grant execute on function public.save_instagram_link(text, text, text, timestamptz) to authenticated;
grant execute on function public.my_instagram_token() to authenticated;
grant execute on function public.refresh_instagram_token(text, timestamptz) to authenticated;
grant execute on function public.forget_instagram() to authenticated;
