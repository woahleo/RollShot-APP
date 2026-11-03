-- Settings: switch account type and delete account.

-- Switches the signed-in account between car owner and photographer/videographer.
-- Becoming a car owner removes the photographer profile, its packages, contact details
-- and the bookings and chats people made with it. Becoming a photographer starts an
-- empty profile to fill in.
create or replace function public.switch_role(p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_role not in ('client', 'pro') then raise exception 'Unknown account type'; end if;
  if not exists (select 1 from profiles where id = me) then raise exception 'Finish setting up your account first'; end if;
  if p_role = 'client' then
    delete from pros where id = me;
  else
    -- Their own requests as a car owner are cancelled; a photographer can't book.
    delete from bookings where client_id = me;
    insert into pros (id, city) values (me, 'West Palm Beach') on conflict (id) do nothing;
  end if;
  update profiles set role = p_role where id = me;
end;
$$;

-- Deletes the signed-in person's account and everything attached to it.
-- Portfolio photos are removed by the app through Storage before this runs.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  delete from auth.users where id = me; -- cascades to profiles, pros, cars, bookings, chats
end;
$$;

revoke execute on function public.switch_role(text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.switch_role(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- People can rename themselves, but the account type only changes through switch_role above.
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;
