# Drafting (Phase 5)

PRD DR-01 to DR-09, EX-01 and EX-02; System Design §2.2, §3 (forums, templates, documents, document_versions) and §7; Engineering Rules H-03 to H-05.

## Plan (approved by the founder, 2026-10-23)
- 5a. Tables and permission rules (migration 21). This step.
- 5b. Template and forum-profile files in `src/templates`, checked by schema; reviewer page to approve or withdraw.
- 5c. One renderer: A4 page preview and DOCX from the same document model; automatic checks (DR-06). The `docx` library is asked for before this step.
- 5d. Draft flow: choose document and court or registry, short intake, Opus fills only narrative parts, missing facts stay as placeholders.
- 5e. Preview panel, edits (direct and by instruction), versions.
- 5f. "Why is it arranged this way?" and related documents.
- 5g. First templates, drafted from the library's prescribed forms and approved by the legal reviewer. Civil Litigation first; Property Law when its notes are in the library.
- 5h. Export tests. PDF: Gotenberg tested free in the automatic checks; hosted only when the founder approves the monthly cost.

## Data (migration 21)
| Table | Holds | Access |
|---|---|---|
| forums | court or registry, state, formatting profile, review status | students read approved; reviewers read all, write, approve; admins remove |
| templates | document type, course, structure (spec), rule source, version, review status | as forums |
| template_forums | which courts or registries a template is for | students read links between approved ones; reviewers write |
| documents | a student's draft: template and version used, court or registry, title, project, current version | owner only (staff cannot see them) |
| document_versions | numbered contents, who made each (student or AI) | owner only; never edited |

Rules the database enforces (tested in `tests/permissions/sql/9d_drafting_test.sql`):
- A template needs its structure and rule source, and a forum its profile, before approval. Changing an approved one sends it back to draft; a template's version goes up when its structure changes.
- A document can only be made from an approved template, and only for an approved court or registry that template is for.
- Versions are numbered by the database and the newest becomes current; a student can go back to an earlier one.
- Removing a template leaves students' documents in place.

## Template files and reviewer page (step 5b)
- Files live in `src/templates` (`forums/` and `documents/`, registered in `index.ts`) and are checked by `src/schemas/drafting.ts`:
  - **Court or registry**: name, kind, state, and formatting profile (paper, font and size, line spacing, margins, page numbers, cover page, who signs) with its source.
  - **Template**: course, the courts or registries it is for, the rule it follows, and parts in order. Each part is fixed wording (which may use `{{field}}` intake facts), a narrative part the AI writes (with an instruction and a word limit), or the signature block. Each part says why it is there (DR-08). Also: intake questions with the placeholder shown when a fact is missing, defined terms to check, related documents, and a change log.
  - The checks refuse unknown settings, wording that uses a field that does not exist, AI parts without an instruction or limit, duplicate names, parts limited to a court the template is not for, and placeholders not in capitals.
- **/admin/templates** (Templates in the staff menu): **Load from files** adds new files and updates changed ones as drafts, and lists any file that fails the checks with what to fix. Reviewers approve, send back to draft or withdraw; admins delete. Nothing is approved unless it passes the checks again at that moment.
- The first court files (High Court of Lagos State, High Court of the FCT, Federal High Court, Lagos State Lands Registry) use the PRD 7.3 default formatting, marked "to be confirmed by a reviewer".

## Document engine and checks (step 5c)
- **One model, two outputs (rule H-04).** `src/server/documents/render.ts` turns a template, a court profile and the student's content (facts, narrative parts, own rewrites) into one document model. The on-screen page (`src/components/draft/DocumentSheet.tsx`) and the Word file (`src/server/documents/docx.ts`, library `docx`, approved by the founder 2026-10-23) are both drawn from it, sharing the paper sizes and spacing in `layout.ts`.
- **Missing facts.** A missing fact shows as its placeholder, e.g. **[DEFENDANT’S ADDRESS]**: bold, grey box and dashed underline, on screen and in Word. An unwritten part shows "[FACTS TO BE ADDED]". Nothing is invented. Several parties read "A, B and C"; dates read "23 October 2026".
- **Court rules.** Parts limited to other courts are left out, and empty optional parts are skipped. The signing space follows the profile (counsel, party or both). A cover page sits alone on page 1.
- **Automatic checks (DR-06)** in `checks.ts` flag; they never change the document:
  - required parts not written, and required facts missing;
  - impossible dates, in the facts and in the text (e.g. "31st day of April, 2026");
  - a party written two ways (titles, the surname alone and ordinary words are fine);
  - defined terms used only once.
- On screen, the page keeps the court's proportions at any width. Splitting into separate A4 pages and zoom for phones come with the preview panel (5e).

## Draft flow (step 5d)
- **Choosing a document (DR-01, DR-02).** The **Drafting catalogue** (`/drafting`) lists approved templates by course. A typed request on the home screen in Draft mode, or one Auto mode sends to Draft, is matched to one approved template by Claude Haiku (prompt `draft-pick-v1`; only the template titles and the request, with emails and phone numbers removed, are sent). No match opens the catalogue with a note. Matching is recorded but free.
- **Court or registry (DR-03).** Asked only when the template is approved for more than one; with one, it is used without asking.
- **Intake (DR-04).** One question per template field (`/drafting/[slug]`); several answers where the field allows it. Every answer is optional: what is left out shows as its placeholder. The server keeps only the template's own fields (`factsFor`) and checks dates.
- **Writing (PRD 7.1).** Opus (prompt `draft-v1`, low effort, 60-second limit) writes only the narrative parts, each within its word limit, as JSON. The template supplies everything else.
  - **Names never reach the AI (rule G-06).** Parties and addresses are sent only as "given" with a stand-in such as `{{claimant}}`; a party's name typed inside another fact is swapped for its stand-in; emails and phone numbers are removed. Claude writes the stand-ins, and the document engine puts the real fact, or its placeholder, in their place.
  - **Checks on Claude's text:** stand-ins that are not fields are dropped; Markdown is removed; word limits hold (cut at a full sentence); any case or statute not in the approved library is removed (`libraryOnlyContext`).
- **Saving and cost.** The document and version 1 are saved only after Claude's text is checked. A draft that used the AI counts as one question (migration 23); failures are free. The allowance is checked before Opus runs.
- **The document (`/documents/[id]`).** The automatic checks, the document as it will print, and **Download Word file** (`/api/documents/[id]/docx`, owner only). **Documents** (`/documents`) lists the student's drafts. Editing and versions come in 5e.
- **Unreviewed wording is never shown.** If a document's template or court is sent back for review or removed, the document page says it is being re-checked and the Word file is not offered; the student's facts and text stay saved.
- **Drafting test** (`npm run eval:drafting`, or Actions → "Drafting test"): one made-up document drafted by Opus with the real prompt, checked for stand-ins, word limits, the missing fact left as its stand-in, no authority named, no sum invented, and 30 seconds. About 5 cents. Prints results only, never the text (public repository).

## Preview panel, edits and versions (step 5e)
- **Pages in the right panel (PRD 7.1).** `/documents/[id]` opens the document's pages beside the work area on wider screens; on phones **Show pages** opens them full screen. Each heading and paragraph is measured at real size in the court's font and placed on pages of its paper with its margins and page numbers (`src/lib/paginate.ts`): a heading stays with the next paragraph, and after a cover page the next part starts a new page. Breaks fall between paragraphs (a long paragraph moves whole); 5h compares this with Word. Zoom in and out for phones.
- **Clicking a placeholder** on a page opens the matching question in Facts (or the part in Wording); on phones the pages close first.
- **Direct edits (DR-05), no AI, free:**
  - **Facts:** the intake answers, to change or complete.
  - **Wording:** any part except the signature space can be rewritten by hand; **Put back the original wording** removes the rewrite. Words in `{{double braces}}` are filled from the facts.
- **Change by instruction (DR-05).** Opus (prompt `draft-edit-v1`) may rewrite only the document's narrative parts, never the template's fixed wording, the court or the layout. Names and addresses go only as stand-ins, including inside the student's own wording and the instruction (known names masked; emails and phone numbers removed); the box tells students to put new names in Facts. If the change needs a new fact (e.g. a third defendant's name), Claude lists it and Lawdeck opens that question, with an extra entry where several are allowed; nothing is invented. Rewritten parts are cleaned and citation-checked as in 5d. A change by instruction counts as one question (founder, 2026-10-23).
- **Versions.** Every saved change is a new numbered version marked You or Lawdeck. **Look** shows an earlier version in the panel without changing anything; **Restore** makes it current again. Nothing is deleted. No migration: the 5a rules already allow owners to add versions and choose the current one.
- **Drafting test** now also makes one change by instruction ("add a third defendant") and checks it asks for the new defendant, writes no real name, names no authority, explains itself and takes under 30 seconds. About 3 cents a run.

## First templates (step 5g)
Five templates in `src/templates/documents`, registered in `src/templates/index.ts`. Each part says where its wording comes from (in "why"), so the legal reviewer can check it. Sources: S.A Badmus' Civil Litigation and Property Law drafts, the Civil Litigation Handbook 2025 and the Property Law Practice Handbook 2025 (all in the knowledge base folder).

| Template | Courts or registries | Notes |
|---|---|---|
| Writ of summons (within jurisdiction) | High Court of Lagos State; High Court of the FCT | Form 1. Appearance within 42 days (Lagos) or 14 days (FCT); memorandum; indorsement of claim (written by Opus from the claims given); issued-by note; indorsement as to service with the frontloaded documents (Pre-action Protocol Form 01 in Lagos, Pre-action Counselling Certificate Form 6 in the FCT); Registrar's certificate (Lagos). |
| Statement of claim | Lagos; FCT | Introductory averments, facts and reliefs written by Opus from the facts given; omnibus relief fixed. |
| Motion on notice with affidavit in support | Lagos; FCT | The student gives the rules relied on (Claude never names rules). Reliefs, grounds and depositions written by Opus; the oath (Oaths Act) and jurat are fixed, undated for the Commissioner for Oaths. The written address is not included. |
| Deed of assignment (statutory right of occupancy) | Lagos State Lands Registry | All fixed wording, no AI: commencement, recitals, testatum (without "now"), consideration and receipt, beneficial owner, ALL THAT, habendum, indemnity and safe-custody covenants, testimonium, schedule, execution and attestation, Governor's consent, franking. |
| Tenancy agreement | none | Commencement, letting with certain start and end dates, rent, tenant's and landlord's covenants, optional other terms (Opus, only if given), default proviso adapted for Lagos (possession only in accordance with the law), execution under hand. |

Drafting rules from the sources built in: no suit number or hearing date (the Registrar fills them), affidavits undated, "Oaths Act" not "Oaths Law", "of the one part / of the other part", execution without "the within named". Names of parties, counsel and deponents are "party" or "address" facts, so they never reach the AI.

**Not yet:** writs for service outside the jurisdiction (Form 2) and fast-track writs (Form 33); company, attorney, family, illiterate and blind execution variants of the deed (the student adjusts the execution part by hand); a page break before the affidavit (the engine has no in-document page break yet; noted for 5h).

**Review:** the templates load as drafts on **/admin/templates** (Load from files). Students see one only after the legal reviewer approves it there; approval re-runs the checks. Points flagged for the reviewer are marked "Reviewer:" in the part's "why".

## "Why is it arranged this way?" and related documents (step 5f)
- **Why (DR-08).** On every document (the workspace's **Why is it arranged this way?** section) and on the question page before drafting, each part is listed in order with what it does and the rule behind it, from the reviewed template's "why" notes. Parts without a heading are named by their first line (`partLabel`). On a document, **Show on the pages** opens the pages at that part. On the question page, parts limited to some courts say so.
- **Related documents (DR-09).** Under a document, **Documents that go with this** lists the template's related documents. **Draft it with the same facts** opens that document's questions (`/drafting/[slug]?from=<document>`) with the answers to the same questions filled in (`sharedFacts`) and the same court chosen where it applies; the student checks them before drafting. A related document whose template is not yet approved shows "Awaiting review" with no link.
- **The Lagos front-loading set.** A writ (and a statement of claim) now relates to: statement of claim, Pre-action Protocol Form 01 (Lagos only), list of witnesses, witness statement on oath, and list of documents to be relied on. The four new templates load as drafts for the legal reviewer, like those of 5g.
- **Numbered lists.** In a template, a line starting `#. ` is repeated for each answer of the several-answer facts it uses, numbered 1., 2., … (witnesses with their addresses, documents). With no answers it shows one numbered placeholder line.
- No AI, no migration, no new library. Drafting a witness statement or Form 01 uses Opus for the depositions or settlement steps, like any draft.
