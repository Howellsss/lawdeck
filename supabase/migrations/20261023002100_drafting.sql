-- Lawdeck migration 21: drafting (Phase 5, step 5a). System Design §3 (forums, templates,
-- documents, document_versions) and §7; PRD DR-01 to DR-07; Engineering Rules H-03 and H-05.
-- 1. forums: courts and registries with their formatting profile (paper, font, spacing,
--    margins, numbering). Reviewers confirm and date each one.
-- 2. templates: approved document structures (parts in order, fixed wording, fields), one per
--    document type, with the rule they follow. template_forums says which courts or registries
--    a template is for.
-- 3. documents and document_versions: a student's own drafts. Every change is a new version;
--    versions are never edited.
-- Students only ever see approved forums and templates (rule H-05). Staff never see students'
-- documents. The template and forum files themselves come in step 5b; this migration adds no
-- legal content.

create type public.forum_kind as enum ('court', 'registry');
create type public.version_author as enum ('student', 'ai');

-- ---------------------------------------------------------------------------
-- 1. Forums (courts and registries).
create table public.forums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 2 and 200),
  kind public.forum_kind not null,
  -- The state for a state court or registry (e.g. Lagos); empty for federal ones.
  state text check (char_length(state) between 2 and 60),
  -- Formatting profile, checked by the app's schema before approval (rule H-03).
  profile jsonb not null default '{}' check (jsonb_typeof(profile) = 'object'),
  status public.review_status not null default 'pending',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A forum can only be approved with a profile.
  constraint forums_complete_when_approved check (status <> 'approved' or profile <> '{}')
);
alter table public.forums enable row level security;
create trigger forums_set_updated_at
  before update on public.forums
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Templates and the forums each is for.
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  -- The document type, e.g. writ-of-summons. One template per type.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 2 and 200),
  course_id uuid not null references public.courses (id) on delete cascade,
  -- Parts in order, fixed wording, fields and which parts the AI fills; checked by the app's
  -- schema before approval (rule H-03).
  spec jsonb not null default '{}' check (jsonb_typeof(spec) = 'object'),
  -- The rule, form or statute the template follows (PRD 7.2).
  rule_source text check (char_length(rule_source) between 2 and 500),
  -- Goes up by one each time the structure changes, so a student's document records which
  -- version it was made from.
  version integer not null default 1 check (version >= 1),
  status public.review_status not null default 'pending',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_complete_when_approved
    check (status <> 'approved' or (spec <> '{}' and rule_source is not null))
);
alter table public.templates enable row level security;
create index templates_course_idx on public.templates (course_id);
create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

create table public.template_forums (
  template_id uuid not null references public.templates (id) on delete cascade,
  forum_id uuid not null references public.forums (id) on delete cascade,
  primary key (template_id, forum_id)
);
alter table public.template_forums enable row level security;
create index template_forums_forum_idx on public.template_forums (forum_id);

-- The database records who approved or withdrew a forum or template and when (never trusted
-- from the browser). Changing an approved one puts it back to "pending", so nothing unchecked
-- reaches students; a template's version goes up whenever its structure changes.
create function public.forums_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif old.status = 'approved'
    and (new.profile is distinct from old.profile
         or new.name is distinct from old.name
         or new.kind is distinct from old.kind
         or new.state is distinct from old.state) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger forums_reviewed
  before update on public.forums
  for each row execute function public.forums_reviewed();

create function public.templates_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.spec is distinct from old.spec then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif old.status = 'approved'
    and (new.spec is distinct from old.spec
         or new.title is distinct from old.title
         or new.rule_source is distinct from old.rule_source
         or new.course_id is distinct from old.course_id) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger templates_reviewed
  before update on public.templates
  for each row execute function public.templates_reviewed();

-- Is this template approved, and (when a forum is named) is that forum approved and one of the
-- template's? Used by the documents rule below. Security definer so it can look at the
-- template whatever the caller can read; it only answers yes or no.
create function public.template_usable(template uuid, forum uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.templates t
    where t.id = template and t.status = 'approved'
      and (forum is null
           or exists (select 1 from public.template_forums tf
                      join public.forums f on f.id = tf.forum_id
                      where tf.template_id = t.id and tf.forum_id = forum and f.status = 'approved'))
  );
$$;
revoke all on function public.template_usable(uuid, uuid) from public, anon;
grant execute on function public.template_usable(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Students' documents and their versions.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  -- The document keeps its text if a template or forum is later removed.
  template_id uuid references public.templates (id) on delete set null,
  -- The template version it was made from.
  template_version integer check (template_version >= 1),
  forum_id uuid references public.forums (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  -- A document can only join its owner's own project.
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete set null (project_id)
);
alter table public.documents enable row level security;
create index documents_owner_idx on public.documents (owner_id, updated_at desc);
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number integer not null check (number between 1 and 1000),
  -- Filled fields and edits (the document model). Checked by the app's schema before saving.
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_by public.version_author not null,
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now(),
  unique (document_id, number),
  unique (id, document_id),
  -- A version can only belong to the student's own document.
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade
);
alter table public.document_versions enable row level security;

-- The current version must be one of the document's own versions.
alter table public.documents
  add constraint documents_current_version_fkey
  foreign key (current_version_id, id) references public.document_versions (id, document_id)
  on delete set null (current_version_id);

-- The database records which template version a document was made from.
create function public.documents_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.template_version := (select t.version from public.templates t where t.id = new.template_id);
  return new;
end;
$$;
create trigger documents_template_version
  before insert on public.documents
  for each row execute function public.documents_template_version();

-- Versions are numbered 1, 2, 3… by the database, and the newest becomes the current one.
create function public.document_versions_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only to the student's own document (checked first, so nothing about another student's
  -- document is revealed).
  if not exists (select 1 from public.documents d
                 where d.id = new.document_id and d.owner_id = new.owner_id and d.owner_id = (select auth.uid())) then
    raise exception 'Not your document.' using errcode = '42501';
  end if;
  new.number := coalesce(
    (select max(v.number) from public.document_versions v where v.document_id = new.document_id), 0) + 1;
  return new;
end;
$$;
create trigger document_versions_number
  before insert on public.document_versions
  for each row execute function public.document_versions_number();

-- Runs with the owner's own rights: the row rules below still apply.
create function public.document_versions_current()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.documents set current_version_id = new.id where id = new.document_id;
  return null;
end;
$$;
create trigger document_versions_current
  after insert on public.document_versions
  for each row execute function public.document_versions_current();

-- ---------------------------------------------------------------------------
-- Who may do what. Visitors get nothing.
revoke all on public.forums, public.templates, public.template_forums, public.documents, public.document_versions
  from anon, authenticated;

-- Forums and templates: students read approved ones; reviewers and admins read all, write
-- and approve; admins remove.
grant select on public.forums, public.templates, public.template_forums to authenticated;
grant insert (slug, name, kind, state, profile), update (name, kind, state, profile, status)
  on public.forums to authenticated;
grant insert (slug, title, course_id, spec, rule_source), update (title, course_id, spec, rule_source, status)
  on public.templates to authenticated;
grant insert, delete on public.template_forums to authenticated;
grant delete on public.forums, public.templates to authenticated;

create policy "Students read approved forums; reviewers read all" on public.forums
  for select to authenticated using (status = 'approved' or public.is_reviewer());
create policy "Reviewers write forums" on public.forums
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change forums" on public.forums
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove forums" on public.forums
  for delete to authenticated using (public.is_admin());

create policy "Students read approved templates; reviewers read all" on public.templates
  for select to authenticated using (status = 'approved' or public.is_reviewer());
create policy "Reviewers write templates" on public.templates
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change templates" on public.templates
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove templates" on public.templates
  for delete to authenticated using (public.is_admin());

create policy "Students read approved template forums; reviewers read all" on public.template_forums
  for select to authenticated
  using (public.is_reviewer()
         or (exists (select 1 from public.templates t where t.id = template_id and t.status = 'approved')
             and exists (select 1 from public.forums f where f.id = forum_id and f.status = 'approved')));
create policy "Reviewers link templates to forums" on public.template_forums
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers unlink templates from forums" on public.template_forums
  for delete to authenticated using (public.is_reviewer());

-- Documents: owners create (only from an approved template and forum), read, rename, move
-- between their projects and delete their own. Nobody else, staff included, can see them.
grant select, delete on public.documents to authenticated;
grant insert (project_id, template_id, forum_id, title) on public.documents to authenticated;
grant update (title, project_id, current_version_id) on public.documents to authenticated;
create policy "Owners read their documents" on public.documents
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create documents from approved templates" on public.documents
  for insert to authenticated
  with check (owner_id = (select auth.uid())
              and template_id is not null
              and public.template_usable(template_id, forum_id));
create policy "Owners change their documents" on public.documents
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners delete their documents" on public.documents
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Versions: owners add and read their own. Versions are never edited or deleted on their own
-- (they go with the document).
grant select on public.document_versions to authenticated;
grant insert (document_id, content, created_by, model) on public.document_versions to authenticated;
create policy "Owners read their document versions" on public.document_versions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add document versions" on public.document_versions
  for insert to authenticated with check (owner_id = (select auth.uid()));
