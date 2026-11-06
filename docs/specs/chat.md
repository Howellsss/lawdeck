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

## Who may use chat (founder, 2026-11-06, after Phase 2)
- **Verification first:** a free account is not enough. A student sends a photo or PDF of their Law
  School ID card or admission letter and their Law School number; an aspirant, their university ID or
  final-year letter and matriculation number (`/chat` shows the form; `ChatVerifyForm`,
  `src/server/chat/verification.ts`). The document goes to a private store (`chat-ids`, own folder,
  readable only by admins), its real type is checked, and it is deleted as soon as an admin decides.
- **Admin → Chat checks** (`/admin/chat`, admins only): view the ID for 2 minutes, Approve, Reject with
  a reason the student sees, or Remove from chat (permanent; they cannot ask again). Approval sets the
  student's campus to the verified one.
- **Groups (founder: option A):** a verified student sees their own campus group and All campuses only;
  an aspirant sees only Aspirants; staff see every group (`chat_scope()`, `chat_group_visible()`).
- **No contact harvesting:** phone numbers (any format), email addresses and WhatsApp, Telegram or
  social links are refused in messages, like blocked words; no direct messages; no member list.
- Side menu: everyone signed in sees Campus chat (founder, 2026-11-06). Students who can't use it
  yet land on the verification form, which is also where they choose their campus (the home page no
  longer asks; the Account page can still change it). Admins see "Chat checks" with the number of
  requests waiting. Migration 56.

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
3. **Files and safety (built):** migration 57.
   - Files: up to 4 a message (PDF, Word DOCX, PNG, JPEG; 25 MB each) by the paperclip in the
     message box; a message may be files only. Each file goes to the private `chat-files` store at
     `group/sender/random.ext`: only people who can see the group can open it (links last an hour),
     people add files only to their own folder in their own groups. Before posting, the server
     checks each file is the sender's, in that group, and really the kind its name says; the
     database checks the details again. File names go through the word and contact filters.
     Pictures show as previews, documents as cards with kind and size. Deleting a message deletes
     its files.
   - Report a message (`chat_reports`): anyone who can see a message reports it once, with a reason
     (rude or vulgar, contact details, exam cheating, spam, other with a note).
   - Admin Hide (`chat_set_hidden`): hides a message for everyone (from the message menu or the
     moderation list) and closes its reports; Show again undoes it. Admins can also keep a reported
     message and close its reports.
   - Admin → Chat checks: the "Open chat to students" switch (`chat_settings.open_to_students`),
     reported messages (`chat_report_queue`, admins only; "Dealt with" folded below), then
     verification requests. Open it after counsel reviews the terms and paid plans are on.
3b. **Slack-style look (founder, 2026-11-06; option A, no new library):** migration 58.
   - Message box: formatting row (Bold, Italic, Underline `++x++`, Strike, Link, lists, Quote, Code)
     that **Aa** hides or shows; under the text, **+** attach, **Aa**, an emoji panel (every standard
     emoji up to Emoji 15.1, 1,898, in `src/lib/emojiData.ts`, made once from the MIT-licensed
     unicode-emoji-json data, loaded only when the panel opens; search by name, a tab per group,
     recently used kept in the browser), **@** mention, and Send on the right. Video and audio clips, slash
     commands and paragraph styles are left out.
   - **Add link** box (Text and Link, Cancel and Save): the message box shows only the words; the
     address is listed under the text and joined on sending. Only web addresses (https:// added when
     left out).
   - Group header: name, member count (`chat_member_counts()`: verified members who accepted the
     rules, a number only), search inside the group (`/chat/search?in=group`), and the **Messages**
     and **Files & links** tabs (`/chat/[group]/files`: files and web links shared in the group,
     newest first).
4. **Study together (founder, 2026-11-06), built in this order, one pull request each:**
   - **4a Study groups (built, migration 59):** a verified chat member creates a private group
     (2–60 characters, word and contact filters, at most 10 each) and invites chat members by name
     (`chat_invite_search`, never email or phone): students with students, aspirants with aspirants,
     up to 15 people counting invitations. Invitations show in the group list with Join and Decline.
     Only members see the group, its messages and files (staff too: moderation is through reports).
     The creator renames it, removes people or deletes it (messages go with it; its files can no
     longer be opened); others leave. Members tab: members, invited, invite by name, settings. All
     changes go through database functions; nobody writes the tables directly.
   - **4b Voice notes (built, migration 60):** study groups only (founder: audio can't be
     word-filtered; Report and Hide are the safeguards). The microphone button records with the
     browser's own recorder (no library): WebM on Chrome and Android, MP4 audio on iPhone, Ogg on
     Firefox; up to 2 minutes (stops by itself) and 5 MB; listen back, then Send or Delete. Stored in
     the group's private file store; the server checks the real audio type from the first bytes and
     the database checks study group only, one per message, 2 minutes and 5 MB. Played with play,
     pause, progress and 1x / 1.5x / 2x. Security headers allow the microphone on Lawdeck and
     playback from the Supabase store.
   - **4c Group quiz, like Kahoot (built, migration 61):** a Quiz tab in each study group. A member
     hosts: a topic (only topics whose approved lesson has at least 3 multiple-choice recall
     questions), 3 to 10 questions, 10 to 60 seconds each; the group gets a message. Members join in
     the lobby; the host starts and moves on. Each question shows a timer and large A–D buttons; the
     right answer and explanation stay in the database until the question closes (time up or
     everyone answered). A right answer scores 500 to 1000 points (faster scores more); a
     leaderboard follows each question and ends the quiz. One quiz at a time per group (an open quiz
     older than 3 hours counts as finished); the host or the group's creator can end it early.
     Screens check for changes every second while a quiz is on (no live connection, no library).
     No AI cost. All reads and changes go through database functions.
   - **4c+ Quiz extras (built, migration 62; founder approved):** Lawdeck's own music and sounds
     (original tunes played by the browser's Web Audio from notes in `src/lib/quizSound.ts`; no
     files, no library; Kahoot's music is not used because it belongs to Kahoot): lobby music,
     question music at the lobby's pace and rhythm all the way through, no ticking (founder, 2026-11-06: no speed-up; music much louder, with a limiter), "3, 2, 1" beeps, a chime for
     a right answer, a low tone for a wrong one, a fanfare for the results; a sound on/off button
     remembered on the phone; sound starts only after a tap (phones require it). Each question
     opens after a 3-second "Get ready" (answers before it are refused). Streaks: 100 bonus points
     for each right answer in a row before this one, up to 500. After each question, a chart of how
     many chose each answer; the final leaderboard has a podium for the top three. Join by code
     (people outside the group) is not built: it would change who can see a group's quiz.
   - **4d Study together (built, migration 63; founder approved):** a book button in the message box
     shares a topic lesson as a card (pick a course, then a topic, with an optional note) in any group
     the student can see. The card shows the topic, its course and Open lesson, and the "Not yet read in
     full by a reviewer" note when the lesson was approved with its course; it never copies the
     lesson's text. Only topics with an approved, current lesson can be shared. Study groups show
     "This week's topic" at the top (topic, who set it and when, Open lesson); only the group's
     creator sets, changes or clears it, and setting it posts the card in the group. The note goes
     through the word filter, contact-details check and posting limit; everything goes through
     checked database functions (`chat_share_lesson`, `chat_set_week_topic`).
   - **4e Polls (built, migration 64; founder approved):** a chart button in the message box makes a
     poll in any group the student can see: a question (the message's text) and 2 to 6 different
     choices, open for 1 day, 3 days or 1 week. One vote each, changeable until it closes; results
     (bars with numbers) show after voting or once closed. Anonymous by default; in study groups the
     maker can show who voted for each choice. The maker can close it early. The question and choices
     go through the word filter, contact-details check and posting limit; Report and admin Hide work
     on the message, and deleting it deletes the poll. Open polls on screen refresh every few
     seconds. Poll tables are read and written only through checked database functions.
   - **4f Group calls (built, migration 65; founder approved LiveKit Cloud, the `livekit-client`
     library and starting on LiveKit's free plan):** study groups only. A call line at the top of
     the group: "Start a call", or "Call in progress" with who is in it and Join (checked every 10
     seconds). In the call: a tile per person (initials, or video when their camera is on; a ring
     while speaking), Mute, Camera on/off and Leave. Audio first: everyone joins with the camera
     off. At most 15 people; a call lasts up to 3 hours; never recorded. The server checks the
     student is a member, then gives a 10-minute pass for that call's room only (signed on the
     server; LiveKit keys only in Vercel settings, `src/server/chat/livekit.ts`). The browser checks
     in every 30 seconds; minutes are counted per person for a monthly limit (Admin -> Chat, default
     4,500, just under the free plan's 5,000), and when it is reached calls end and none start until
     the 1st (West Africa Time). LiveKit's code loads only when a student joins a call. The camera
     is now allowed on Lawdeck's own pages (security headers), as the microphone already was.
     Until the three LiveKit settings are added in Vercel, the call line stays hidden.
   - **4g Invite links and the ID test switch (built, migration 66; founder approved):** a study
     group's creator makes an invite link in the Members tab (`/chat/join/<code>`; only a hash is
     stored, so the link is shown once; 7 days; a new link stops the old one; Turn off link). Opening
     it: sign up or log in (account creation keeps the link as the place to return to), Lawdeck
     access (the link gives it while invite-only is on), the chat ID step, the community rules,
     then Join. Students join student groups, aspirants aspirant groups; at most 15 people.
     Admin -> Chat has "Approve IDs automatically (testing)", off by default: while on, the ID step
     asks for a number only (3+ characters, no document) and approves it at once, marked as
     automatic. It switches off a safety check: turn it off before real students join.
   - Later still: direct messages, reactions, threads, editing a sent message, notifications
     outside Lawdeck.

## Tests
- `tests/permissions/sql/9zc_campuses_test.sql`, `tests/unit/campus.test.ts`,
  `tests/voice/campus.spec.ts` (test page `/test-pages/campus`, 360 px and desktop).
- `tests/permissions/sql/9zd_campus_chat_test.sql` (staff only until opened, rules first, word filter,
  posting limit, own messages only, members only listed), `tests/unit/chatFormat.test.ts`,
  `tests/unit/chatTime.test.ts`, `tests/unit/chatComposer.test.ts`, `tests/voice/chat.spec.ts`
  (test pages `/test-pages/chat` and `/test-pages/chat-verify`, 360 px and desktop); e2e: chat pages
  ask visitors to sign in; Admin → Chat checks is hidden from visitors.
- `tests/permissions/sql/9ze_chat_verification_test.sql` (free accounts see nothing, one open request,
  admins decide, groups per campus, aspirants apart, contact details refused, removal, ID documents).
- `tests/permissions/sql/9zf_chat_files_reports_test.sql` (files only in your own folder of your own
  groups, others' groups unreadable, file details checked, filters on file names, one report per
  person, reports private, only admins hide, show or list reports, the open switch admins only),
  `tests/unit/chatFiles.test.ts`; `tests/permissions/sql/9zg_chat_member_counts_test.sql` (counts only
  for the groups you can see, verified members only, nothing for free accounts); `tests/voice/chat.spec.ts` checks file cards, the paperclip and the
  report form.
- `tests/permissions/sql/9zh_chat_study_groups_test.sql` (private to members, invitations, same side
  only, 15 people and 10 groups, creator-only rename, remove and delete, leave, name filter, visitors);
  `tests/voice/chat.spec.ts` checks the Study groups list, invitations, New study group and Members
  (test page `/test-pages/chat-members`).
- `tests/permissions/sql/9zi_chat_voice_notes_test.sql` (study groups only, 5 MB, 2 minutes, audio
  only, one per message); unit checks of audio types in `tests/unit/chatFiles.test.ts`; test page
  `/test-pages/chat-study` (voice note player, record button only in study groups).
- `tests/permissions/sql/9zj_chat_quizzes_test.sql` (study groups only, members only, one quiz at a
  time, answer hidden until the question closes, one answer each, the timer, host-only controls,
  scoring, no direct table access); `tests/permissions/sql/9zk_chat_quiz_extras_test.sql` (get
  ready, early answers refused, streak bonus, answer chart only once closed); `tests/unit/quiz.test.ts`;
  test page `/test-pages/chat-quiz` (?s=ready, live, closed, done).
