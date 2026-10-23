# Drafting data files

- `forums/`: one file per court or registry, with its formatting profile (paper, font, spacing, margins, page numbers, signature block) and where that formatting comes from.
- `documents/`: one file per document type: the parts in order, fixed wording, intake fields, the parts the AI writes, the rule it follows, and a change log.

Every file is checked against `src/schemas/drafting.ts`. A reviewer loads the files on **/admin/templates**: new and changed files arrive as drafts, and students see nothing until a reviewer approves it. Changing an approved file and loading it again sends it back to draft.

Register each new file in `index.ts`.
