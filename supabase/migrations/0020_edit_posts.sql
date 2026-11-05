-- Edit a posted crew job or a car owner's request, and tell anyone who already replied.
-- Run after 0019_admin_notifications.sql. Safe to run more than once.

-- The poster changes an open crew job. Anyone who replied (or the creator a direct offer went to)
-- hears about it, so nobody shows up on the old day or for the old pay.
create or replace function public.edit_gig(p_gig uuid, p_role text, p_city text, p_date date, p_time time, p_pay integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  g gigs%rowtype;
  me uuid := auth.uid();
  r record;
  who text;
begin
  select * into g from gigs where id = p_gig for update;
  if not found or g.poster_id <> me then raise exception 'Job not found'; end if;
  if g.status <> 'open' then raise exception 'This job is already filled or closed, so it can''t be changed'; end if;
  if p_date is null or p_date < current_date then raise exception 'Pick a future date'; end if;
  update gigs set role = p_role, city = trim(p_city), shoot_date = p_date, shoot_time = p_time, pay = p_pay,
      note = nullif(left(trim(coalesce(p_note, '')), 500), '')
    where id = p_gig
    returning * into g;
  select name into who from profiles where id = me;
  if g.target_id is not null then
    perform crew_note(g.target_id, me, format('%s changed their offer: %s.', who, gig_line(g)));
    perform notify(g.target_id, 'crew', format('%s changed their offer', first_name(me)), gig_line(g), '/crew');
  else
    for r in select pro_id from gig_replies where gig_id = p_gig loop
      perform notify(r.pro_id, 'crew', format('%s changed a job you replied to', first_name(me)), gig_line(g), '/crew');
    end loop;
  end if;
end;
$$;
revoke execute on function public.edit_gig(uuid, text, text, date, time, integer, text) from public, anon;
grant execute on function public.edit_gig(uuid, text, text, date, time, integer, text) to authenticated;

-- Car owners edit their own open request (the table policy already allows it). Requests that are
-- booked can't change, and dates must stay in the future.
create or replace function public.check_request_edit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'open' and (new.car, new.shoot_type, new.kind, new.city, new.date_from, new.date_to, new.budget, new.note)
      is distinct from (old.car, old.shoot_type, old.kind, old.city, old.date_from, old.date_to, old.budget, old.note) then
    raise exception 'This request is closed, so it can''t be changed';
  end if;
  if new.date_from is distinct from old.date_from and new.date_from < current_date then
    raise exception 'Pick a date from today on';
  end if;
  if old.status = 'closed' and new.status = 'open' then raise exception 'Post a new request instead'; end if;
  return new;
end;
$$;
drop trigger if exists requests_check_edit on public.requests;
create trigger requests_check_edit before update on public.requests
  for each row execute function public.check_request_edit();

-- Tell the creators who sent an offer when the request changes or is taken down.
create or replace function public.notify_request_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  title text;
  line text := format('%s · %s · %s', new.car, new.shoot_type, short_date(new.date_from));
begin
  if new.status = 'closed' and old.status = 'open' and new.chosen_pro is null then
    title := 'A request you offered on was taken down';
  elsif new.status = 'open' and (new.car, new.shoot_type, new.kind, new.city, new.date_from, new.date_to, new.budget, new.note)
      is distinct from (old.car, old.shoot_type, old.kind, old.city, old.date_from, old.date_to, old.budget, old.note) then
    title := case when new.date_from <> old.date_from then format('Request moved to %s', short_date(new.date_from))
                  else 'A request you offered on changed' end;
    if new.budget is distinct from old.budget and new.budget is not null then line := line || format(' · up to $%s', new.budget); end if;
  else
    return new;
  end if;
  for r in select pro_id from request_replies where request_id = new.id loop
    perform notify(r.pro_id, 'request', title, line, '/requests');
  end loop;
  return new;
end;
$$;
drop trigger if exists requests_notify_change on public.requests;
create trigger requests_notify_change after update on public.requests
  for each row execute function public.notify_request_change();
revoke execute on function public.notify_request_change(), public.check_request_edit() from public, anon, authenticated;

notify pgrst, 'reload schema';
