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
