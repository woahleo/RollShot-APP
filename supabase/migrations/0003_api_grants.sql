-- Supabase projects created after May 30, 2026 (and all projects after October 30, 2026)
-- no longer expose new tables to the app automatically. Without these grants every
-- request from the app fails with "permission denied". Row level security still decides
-- which rows each person can see or change.

grant usage on schema public to anon, authenticated;

-- Public browsing (signed out or in)
grant select on public.profiles, public.pros, public.packages to anon, authenticated;

-- Signed-in people; the policies in 0001 limit them to their own rows
grant insert, update on public.profiles, public.pros to authenticated;
grant select, insert, update, delete on public.cars, public.packages, public.pro_contacts to authenticated;
grant select on public.bookings, public.threads to authenticated;
grant select, insert on public.messages to authenticated;

grant all on all tables in schema public to service_role;

-- Helpers used inside the security policies
grant execute on function public.has_confirmed_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.has_open_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.is_thread_member(uuid) to anon, authenticated;

-- The booking and chat actions
grant execute on function public.request_booking(uuid, date, text) to authenticated;
grant execute on function public.respond_booking(uuid, boolean) to authenticated;
grant execute on function public.rain_check(uuid, date) to authenticated;
grant execute on function public.open_thread(uuid) to authenticated;
