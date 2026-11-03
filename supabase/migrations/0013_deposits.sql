-- Deposits through Stripe. A photographer links a bank once (Stripe Express). After that, every new
-- booking with them carries a deposit the car owner pays by card. The deposit goes to the photographer
-- minus Rollshot's cut; the rest of the price is paid to the photographer directly, like now.
--
--   deposit = 25% of the price in whole dollars, at least $20 (never more than the price)
--   Rollshot's cut = 10% of the price, taken out of the deposit
--
-- Refunds: declined, withdrawn, cancelled by the photographer, or cancelled by the car owner 48+ hours
-- ahead -> full refund. Car owner cancels within 48 hours (a late cancel) -> the photographer keeps it.
-- Rain checks move the shoot and keep the deposit.
--
-- Photographers who haven't linked a bank keep working exactly as before (no deposit).
-- Safe to run more than once.

-- 1) Who can take deposits. The Stripe account id is only readable by the server.
create table if not exists public.payout_accounts (
  pro_id uuid primary key references public.pros (id) on delete cascade,
  stripe_account_id text not null unique,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists "payout status is public" on public.payout_accounts;
create policy "payout status is public" on public.payout_accounts for select using (true);
revoke all on public.payout_accounts from anon, authenticated;
grant select (pro_id, ready) on public.payout_accounts to anon, authenticated;
grant all on public.payout_accounts to service_role;

-- 2) The deposit on each booking. Only the database functions below change these.
alter table public.bookings
  add column if not exists deposit_cents integer not null default 0,
  add column if not exists fee_cents integer not null default 0,
  add column if not exists deposit_status text not null default 'none';
alter table public.bookings drop constraint if exists bookings_deposit_status_check;
alter table public.bookings add constraint bookings_deposit_status_check
  check (deposit_status in ('none', 'due', 'void', 'paid', 'refund_due', 'refunded', 'kept'));
-- none: no deposit · due: waiting for the car owner to pay · void: called off before it was paid
-- paid · refund_due: being refunded · refunded · kept: late cancel, the photographer keeps it

-- Stripe ids per booking, for the server only.
create table if not exists public.booking_payments (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  checkout_id text,
  payment_intent text,
  refund_id text,
  updated_at timestamptz not null default now()
);
alter table public.booking_payments enable row level security;
revoke all on public.booking_payments from anon, authenticated;
grant all on public.booking_payments to service_role;

-- 3) Every new booking (Book now, a chat offer, a chosen request offer) gets a deposit when the
--    photographer can take one.
create or replace function public.set_deposit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from payout_accounts where pro_id = new.pro_id and ready) then
    new.deposit_cents := least(new.price, greatest(20, round(new.price * 0.25)::integer)) * 100;
    new.fee_cents := round(new.price * 0.10)::integer * 100;
    new.deposit_status := 'due';
  else
    new.deposit_cents := 0;
    new.fee_cents := 0;
    new.deposit_status := 'none';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_set_deposit on public.bookings;
create trigger bookings_set_deposit before insert on public.bookings
  for each row execute function public.set_deposit();

-- 4) Accepting needs the deposit paid first. Declining refunds it.
create or replace function public.respond_booking(p_booking uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or b.pro_id <> auth.uid() then raise exception 'Booking not found'; end if;
  if b.status <> 'requested' then raise exception 'This request was already answered'; end if;
  if p_accept and b.deposit_status = 'due' then raise exception 'Waiting for their deposit. You can accept once it is paid.'; end if;
  update bookings set status = case when p_accept then 'confirmed' else 'declined' end,
    deposit_status = case
      when p_accept then deposit_status
      when deposit_status = 'paid' then 'refund_due'
      when deposit_status = 'due' then 'void'
      else deposit_status end
    where id = p_booking;
  if p_accept then -- a confirmed date is no longer open to other clients
    update pros set open_dates = array_remove(open_dates, b.shoot_date) where id = b.pro_id;
  end if;
  perform post_system_note(b.pro_id, b.client_id,
    case when p_accept
      then format('Booking confirmed for %s. Chat is fully open now.', to_char(b.shoot_date, 'Dy, Mon FMDD'))
      when b.deposit_status = 'paid' then 'Booking declined. The deposit is being refunded in full.'
      else 'Booking declined.' end);
end;
$$;

-- 5) Cancelling: same rules as before, plus what happens to the deposit.
create or replace function public.cancel_booking(p_booking uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  me uuid := auth.uid();
  late boolean;
  who text;
  dep text;
  money text := '';
begin
  select * into b from bookings where id = p_booking for update;
  if not found or (b.pro_id <> me and b.client_id <> me) then raise exception 'Booking not found'; end if;
  if b.status in ('declined', 'cancelled') then raise exception 'This booking is already off'; end if;
  if b.shoot_date < current_date then raise exception 'This shoot already happened'; end if;
  -- Within 48 hours of the shoot day (today or tomorrow), unless it was never accepted.
  -- A photographer calling off a booking whose deposit was never paid isn't a late cancel.
  late := b.status <> 'requested' and b.shoot_date <= current_date + 1
    and not (me = b.pro_id and b.deposit_status = 'due');
  dep := case
    when b.deposit_status = 'due' then 'void'
    when b.deposit_status = 'paid' and late and me = b.client_id then 'kept'
    when b.deposit_status = 'paid' then 'refund_due'
    else b.deposit_status end;
  update bookings set status = 'cancelled', cancelled_by = me, cancelled_at = now(), late_cancel = late,
    deposit_status = dep
    where id = p_booking;
  -- The photographer is free that day again.
  if b.status <> 'requested' then
    update pros set open_dates = array_append(array_remove(open_dates, b.shoot_date), b.shoot_date)
      where id = b.pro_id;
  end if;
  if dep = 'kept' then money := format(' The $%s deposit goes to the photographer.', b.deposit_cents / 100);
  elsif dep = 'refund_due' then money := format(' The $%s deposit is being refunded in full.', b.deposit_cents / 100);
  end if;
  select name into who from profiles where id = me;
  perform post_system_note(b.pro_id, b.client_id,
    format('%s cancelled the shoot on %s%s.%s%s', who, to_char(b.shoot_date, 'Dy, Mon FMDD'),
      case when late then ' (late cancel)' else '' end,
      case when coalesce(trim(p_reason), '') <> '' then ' Reason: ' || left(trim(p_reason), 200) else '' end,
      money));
end;
$$;

-- 6) Called by the server after Stripe confirms a payment or a refund. Not callable from the app.
create or replace function public.deposit_paid(p_booking uuid, p_checkout text, p_intent text)
returns text language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_booking for update;
  if not found then return 'missing'; end if;
  insert into booking_payments (booking_id, checkout_id, payment_intent) values (p_booking, p_checkout, p_intent)
    on conflict (booking_id) do update set checkout_id = excluded.checkout_id,
      payment_intent = excluded.payment_intent, updated_at = now();
  if b.deposit_status = 'due' then
    update bookings set deposit_status = 'paid' where id = p_booking;
    perform post_system_note(b.pro_id, b.client_id, format('Deposit of $%s paid.%s', b.deposit_cents / 100,
      case when b.status = 'requested' then ' The request is ready to accept.' else '' end));
    return 'paid';
  elsif b.deposit_status = 'void' then
    -- Paid after the booking was called off: give it back.
    update bookings set deposit_status = 'refund_due' where id = p_booking;
    return 'refund_due';
  end if;
  return b.deposit_status;
end;
$$;

create or replace function public.deposit_refunded(p_booking uuid, p_refund text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bookings set deposit_status = 'refunded' where id = p_booking and deposit_status = 'refund_due';
  update booking_payments set refund_id = p_refund, updated_at = now() where booking_id = p_booking;
end;
$$;

revoke execute on function public.set_deposit() from public, anon, authenticated;
revoke execute on function public.deposit_paid(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.deposit_refunded(uuid, text) from public, anon, authenticated;
grant execute on function public.deposit_paid(uuid, text, text) to service_role;
grant execute on function public.deposit_refunded(uuid, text) to service_role;
revoke execute on function public.respond_booking(uuid, boolean) from public, anon;
grant execute on function public.respond_booking(uuid, boolean) to authenticated;
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
