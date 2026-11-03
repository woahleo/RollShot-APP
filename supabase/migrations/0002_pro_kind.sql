-- Whether a shooter does photos, video, or both.
alter table public.pros
  add column if not exists kind text not null default 'photo' check (kind in ('photo', 'video', 'both'));
