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
