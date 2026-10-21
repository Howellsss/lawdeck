-- Lawdeck migration 2 of 3: projects, conversations (chats) and messages.
-- Every row belongs to one student (owner_id). Only that student can see it.

create type public.conversation_mode as enum ('learn', 'draft');
create type public.message_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets chats point at (project, owner) so a chat can only join its owner's project.
  unique (id, owner_id)
);
alter table public.projects enable row level security;
create index projects_owner_id_idx on public.projects (owner_id);
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null default 'New chat' check (char_length(title) between 1 and 200),
  mode public.conversation_mode not null default 'learn',
  course_id uuid references public.courses (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  -- The database itself refuses a chat inside someone else's project.
  -- Deleting a project keeps its chats (they just leave the project).
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete set null (project_id)
);
alter table public.conversations enable row level security;
create index conversations_owner_id_idx on public.conversations (owner_id, updated_at desc);
create index conversations_project_id_idx on public.conversations (project_id);
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role public.message_role not null,
  content jsonb not null,
  model text,
  tokens_in integer check (tokens_in >= 0),
  tokens_out integer check (tokens_out >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  -- A message can only go into a chat owned by the same student.
  foreign key (conversation_id, owner_id) references public.conversations (id, owner_id) on delete cascade
);
alter table public.messages enable row level security;
create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Who may do what. Visitors who are not signed in get nothing.
revoke all on public.projects, public.conversations, public.messages from anon, authenticated;

-- Projects: owners create, read, rename and delete their own.
grant select, delete on public.projects to authenticated;
grant insert (name), update (name) on public.projects to authenticated;
create policy "Owners can read their projects" on public.projects
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can create projects" on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can rename their projects" on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners can delete their projects" on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Conversations: owners create, read, retitle, move and delete their own.
grant select, delete on public.conversations to authenticated;
grant insert (project_id, title, mode, course_id), update (project_id, title, course_id)
  on public.conversations to authenticated;
create policy "Owners can read their chats" on public.conversations
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can create chats" on public.conversations
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can change their chats" on public.conversations
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners can delete their chats" on public.conversations
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Messages: owners read and add to their own chats. Messages are never edited.
-- They disappear when their chat is deleted.
grant select on public.messages to authenticated;
grant insert (conversation_id, role, content, model, tokens_in, tokens_out, cost_usd)
  on public.messages to authenticated;
create policy "Owners can read their messages" on public.messages
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can add messages to their chats" on public.messages
  for insert to authenticated with check (owner_id = (select auth.uid()));
