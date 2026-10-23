# Data-breach response plan (Phase 7, step 7f; rule P-04, Engineering Rules Appendix D)

Version 1, 2026-10-23. Approved by the founder. Review it after any incident or practice drill, and at least every six months.

**Who leads.** The founder is the incident lead and Lawdeck's data protection contact. Their contact details are kept privately, not in this public repository. If the founder cannot be reached, the legal co-founder acts in their place once named.

**Counsel to confirm.** The legal duties below follow the Nigeria Data Protection Act 2023 (NDPA) as summarised in the PRD and Engineering Rules. Lawdeck's lawyer should confirm them with the Privacy Notice review (step 7i).

## What counts as a breach

Any time personal data Lawdeck holds is, or may have been, seen, copied, changed, lost or deleted by someone who should not have it. For example:

- One student can see another student's chats, uploads or documents.
- A secret key is posted online, or is left in a public place such as GitHub, a screenshot or a chat.
- A laptop or account with access to Supabase, Vercel, GitHub, Anthropic or Voyage is lost or broken into.
- A file or database export with student data is sent to the wrong person.
- Data is deleted by mistake and cannot be recovered.

If in doubt, treat it as a breach and start at step 1. Stopping early costs less than starting late.

## What data Lawdeck holds, and where

| Data | Where | Sensitivity |
|------|-------|-------------|
| Account: email, password (stored scrambled by Supabase), name, campus | Supabase Auth and `profiles` (EU, Ireland) | Personal |
| Chats, questions and answers; practice sets; marked answers; briefs | `conversations`, `messages`, `practice_*`, `attempts`, `briefs` | Personal; may include study content |
| Uploads (notes, handouts, past answers) and their text | `uploads` storage bucket, `uploads`, `upload_pages`, `upload_passages` | Personal; may contain anything the student uploaded |
| Drafted documents (may include party names and addresses typed by students) | `documents`, `document_versions` | Personal; may include third parties' details |
| Share links and who opened them | `shares`, `share_views` | Personal |
| Problem reports and takedown requests (takedown requests include the sender's name and email) | `problem_reports`, `takedown_requests` | Personal |
| Usage records and sign-in limits (emails and internet addresses kept only as SHA-256 scrambles, for a day) | `usage_events`, `search_events`, `auth_attempts` | Low |
| Library material, templates, marking guides | `kb_*`, `templates`, `forums`, `rubrics` | Not personal; copyright-sensitive |

**Services that handle data for Lawdeck:**

- Supabase: database, sign-in and files.
- Vercel: hosting and logs. The logs never hold document text, uploads or passwords.
- Anthropic (Claude): question text and passages, but never names, emails, phone numbers or payment data.
- Voyage AI: passage and question text, for search.
- Google: sign-in, and the Drive import for admins.
- GitHub: code only, no student data.

## The five steps

Start a written log the moment a breach is suspected: a dated note recording what was seen, when, and every action taken (step 5 needs it). Use the template at the end.

### 1. Contain (first hour)

Stop the leak before investigating it.

- **A key was exposed:** rotate it straight away, using the table below. Any key that might have been seen counts as exposed.
- **A feature is leaking:** take it offline. In Vercel, use **Instant Rollback** to go back to the last good deployment, or switch the feature off with its setting. If needed, pause the whole site: Vercel → Project → Settings → Deployment Protection.
- **A person's account is the route in:** sign them out everywhere (Supabase → Authentication → Users → the user → Sign out), and change any passwords and two-step codes involved.
- **Data sent to the wrong person:** ask them in writing to delete it and confirm they have.
- Keep the evidence: don't delete logs or rows that show what happened. Copy the relevant Vercel and Supabase logs into the incident log first.

| Key | Where to make a new one | Then update it in |
|-----|-------------------------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` (most powerful) | Supabase → Project Settings → API keys → roll the secret key | Vercel (Production and Preview), GitHub → Settings → Secrets → Actions |
| `ANTHROPIC_API_KEY` | platform.claude.com → API keys: create a new key, then delete the old one | Vercel, GitHub secrets |
| `VOYAGE_API_KEY` | dashboard.voyageai.com → API keys | Vercel, GitHub secrets |
| `HEALTHCHECK_CODE` | Choose a new long phrase | Vercel |
| Google OAuth client secret | Google Cloud → APIs & Services → Credentials | Supabase → Authentication → Providers → Google |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` (not secret, but restricted) | Google Cloud → Credentials: regenerate and restrict to Lawdeck's address | Vercel |
| Supabase publishable key (not secret; protected by row-level security) | Only if row-level security itself failed: Supabase → API keys | Vercel, GitHub secrets |

After rotating a key, redeploy on Vercel so the new key is used. Then check the old key no longer works, for example the `/health` check with the old code fails.

### 2. Assess (within 24 hours)

Answer these questions, in the log:

- **What data?** Use the table above. Was any of it about third parties, such as names in drafted documents?
- **How many people?** Count affected accounts from the database: rows by `owner_id` in the affected table, over the affected time.
- **Since when, until when?** Use Vercel logs, Supabase logs (API, Auth, Storage) and GitHub history.
- **Was an exposed key used?** Supabase → Logs → API: filter to the time the key was exposed until it was replaced, and look at requests made with that key. Service-role requests show the role `service_role`. Lawdeck's own admin jobs run only from GitHub Actions, so compare their times with GitHub → Actions; anything else is not Lawdeck. Anthropic and Voyage show usage per key in their dashboards.
- **How?** Which route, setting or person.
- **Risk to people:** could it lead to harm such as embarrassment, fraud or discrimination? Is the data easy to misuse (emails and names) or hard (search times)?

The answers decide step 3.

### 3. Notify

- **The Nigeria Data Protection Commission (NDPC):** within **72 hours of becoming aware** of a breach that is likely to put people's rights and freedoms at risk. Include:
  - what happened;
  - the kinds of data and the number of people (approximate if not yet known);
  - the likely effects;
  - what has been done;
  - the contact person (the founder).
  
  If not everything is known by 72 hours, send what is known and add the rest later. Never miss the deadline waiting for detail. Use the NDPC's current contact details and form from its official website (ndpc.gov.ng).
- **Affected students:** without undue delay, when the breach is likely to put them at high risk. Write in plain language:
  - what happened;
  - what data;
  - what Lawdeck has done;
  - what they can do, such as changing their password or watching for scam emails;
  - who to contact.
  
  Send it from the founder's email, one message per student (never a list everyone can see).
- **Not notifying:** if the assessment finds no risk to people (for example, a key was exposed but the logs show it was never used), record why the NDPC and students were not told. The decision and its reasons go in the log.
- **Services involved:** tell Supabase, Vercel, Anthropic or Voyage support when the breach involves their service.

### 4. Fix (before the feature goes back online)

- Remove the cause.
- Add an automatic test that would have caught it, so it cannot happen again unnoticed:
  - database rule problems go in `tests/permissions/sql`;
  - server action or route problems go in `tests/unit/serverGuards.test.ts` or the permission tests;
  - leaked keys go to GitHub push protection, which is on.
- When the cause was a person rather than code (for example a key shown in a screenshot or pasted into a chat), the fix is a written habit added to this plan's "Habits" list, plus a technical guard where one exists.
- Fix it through the normal pull request with all checks green. Never weaken a test or check to get it out faster.

### 5. Record (within 2 weeks)

Write up `docs/incidents/YYYY-MM-DD-short-name.md`. Keep it free of personal data: give counts, not names or emails. Cover:

- the timeline (found, contained, assessed, notified, fixed);
- what happened and why;
- the data and the number of people;
- who was notified and when, or why not;
- the decisions taken and by whom;
- the test added;
- what to change in this plan.

## Habits that prevent breaches

- Never screenshot, screen-share or paste a settings page that shows a key: Vercel environment variables, Supabase API keys, or the Anthropic and Voyage dashboards. Hide the value first, or crop it out.
- Keys live only in Vercel and GitHub's encrypted settings, and in a password manager. Never in chats, emails or documents.
- Use two-step sign-in on Supabase, Vercel, GitHub, Google, Anthropic and Voyage.

## Incident log template (copy into a private note at once)

```
Incident: <short name>            Lead: founder
Suspected at (WAT):               Confirmed at (WAT):
72-hour NDPC deadline (WAT):      <confirmed time + 72 hours>

Timeline (WAT, newest last):
- hh:mm  what was seen / done / decided, by whom

Contain: keys rotated? feature offline? accounts signed out? evidence copied?
Assess:  data | number of people | from–to | how | risk to people
Notify:  NDPC (sent at / not needed because) | students (sent at / not needed because) | services
Fix:     cause removed (PR link) | test added (file)
Record:  write-up at docs/incidents/...
```

## Practice

Run a drill using a made-up incident, without touching the real keys:

- before the pilot (founder, 2026-10-23);
- then once a year;
- and whenever someone new joins the incident team.

Walk through the five steps against the clock. Note anything that was slow or unclear, and fix this plan.
