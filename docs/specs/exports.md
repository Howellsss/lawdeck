# Exports (Phase 6, step 6e; PRD EX-03)

Founder approved 2026-10-23. Documents already export to Word and PDF (EX-01, EX-02).

## What a student can export
- **A chat, as study notes**: each question, its answer, and the titles of the sources each answer used.
- **A brief**: its sections (uncovered ones marked as such) and its source titles.
- **A practice set**: each question, any choices, and the answer. Answers the student has not revealed yet stay hidden ("Answer not shown yet"). Flashcard sets can also be exported with only the cards not marked "know it".

Each screen has **Download Word** and **Save as PDF**. The PDF opens a print page (`/print/study/<kind>/<id>`); the student picks "Save as PDF" in the print window, as for documents.

## How it works
- `src/server/exports/sheet.ts` turns a chat, brief or set into one study-sheet model (headings, text, bullet lists). The Word file (`docx.ts`) and the print page (`SheetView`) are both drawn from it, so they match.
- Plain A4, black and white, Arial in Word; printed sheets use the light-theme colours whatever the screen theme.
- Long exports are cut at 4,000 blocks, with a note saying so.

## Rules kept
- Owner only. The download route and print page check sign-in on the server. The data comes through the normal reads, so row-level security returns nothing for another student's id ("not found").
- Only what the student already sees on screen: never library passages (rule: full source files are never downloadable), only source titles.
- No database change, no AI, no cost, no new library (uses the `docx` library approved in 5c).

## Tests
`tests/unit/exports.test.ts` (sheet contents, hidden answers, "not known" filter, Word file opens) · `tests/unit/exportRoute.test.ts` (visitors, bad kinds or ids, someone else's id) · e2e visitor check.
