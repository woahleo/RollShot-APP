-- Cancelling a shoot. Free for now (no payments yet): either side can cancel any upcoming booking.
-- Cancelling less than 48 hours before the shoot day counts as a late cancel, and each person's
-- late-cancel count is public so the other side can see it before booking.
-- Rain is never a cancel: rain check moves the shoot instead.

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('requested', 'confirmed', 'declined', 'rescheduled', 'cancelled'));
alter table public.bookings
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists late_cancel boolean not null default false;

-- A cancelled booking no longer counts as an open one (same as declined).
create or replace function public.has_open_booking(p_pro uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where pro_id = p_pro and client_id = p_client and status not in ('declined', 'cancelled')
  );
$$;

create or replace function public.cancel_booking(p_booking uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  me uuid := auth.uid();
  late boolean;
  who text;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or (b.pro_id <> me and b.client_id <> me) then raise exception 'Booking not found'; end if;
  if b.status in ('declined', 'cancelled') then raise exception 'This booking is already off'; end if;
  if b.shoot_date < current_date then raise exception 'This shoot already happened'; end if;
  -- Within 48 hours of the shoot day (today or tomorrow), unless it was never accepted.
  late := b.status <> 'requested' and b.shoot_date <= current_date + 1;
  update bookings set status = 'cancelled', cancelled_by = me, cancelled_at = now(), late_cancel = late
    where id = p_booking;
  -- The photographer is free that day again.
  if b.status <> 'requested' then
    update pros set open_dates = array_append(array_remove(open_dates, b.shoot_date), b.shoot_date)
      where id = b.pro_id;
  end if;
  select name into who from profiles where id = me;
  perform post_system_note(b.pro_id, b.client_id,
    format('%s cancelled the shoot on %s%s.%s', who, to_char(b.shoot_date, 'Dy, Mon FMDD'),
      case when late then ' (late cancel)' else '' end,
      case when coalesce(trim(p_reason), '') <> '' then ' Reason: ' || left(trim(p_reason), 200) else '' end));
end;
$$;

-- How many late cancels someone has made. Public, so clients and photographers can check each other.
create or replace function public.late_cancels(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from bookings where cancelled_by = p_user and late_cancel;
$$;

-- Same, for a list of people at once (board cards, offer lists, booking lists). Only people with any are returned.
create or replace function public.late_cancel_counts(p_users uuid[])
returns table (user_id uuid, n integer) language sql stable security definer set search_path = public as $$
  select cancelled_by, count(*)::integer from bookings
  where late_cancel and cancelled_by = any (p_users) group by cancelled_by;
$$;

revoke execute on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.late_cancels(uuid) to anon, authenticated;
grant execute on function public.late_cancel_counts(uuid[]) to anon, authenticated;
