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
