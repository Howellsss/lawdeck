// The five Bar Part II courses. Curriculum structure only, not legal content (rule H-01).
// The database (courses table) is the source of truth; this copy only fills the
// course picker on the home screen until that picker reads the database (Phase 3).
export const COURSES = [
  { slug: "civil-litigation", name: "Civil Litigation" },
  { slug: "criminal-litigation", name: "Criminal Litigation" },
  { slug: "property-law-practice", name: "Property Law Practice" },
  { slug: "corporate-law-practice", name: "Corporate Law Practice" },
  { slug: "law-in-practice", name: "Law in Practice (Professional Ethics)" },
] as const;

export type CourseSlug = (typeof COURSES)[number]["slug"];
