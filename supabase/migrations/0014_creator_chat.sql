-- Creators message each other freely: no 3-message limit and no lock on phone numbers or handles.
-- Chats with car owners keep the same rules as before (they unlock once a shoot is confirmed).
-- Needs 0013_crew_jobs.sql first. Safe to run more than once.

-- "Unlocked" now also means: both people are creators.
create or replace function public.has_confirmed_booking(p_pro uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where pro_id = p_pro and client_id = p_client and status in ('confirmed', 'rescheduled')
  ) or exists (
    select 1 from gigs
    where status = 'filled'
      and ((poster_id = p_client and hired_id = p_pro) or (poster_id = p_pro and hired_id = p_client))
  ) or (
    exists (select 1 from pros where id = p_pro) and exists (select 1 from pros where id = p_client)
  );
$$;

-- Message button: a creator messaging another creator reuses any chat they already have, either way round.
create or replace function public.open_thread(p_pro uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_pro = auth.uid() then raise exception 'You cannot message yourself'; end if;
  if not exists (select 1 from pros where id = p_pro) then raise exception 'Creator not found'; end if;
  if exists (select 1 from pros where id = auth.uid()) then
    return crew_thread(p_pro, auth.uid());
  end if;
  insert into threads (pro_id, client_id) values (p_pro, auth.uid())
    on conflict (pro_id, client_id) do update set updated_at = threads.updated_at
    returning id into tid;
  return tid;
end;
$$;
revoke execute on function public.open_thread(uuid) from public, anon;
grant execute on function public.open_thread(uuid) to authenticated;
