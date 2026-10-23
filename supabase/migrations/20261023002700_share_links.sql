-- Lawdeck migration 27: view-only share links (Phase 6, step 6d). PRD EX-04. Founder's decisions
-- (2026-10-23): viewers must be signed in to Lawdeck; release 1 is view-only.
-- 1. shares: a student's link to one of their documents or projects, with a long random token.
--    Revoking it stops access at once (every read checks it).
-- 2. share_views: who opened a link and when, for the owner's "who has access" list.
-- 3. Safe read-only functions: open a link, read a shared document or a shared project's documents
--    and chats. They only work while the link is live and never give write access.

-- ---------------------------------------------------------------------------
-- 1. Share links.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('document', 'project')),
  document_id uuid,
  project_id uuid,
  -- 64 random hexadecimal characters (two random UUIDs): unguessable.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((kind = 'document' and document_id is not null and project_id is null)
      or (kind = 'project' and project_id is not null and document_id is null)),
  -- Only the owner's own document or project can be shared; the link goes when it goes.
  foreign key (document_id, owner_id) references public.documents (id, owner_id) on delete cascade,
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete cascade
);
alter table public.shares enable row level security;
create index shares_owner_idx on public.shares (owner_id, created_at desc);

revoke all on public.shares from anon, authenticated;
grant select, delete on public.shares to authenticated;
grant insert (kind, document_id, project_id) on public.shares to authenticated;
grant update (revoked_at) on public.shares to authenticated;
create policy "Owners read their share links" on public.shares
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create share links" on public.shares
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners revoke their share links" on public.shares
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their share links" on public.shares
  for delete to authenticated using (owner_id = (select auth.uid()));

-- A revoked link stays revoked.
create function public.shares_keep_revoked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  end if;
  return new;
end;
$$;
create trigger shares_keep_revoked
  before update on public.shares
  for each row execute function public.shares_keep_revoked();

-- ---------------------------------------------------------------------------
-- 2. Who opened a link. Written only by open_share(); the link's owner reads it through
-- share_viewers().
create table public.share_views (
  share_id uuid not null references public.shares (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (share_id, viewer_id)
);
alter table public.share_views enable row level security;
revoke all on public.share_views from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reading through a link.

-- The live share for a token, or nothing.
create function public.live_share(share_token text)
returns public.shares
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.shares s
  where s.token = share_token and s.revoked_at is null and share_token ~ '^[0-9a-f]{64}$'
  limit 1;
$$;
revoke all on function public.live_share(text) from public, anon, authenticated;

-- Opens a link: what it shares, and records the viewer (not the owner).
create function public.open_share(share_token text)
returns table (kind text, title text, document_id uuid, project_id uuid, shared_at timestamptz, is_owner boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.shares;
begin
  if me is null then
    raise exception 'Sign in to open shared work.' using errcode = '42501';
  end if;
  s := public.live_share(share_token);
  if s.id is null then
    return;
  end if;
  if s.owner_id <> me then
    insert into public.share_views (share_id, viewer_id) values (s.id, me)
    on conflict (share_id, viewer_id) do update set last_seen_at = now();
  end if;
  return query
  select s.kind,
         coalesce((select d.title from public.documents d where d.id = s.document_id),
                  (select p.name from public.projects p where p.id = s.project_id)),
         s.document_id, s.project_id, s.created_at, s.owner_id = me;
end;
$$;

-- One shared document, read-only: the shared document itself, or a document in the shared
-- project. Returns what the document engine needs to draw it, nothing else.
create function public.shared_document(share_token text, document uuid)
returns table (
  title text,
  forum_name text,
  forum_slug text,
  forum_profile jsonb,
  forum_status public.review_status,
  template_spec jsonb,
  template_status public.review_status,
  content jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to open shared work.' using errcode = '42501';
  end if;
  s := public.live_share(share_token);
  if s.id is null then
    return;
  end if;
  return query
  select d.title, f.name, f.slug, f.profile, f.status, t.spec, t.status, v.content, d.updated_at
  from public.documents d
  left join public.forums f on f.id = d.forum_id
  left join public.templates t on t.id = d.template_id
  left join public.document_versions v on v.id = d.current_version_id
  where d.id = document
    and d.owner_id = s.owner_id
    and ((s.kind = 'document' and d.id = s.document_id)
      or (s.kind = 'project' and d.project_id = s.project_id));
end;
$$;

-- A shared project's documents and chats (titles only).
create function public.shared_project_items(share_token text)
returns table (item_kind text, id uuid, title text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to open shared work.' using errcode = '42501';
  end if;
  s := public.live_share(share_token);
  if s.id is null or s.kind <> 'project' then
    return;
  end if;
  return query
  select 'document'::text, d.id, d.title, d.updated_at from public.documents d
   where d.project_id = s.project_id and d.owner_id = s.owner_id
  union all
  select 'chat'::text, c.id, c.title, c.updated_at from public.conversations c
   where c.project_id = s.project_id and c.owner_id = s.owner_id
  order by 4 desc
  limit 400;
end;
$$;

-- One chat in a shared project, read-only: its messages and their sources' titles (never the
-- passages themselves).
create function public.shared_chat_messages(share_token text, chat uuid)
returns table (role public.message_role, content jsonb, created_at timestamptz, sources jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to open shared work.' using errcode = '42501';
  end if;
  s := public.live_share(share_token);
  if s.id is null or s.kind <> 'project' then
    return;
  end if;
  return query
  select m.role, m.content, m.created_at,
         coalesce((select jsonb_agg(jsonb_build_object('label', ms.label, 'title', ms.item_title, 'origin', ms.origin) order by ms.label)
                   from public.message_sources ms where ms.message_id = m.id), '[]'::jsonb)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.id = chat and c.project_id = s.project_id and c.owner_id = s.owner_id
  order by m.created_at
  limit 500;
end;
$$;

-- Who has opened one of the caller's own links (name if they gave one), most recent first.
create function public.share_viewers(share uuid)
returns table (viewer_name text, first_seen_at timestamptz, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), 'A Lawdeck user'), v.first_seen_at, v.last_seen_at
  from public.share_views v
  join public.shares s on s.id = v.share_id
  left join public.profiles p on p.id = v.viewer_id
  where v.share_id = share and s.owner_id = (select auth.uid())
  order by v.last_seen_at desc
  limit 200;
$$;

revoke all on function public.open_share(text), public.shared_document(text, uuid), public.shared_project_items(text),
  public.shared_chat_messages(text, uuid), public.share_viewers(uuid) from public, anon;
grant execute on function public.open_share(text), public.shared_document(text, uuid), public.shared_project_items(text),
  public.shared_chat_messages(text, uuid), public.share_viewers(uuid) to authenticated;
