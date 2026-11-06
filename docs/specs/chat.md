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
2. **Campus groups:** groups from `campuses`, messages, formatting, @mentions, #hashtags, links, live
   updates, unread counts, search, the word filter, rules and posting limit. Tested by admins only.
3. **Files and safety:** PDF, Word and images up to 25 MB; Report a message; admin Hide and a
   moderation page. Then open to students, after counsel reviews the terms and paid plans are on.
4. **Later (after the pilot):** direct messages, private groups, reactions, threads.

## Tests
- `tests/permissions/sql/9zc_campuses_test.sql`, `tests/unit/campus.test.ts`,
  `tests/voice/campus.spec.ts` (test page `/test-pages/campus`, 360 px and desktop).
