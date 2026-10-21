import "server-only";

// Rule G-06: never send email addresses or phone numbers to the AI or the search service.
// The student's own copy of the question is saved unchanged; only what leaves Lawdeck is cleaned.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Phone numbers start with + (international, e.g. +234) or 0 (Nigerian, e.g. 0803…), and may
// have spaces, dots or dashes between digit groups. Years and section numbers do not match.
const PHONE = /(?:\+\d{1,3}[\s.-]?|\b0)\(?\d{2,4}\)?(?:[\s.-]?\d{3,4}){2}\b/g;

export function redactPersonalData(text: string): string {
  return text.replace(EMAIL, "[email removed]").replace(PHONE, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 10 ? "[phone number removed]" : match;
  });
}
