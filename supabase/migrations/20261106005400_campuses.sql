-- Lawdeck migration 54: Law School campuses (campus chat, Phase 1; PRD v2.1 CH-01; founder approved
-- 2026-11-06). Each student chooses their campus, or "Law School aspirant" if not yet at Law School.
-- The list is reference data like courses: signed-in people read it; nobody changes it from the app
-- (a later migration adds or renames a campus). Phase 2 makes one chat group per campus from it.
-- Draft list awaiting the founder's confirmation.

create table public.campuses (
  key text primary key check (key ~ '^[a-z][a-z-]{1,39}$'),
  name text not null check (char_length(name) between 2 and 60),
  kind text not null default 'campus' check (kind in ('campus', 'aspirant')),
  position integer not null unique
);
alter table public.campuses enable row level security;
revoke all on public.campuses from anon, authenticated;
grant select on public.campuses to authenticated;
create policy "Signed-in users can read campuses" on public.campuses
  for select to authenticated using (true);

insert into public.campuses (key, name, kind, position) values
  ('abuja', 'Abuja', 'campus', 1),
  ('lagos', 'Lagos', 'campus', 2),
  ('kano', 'Kano', 'campus', 3),
  ('enugu', 'Enugu', 'campus', 4),
  ('yenagoa', 'Yenagoa', 'campus', 5),
  ('yola', 'Yola', 'campus', 6),
  ('port-harcourt', 'Port Harcourt', 'campus', 7),
  ('aspirant', 'Law School aspirant', 'aspirant', 100);

-- profiles.campus (free text since migration 1, never set by the app) now holds a campus key.
update public.profiles set campus = null where campus is not null and campus not in (select key from public.campuses);
alter table public.profiles
  add constraint profiles_campus_fkey foreign key (campus) references public.campuses (key) on update cascade;
