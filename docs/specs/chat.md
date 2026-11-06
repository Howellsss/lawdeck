# Campus chat (PRD v2.1, sections 6 and 7; founder approved 2026-11-06)

Students on every Law School campus, and aspirants, talk in open campus groups that anyone can read
and post in, with Slack-style formatting, @mentions, #hashtags, links and files. No AI is used.

## Founder decisions (2026-11-06)
- First sign-in asks for a campus, or "Law School aspirant" for final-year university students.
- One group per campus, plus Aspirants and All campuses; everyone can open every group and post.
- Messages appear straight away (an exception to "unreviewed content is never shown", recorded in
  CLAUDE.md): labelled as students' own words, Report a message, admin Hide, a posting limit,
  community rules accepted once.
- Vulgar and curse words are blocked: a message containing one is not sent and the student is told
  why (English and Nigerian Pidgin word list, kept as data by admins).
- Look: Slack-style layout (clean lines, names and times, day markers, a formatting bar) in
  Lawdeck's own black-and-white tokens.

## Phases
1. **Campus choice (built):** migration 54 adds `campuses` (reference data, readable by signed-in
   people, changed only by migration) and makes `profiles.campus` a key on that list. Draft list:
   Abuja, Lagos, Kano, Enugu, Yenagoa, Yola, Port Harcourt, plus "Law School aspirant" — awaiting the
   founder's confirmation. The home page asks once (`CampusPrompt`); the Account page changes it
   (`CampusForm`, `saveCampus`); Admin → Users shows the campus name.
2. **Campus groups (built):** migration 55. Staff only until an admin opens chat
   (`chat_settings.open_to_students`, Phase 3); `chat_allowed()` decides in the database.
   - Groups (`chat_groups`): All campuses, one per campus, Aspirants. Side menu "Campus chat"
     (`ChatNavSlot`, shown only to people chat is open to); `/chat` opens the student's own campus.
   - Community rules accepted once (`chat_members`); only members post and can be @mentioned.
   - Messages (`chat_messages`): a small Markdown-like set drawn by Lawdeck's own parser
     (`src/lib/chatFormat.ts`, React elements only, web links only, opened with
     `noopener noreferrer nofollow ugc`): bold, italic, strike, links, lists, quote, code, @mentions
     stored as `@[Name](id)`, #hashtags (open `/chat/search?tag=`). Formatting bar, Ctrl+B/I/K,
     Enter to send, Shift+Enter for a new line, @ suggestions from chat members (`chat_people_search`,
     names only, never emails).
   - Blocked words (`chat_blocked_words`, admin-kept): checked by the database before saving, whole
     words only, after lower-casing, look-alike characters and repeated letters; a refused message
     is not sent and the student is told why. Posting limit: 8 a minute, 300 a day.
   - New messages appear by checking every 4 seconds while the page is in view (no live connection,
     so no free-plan connection limit); unread counts per group (`chat_reads`, `chat_unread_counts`)
     refresh every 30 seconds; search across all groups (`/chat/search`). Delete your own message.
   - Times in WAT with Today / Yesterday / date markers; a person's messages within 5 minutes sit
     under one name.
3. **Files and safety:** PDF, Word and images up to 25 MB; Report a message; admin Hide and a
   moderation page. Then open to students, after counsel reviews the terms and paid plans are on.
4. **Later (after the pilot):** direct messages, private groups, reactions, threads.

## Tests
- `tests/permissions/sql/9zc_campuses_test.sql`, `tests/unit/campus.test.ts`,
  `tests/voice/campus.spec.ts` (test page `/test-pages/campus`, 360 px and desktop).
- `tests/permissions/sql/9zd_campus_chat_test.sql` (staff only until opened, rules first, word filter,
  posting limit, own messages only, members only listed), `tests/unit/chatFormat.test.ts`,
  `tests/unit/chatTime.test.ts`, `tests/unit/chatComposer.test.ts`, `tests/voice/chat.spec.ts`
  (test page `/test-pages/chat`, 360 px and desktop); e2e: chat pages ask visitors to sign in.
