-- Lawdeck migration 16: the citation check looks across the whole library (Phase 3, step 3e fix).
-- The answer test showed the check removing real authorities, mostly the full name of the court
-- rules ("High Court of Lagos State (Civil Procedure) Rules, 2019"). The notes name the rules in
-- full only a few times, so the 5-8 passages behind one answer rarely contain the title, even
-- though the library does. Rule G-04 is "remove any authority not matched in the library": this
-- lets the check ask the whole library before removing a name.
-- 1. library_mentions: which of some case and statute names appear in approved library material.
-- 2. eval_answers.raw_answer: each test answer's wording before the check, so later changes to
--    the check can be tried on saved answers without asking Claude again (no cost).

-- ---------------------------------------------------------------------------
-- 1. library_mentions. Same material a student may search (migration 12): approved, and not out
-- of date after a later law change. Returns only the names that were found, never any text.
-- A statute name must appear as a phrase; a case needs both party names in one passage.
create function public.library_mentions(
  statutes text[],
  cases text[],
  course uuid default null
)
returns table (kind text, phrase text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  is_job boolean := current_setting('role', true) = 'service_role';
  is_staff boolean := public.is_reviewer();
begin
  if me is null and not is_job then
    raise exception 'Sign in to check sources.' using errcode = '42501';
  end if;
  if coalesce(cardinality(statutes), 0) + coalesce(cardinality(cases), 0) > 30 then
    raise exception 'Too many names to check at once.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(statutes, '{}') || coalesce(cases, '{}')) as n(name)
    where n.name is null or char_length(n.name) > 200
  ) then
    raise exception 'Each name must be 200 characters or fewer.' using errcode = '22023';
  end if;

  return query
  with allowed as (
    select i.id, i.title
    from public.kb_items i
    where (course is null or i.course_id = course)
      and i.review_status = 'approved'
      and (is_staff or is_job or not exists (
        select 1 from public.law_changes c
        where c.course_id = i.course_id
          and (i.law_current_as_of is null or c.effective_on > i.law_current_as_of)
      ))
  ),
  names as (
    select 'statute'::text as kind, s.name as phrase, phraseto_tsquery('english', s.name) as q
    from unnest(coalesce(statutes, '{}')) as s(name)
    union all
    select 'case'::text, c.name, plainto_tsquery('english', regexp_replace(c.name, '\mvs?\M', ' ', 'gi'))
    from unnest(coalesce(cases, '{}')) as c(name)
  )
  select n.kind, n.phrase
  from names n
  where numnode(n.q) > 0
    and (
      exists (select 1 from allowed a where to_tsvector('english', a.title) @@ n.q)
      or exists (
        select 1 from public.kb_passages p
        join allowed a on a.id = p.item_id
        where p.search_text @@ n.q
      )
    );
end;
$$;

revoke execute on function public.library_mentions(text[], text[], uuid) from public, anon;
grant execute on function public.library_mentions(text[], text[], uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The answer before the check. Reviewers read it like the rest of the row (migration 15);
-- nobody but the admin job writes it (reviewers may update only rating and review_note).
alter table public.eval_answers add column raw_answer text;
