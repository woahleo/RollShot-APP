-- Age gate: every new account confirms a birth date before its profile can be created.
-- Rollshot is for people 13 and older, as COPPA requires for an app that collects personal
-- details without parental consent. The birth date itself is never stored, only the fact
-- that the check passed and when. Someone under the minimum has their sign-in deleted on the
-- spot, so no email address is kept for them. Existing accounts are not affected.

create table if not exists private.age_checks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  confirmed_at timestamptz not null default now()
);
revoke all on private.age_checks from public, anon, authenticated;

/**
 * Check the signed-in person's birth date. Returns true and records the pass if they are old
 * enough. Returns false and deletes their sign-in (and with it their email) if they are not.
 */
create or replace function public.confirm_age(p_birth date)
returns boolean language plpgsql security definer set search_path = public, private, auth as $$
declare
  me uuid := auth.uid();
  min_age constant int := 13;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01' then
    raise exception 'Enter your real date of birth';
  end if;
  if p_birth > (current_date - make_interval(years => min_age))::date then
    if not exists (select 1 from public.profiles where id = me) then
      delete from auth.users where id = me;
    end if;
    return false;
  end if;
  insert into private.age_checks (user_id) values (me)
    on conflict (user_id) do update set confirmed_at = now();
  return true;
end;
$$;
revoke execute on function public.confirm_age(date) from public, anon;
grant execute on function public.confirm_age(date) to authenticated;

-- A profile made from the app needs a passed age check first. Inserts made directly in the
-- database (the Supabase dashboard, seed scripts) have no signed-in user and are let through.
create or replace function public.check_profile_age()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is not null and not exists (select 1 from private.age_checks where user_id = new.id) then
    raise exception 'Confirm your date of birth first' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_profile_age() from public, anon, authenticated;

drop trigger if exists profiles_age_check on public.profiles;
create trigger profiles_age_check before insert on public.profiles
  for each row execute function public.check_profile_age();
