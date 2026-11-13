# Privacy Notice and Terms of Service (founder, 2026-11-13)

- Public pages, open to everyone: **/privacy** (Privacy Notice) and **/terms** (Terms of Service,
  also called Terms of Use; **/terms-of-use** redirects to it). Linked from sign-in (with Request removal), sign-up ("By creating an
  account you agree…") and each other's footer. Google's OAuth consent screen and app stores use
  https://mylawdeck.com/privacy and https://mylawdeck.com/terms.
- The wording is data: `src/templates/policies/privacy.ts` and `terms.ts` (sections of paragraphs and
  lists), shown by `src/components/legal/PolicyPage.tsx`. Only fixed words become links (the contact
  email, /takedown, ndpc.gov.ng, the other policy).
- Written from how Lawdeck works (NDPA 2023): providers and regions, what reaches the AI (no names,
  emails, phones; the voice greeting by first name goes to Azure only), deletion is immediate, chat ID
  documents deleted after the decision, downloads log 30 days, encrypted backups 30 days, breach notice
  to the NDPC within 72 hours, Google Limited Use statement.
- **Keep them true:** a change to what is collected, who receives it, plans, prices or payments updates
  the text and its `updated` date in the same pull request.
- Contact for both: `privacy@mylawdeck.com` (`POLICY_CONTACT_EMAIL`); the founder sets up that mailbox.
- Business choices made in the Terms (founder may change): minimum age 18 or parental consent;
  monthly subscriptions, cancel any time; no refunds once a month has started except where the law
  requires or Lawdeck was at fault (14 days to ask); 14 days' notice of price or terms changes;
  liability capped at the amount paid in 12 months or ₦10,000; Nigerian law, Lagos courts.
- Recommended before paid plans start: review by a Nigerian lawyer, and add the company's registered
  name once Lawdeck is incorporated.
- Tests: `tests/e2e/workspace.spec.ts` (both pages open from sign-in, mailto link, no sideways
  scroll), `tests/e2e/security.spec.ts` (headers and content security policy on both).
