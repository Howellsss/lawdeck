// The five Bar Part II courses. Curriculum structure only, not legal content (rule H-01).
// Moves into the courses table in step 1c.
export const COURSES = [
  { slug: "civil-litigation", name: "Civil Litigation" },
  { slug: "criminal-litigation", name: "Criminal Litigation" },
  { slug: "property-law-practice", name: "Property Law Practice" },
  { slug: "corporate-law-practice", name: "Corporate Law Practice" },
  { slug: "law-in-practice", name: "Law in Practice" },
] as const;

export type CourseSlug = (typeof COURSES)[number]["slug"];
