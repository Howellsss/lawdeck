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

// Document templates arrive in step 5g, drafted from the library's prescribed forms and approved
// by the legal reviewer.
export const TEMPLATE_FILES: unknown[] = [];
