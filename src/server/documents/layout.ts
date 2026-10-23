// Layout numbers shared by the on-screen pages and the Word file, so both lay a document out
// the same way (rule H-04).
export const PAPER_MM = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
} as const;

export const LAYOUT = {
  // Space after each paragraph, and before each part heading, in points.
  paragraphAfterPt: 6,
  headingBeforePt: 12,
} as const;
