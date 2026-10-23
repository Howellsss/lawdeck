import deedOfAssignment from "./documents/deed-of-assignment.json";
import motionOnNoticeWithAffidavit from "./documents/motion-on-notice-with-affidavit.json";
import statementOfClaim from "./documents/statement-of-claim.json";
import tenancyAgreement from "./documents/tenancy-agreement.json";
import writOfSummons from "./documents/writ-of-summons.json";
import federalHighCourt from "./forums/federal-high-court.json";
import fctHighCourt from "./forums/fct-high-court.json";
import lagosHighCourt from "./forums/lagos-high-court.json";
import lagosLandsRegistry from "./forums/lagos-lands-registry.json";

// The drafting data files (rule H-03). Reviewers load them on /admin/templates, where each is
// checked against src/schemas/drafting.ts and stays a draft until a reviewer approves it.
// Add a new file here when you add it to forums/ or documents/.
export const FORUM_FILES: unknown[] = [
  lagosHighCourt,
  fctHighCourt,
  federalHighCourt,
  lagosLandsRegistry,
];

// Document templates (step 5g), drafted from the prescribed forms and drafts in the knowledge base.
// They load as drafts; students see one only after the legal reviewer approves it.
export const TEMPLATE_FILES: unknown[] = [
  writOfSummons,
  statementOfClaim,
  motionOnNoticeWithAffidavit,
  deedOfAssignment,
  tenancyAgreement,
];
