-- Lawdeck migration 72: the Admin → Library list loads quickly again (founder, 2026-11-24: "The
-- library list could not load (database code 57014)", the database stopping a query that ran too
-- long).
-- 1. The list counted every passage and page of up to 500 items through row-level security, which
--    asked "is this person a reviewer?" once per passage and per page. One function now counts
--    them for the listed items in one go, checking the reviewer role once.
-- 2. The read rules on library items, passages and pages ask that question once per query
--    ("(select public.is_reviewer())"), as Supabase recommends. Who may read what is unchanged.
-- Needs migrations 1–71.

-- 1. Passage and page counts for library items (reviewers and admins only) ------------------
create function public.library_item_counts(items uuid[])
returns table (item_id uuid, passages integer, pages integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_reviewer() then
    raise exception 'Only reviewers and admins can see library counts.' using errcode = '42501';
  end if;
  if items is null or cardinality(items) > 500 then
    raise exception 'Ask for at most 500 items at a time.' using errcode = '22023';
  end if;
  return query
  select i.id,
    (select count(*)::integer from public.kb_passages p where p.item_id = i.id),
    (select count(*)::integer from public.kb_item_pages g where g.item_id = i.id)
    from unnest(items) as i (id);
end;
$$;
revoke execute on function public.library_item_counts(uuid[]) from public, anon;
grant execute on function public.library_item_counts(uuid[]) to authenticated;

-- 2. The same read rules, with the reviewer check made once per query ------------------------
drop policy "Students see approved official items; reviewers see all" on public.kb_items;
create policy "Students see approved official items; reviewers see all" on public.kb_items
  for select to authenticated
  using ((select public.is_reviewer()) or (review_status = 'approved' and source_kind in ('official', 'publication')));

drop policy "Reviewers read passages" on public.kb_passages;
create policy "Reviewers read passages" on public.kb_passages
  for select to authenticated using ((select public.is_reviewer()));

drop policy "Reviewers read page text" on public.kb_item_pages;
create policy "Reviewers read page text" on public.kb_item_pages
  for select to authenticated using ((select public.is_reviewer()));
