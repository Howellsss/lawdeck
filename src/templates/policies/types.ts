// Lawdeck's own policies (Privacy Notice, Terms of Service), kept as data so the wording can be
// changed without touching the page code. These are Lawdeck's terms, not legal study content.
export type PolicyBlock = string | { list: string[] };

export type PolicySection = { id: string; heading: string; blocks: PolicyBlock[] };

export type Policy = {
  title: string;
  // ISO date the text last changed, shown as "Last updated".
  updated: string;
  intro: string[];
  sections: PolicySection[];
};

// One inbox for privacy requests and questions about these terms (founder to set it up).
export const POLICY_CONTACT_EMAIL = "privacy@mylawdeck.com";
