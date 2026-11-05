-- The iPhone app saves its push address as "apns:<device token>" next to the browsers' https ones.
-- The notify() function already sends every saved address to /api/push, which hands app ones to Apple.
-- Safe to run more than once.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then raise exception 'Sign in first'; end if;
  if not (
    (p_endpoint ~ '^https://' and char_length(p_endpoint) <= 1000)
    or p_endpoint ~ '^apns:[0-9a-f]{32,200}$'
  ) then raise exception 'Not a push address'; end if;
  -- A shared phone moves to whoever turned alerts on last.
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
