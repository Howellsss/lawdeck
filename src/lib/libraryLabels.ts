// Plain names for library item types and review states, shared by screens and schemas.
export const KB_ITEM_TYPES = {
  course_material: "Course material",
  note: "Note",
  draft: "Draft",
  textbook: "Textbook",
  statute: "Statute",
  rule_of_court: "Rule of court",
  case: "Case",
} as const;

export type KbItemTypeKey = keyof typeof KB_ITEM_TYPES;

export const REVIEW_STATUS_LABELS = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

// How a library item is presented to students (migration 37).
export const SOURCE_KIND_LABELS = {
  official: "Official legal document (title shown)",
  publication: "Named publication or handbook (title shown)",
  lecturer_note: "Lecturer's notes or private material (course and topic shown)",
  unattributed: "No clear author or title (course and topic shown)",
  pending: "Not yet identified (course and topic shown)",
} as const;

export type SourceKindKey = keyof typeof SOURCE_KIND_LABELS;

export const SOURCE_RIGHTS_LABELS = {
  unknown: "Permission not yet confirmed",
  permitted: "Lawdeck may use it",
  restricted: "Restricted: withdrawn from students",
} as const;

export type SourceRightsKey = keyof typeof SOURCE_RIGHTS_LABELS;
