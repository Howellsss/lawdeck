-- Lawdeck migration 67: a record of each person's acceptance of the Terms of Use and Privacy Notice
-- (founder approved, 2026-11-13; data protection questionnaire Q86; docs/specs/account-and-feedback.md).
-- Each row says who accepted which version, and when. The time is set by the database, never by the
-- browser. A person can add their own record and read it; nobody can change or delete a record (it
-- goes only with the account). Admins can read all records, as evidence of consent.

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  terms_version text not null check (char_length(terms_version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  unique (owner_id, terms_version)
);
alter table public.terms_acceptances enable row level security;

revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;
-- Only the version can be supplied: the owner and the time come from the sign-in and the clock.
grant insert (terms_version) on public.terms_acceptances to authenticated;

create policy "terms_acceptances: read own, admins read all"
  on public.terms_acceptances for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "terms_acceptances: add own"
  on public.terms_acceptances for insert to authenticated
  with check (owner_id = (select auth.uid()));
