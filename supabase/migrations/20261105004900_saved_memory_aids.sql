-- Lawdeck migration 49: memory aids a student saves (Remembrance Phase 2b; founder's brief:
-- "Allow students to save their preferred memory aids ... accessible from the relevant topic and
-- Study Diary"). Each student's own. A copy of the aid is kept, so a saved aid stays in the Study
-- Diary even after its lesson is updated.

create table public.saved_memory_aids (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  aid_id uuid references public.lesson_memory_aids (id) on delete set null,
  topic_id uuid not null references public.topics (id) on delete cascade,
  kind text not null check (kind in ('acronym', 'phrase', 'association', 'pattern')),
  title text not null check (char_length(title) between 2 and 200),
  device text not null check (char_length(device) between 1 and 300),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  explanation text check (char_length(explanation) <= 1500),
  created_at timestamptz not null default now(),
  unique (owner_id, aid_id)
);
alter table public.saved_memory_aids enable row level security;
create index saved_memory_aids_owner_idx on public.saved_memory_aids (owner_id, topic_id);

create policy "Students read their saved aids" on public.saved_memory_aids
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Students save aids" on public.saved_memory_aids
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Students remove saved aids" on public.saved_memory_aids
  for delete to authenticated using (owner_id = (select auth.uid()));

-- The copy comes from the aid itself, which the student must be able to read (an approved aid of
-- an approved lesson): runs with the student's rights, so row-level security decides. At most 500.
create function public.saved_memory_aids_copy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a record;
begin
  if (select count(*) from public.saved_memory_aids where owner_id = new.owner_id) >= 500 then
    raise exception 'You have saved 500 memory aids. Remove some to save more.' using errcode = '23514';
  end if;
  select m.kind, m.title, m.device, m.items, m.explanation, l.topic_id into a
    from public.lesson_memory_aids m
    join public.lesson_extras e on e.id = m.extras_id
    join public.topic_lessons l on l.id = e.lesson_id
   where m.id = new.aid_id;
  if not found then
    raise exception 'That memory aid could not be found.' using errcode = '23503';
  end if;
  new.kind := a.kind;
  new.title := a.title;
  new.device := a.device;
  new.items := a.items;
  new.explanation := a.explanation;
  new.topic_id := a.topic_id;
  return new;
end;
$$;
revoke execute on function public.saved_memory_aids_copy() from public, anon, authenticated;
create trigger saved_memory_aids_copy
  before insert on public.saved_memory_aids
  for each row execute function public.saved_memory_aids_copy();

revoke all on public.saved_memory_aids from anon, authenticated;
grant select, delete on public.saved_memory_aids to authenticated;
grant insert (aid_id) on public.saved_memory_aids to authenticated;
