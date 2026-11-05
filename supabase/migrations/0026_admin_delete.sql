-- Lets an admin delete someone's account from the admin page.

-- Admins can remove anyone's photos, so a deleted account doesn't leave its files behind.
drop policy if exists "admins delete any portfolio photos" on storage.objects;
create policy "admins delete any portfolio photos" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.is_admin());

-- Deletes the account and everything attached to it, the same way delete_my_account does, and
-- returns the photo paths it held so the admin page can remove the files from Storage.
-- Admin accounts can't be deleted here, including your own.
create or replace function public.admin_delete_user(p_user uuid)
returns text[] language plpgsql security definer set search_path = public, auth as $$
declare files text[];
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if exists (select 1 from admins where user_id = p_user) then
    raise exception 'Admin accounts can''t be deleted here';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'That account is already gone';
  end if;
  select coalesce(array_agg(distinct f), '{}') into files from (
    select avatar as f from profiles where id = p_user
    union all select unnest(photos) from pros where id = p_user
    union all select unnest(photos) from cars where owner_id = p_user
    union all select unnest(photos) from shoot_posts where pro_id = p_user
  ) x where f is not null and f <> '';
  delete from auth.users where id = p_user; -- cascades to profiles, pros, cars, bookings, chats
  return files;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
