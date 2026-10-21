-- Lawdeck migration 8: reviewing the library (step 2e).
-- 1. Approval needs a fully read and indexed item and a "law current as of" date (rule KB-02).
-- 2. A corrected passage loses its old search vector until it is indexed again.
-- 3. Every review decision, correction, addition and removal is recorded in audit_log by the
--    database itself: who, what and when, never document text (rule I-03).

-- ---------------------------------------------------------------------------
-- Reviewers may change only review details. Changes made by Lawdeck's own triggers (for
-- example, marking an item as needing indexing after a correction) are allowed.
create or replace function public.kb_items_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() and pg_trigger_depth() = 1 then
    if (new.title, new.type, new.course_id, new.topic_ids, new.campus, new.year, new.source,
        new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.created_by,
        new.reading_status, new.reading_method, new.reading_quality, new.page_count, new.read_at,
        new.reading_error, new.indexed_passages, new.index_model, new.indexed_at)
       is distinct from
       (old.title, old.type, old.course_id, old.topic_ids, old.campus, old.year, old.source,
        old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.created_by,
        old.reading_status, old.reading_method, old.reading_quality, old.page_count, old.read_at,
        old.reading_error, old.indexed_passages, old.index_model, old.indexed_at) then
      raise exception 'Reviewers can only change review details.' using errcode = '42501';
    end if;
  end if;
  if new.review_status is distinct from old.review_status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approval rules, checked whenever an item becomes approved.
create function public.kb_items_approval_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.review_status = 'approved' and old.review_status is distinct from 'approved' then
    if new.reading_status is distinct from 'done' then
      raise exception 'Read the file before approving it.' using errcode = '23514';
    end if;
    if new.indexed_at is null then
      raise exception 'Index the item for search before approving it.' using errcode = '23514';
    end if;
    if new.law_current_as_of is null then
      raise exception 'Enter the date the material is current to before approving it.' using errcode = '23514';
    end if;
    if new.law_current_as_of > current_date then
      raise exception 'The "current as of" date cannot be in the future.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger kb_items_approval_check
  before update of review_status on public.kb_items
  for each row execute function public.kb_items_approval_check();

-- ---------------------------------------------------------------------------
-- A corrected passage must be searched by its new wording: clear its vector and mark the
-- item as not fully indexed. Lawdeck re-indexes the passage straight after saving.
create function public.kb_passages_corrected()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.heading, new.text) is distinct from (old.heading, old.text) then
    new.embedding := null;
    new.embedding_model := null;
    update public.kb_items
       set indexed_at = null,
           indexed_passages = greatest(indexed_passages - case when old.embedding_model is null then 0 else 1 end, 0)
     where id = new.item_id;
  end if;
  return new;
end;
$$;

create trigger kb_passages_corrected
  before update of heading, text on public.kb_passages
  for each row execute function public.kb_passages_corrected();

-- ---------------------------------------------------------------------------
-- The audit record. Runs with owner rights, because nobody may write audit_log directly.
create function public.audit_library()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'kb_items' then
    if tg_op = 'INSERT' then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values ((select auth.uid()), 'library.item_added', 'kb_item', new.id,
              jsonb_build_object('course_id', new.course_id, 'type', new.type));
    elsif tg_op = 'DELETE' then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values ((select auth.uid()), 'library.item_removed', 'kb_item', old.id,
              jsonb_build_object('course_id', old.course_id, 'review_status', old.review_status));
      return old;
    elsif new.review_status is distinct from old.review_status
       or new.law_current_as_of is distinct from old.law_current_as_of
       or new.review_note is distinct from old.review_note then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values ((select auth.uid()), 'library.reviewed', 'kb_item', new.id,
              jsonb_build_object('from', old.review_status, 'to', new.review_status,
                                 'law_current_as_of', new.law_current_as_of,
                                 'note_changed', new.review_note is distinct from old.review_note));
    end if;
  elsif tg_table_name = 'kb_passages'
    and (new.heading, new.text) is distinct from (old.heading, old.text) then
    insert into public.audit_log (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'library.passage_corrected', 'kb_passage', new.id,
            jsonb_build_object('item_id', new.item_id, 'position', new.position));
  end if;
  return new;
end;
$$;

revoke execute on function public.audit_library() from public, anon, authenticated;

create trigger kb_items_audit
  after insert or update or delete on public.kb_items
  for each row execute function public.audit_library();

create trigger kb_passages_audit
  after update of heading, text on public.kb_passages
  for each row execute function public.audit_library();
