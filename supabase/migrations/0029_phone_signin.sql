-- Phone number sign-in: people who sign up with a text code have no email, so the admin list
-- shows their phone number (as +13055550123) in the email column instead. Same as 0019 otherwise.
create or replace function public.admin_users()
returns table (
  id uuid, email text, name text, role text, handle text, city text, avatar text,
  signed_up timestamptz, last_seen timestamptz, bookings bigint, requests bigint, messages bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return query
    select u.id, coalesce(nullif(u.email::text, ''), '+' || nullif(u.phone::text, '')), p.name, p.role, pr.handle, pr.city, p.avatar,
      u.created_at, u.last_sign_in_at,
      (select count(*) from bookings b where b.client_id = u.id or b.pro_id = u.id),
      (select count(*) from requests r where r.client_id = u.id),
      (select count(*) from messages m where m.sender_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    left join pros pr on pr.id = u.id
    order by u.created_at desc;
end;
$$;
