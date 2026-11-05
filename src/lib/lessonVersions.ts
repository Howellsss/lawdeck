// Lesson versions (migration 48): per topic, at most one approved version (what students read)
// and at most one being worked on. Replaced versions are kept only for the Study Diary.
export type VersionRow = { status: string; replaced_by: string | null };

// The version a reviewer works on: the one being worked on if there is one, else the approved one.
export function currentVersion<T extends VersionRow>(rows: T[]): T | null {
  const live = rows.filter((r) => r.replaced_by === null);
  return live.find((r) => r.status !== "approved") ?? live.find((r) => r.status === "approved") ?? null;
}

// The approved version students are reading while a newer one awaits review, if any.
export function approvedBehind<T extends VersionRow>(rows: T[]): T | null {
  const live = rows.filter((r) => r.replaced_by === null);
  const working = live.find((r) => r.status !== "approved");
  return working ? (live.find((r) => r.status === "approved") ?? null) : null;
}
