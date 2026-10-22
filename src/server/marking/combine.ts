import type { MarkingFeedback, MarkingReply } from "@/schemas/marking";

// Puts Claude's marks against the guide's own points, in the guide's order. Marks are whole
// numbers from 0 to each point's maximum, whatever Claude returned; a point Claude skipped scores 0.
export function combineMarks(
  criteria: { point: string; marks: number }[],
  reply: MarkingReply,
): Pick<MarkingFeedback, "points" | "total" | "max"> {
  const points = criteria.map((criterion, index) => {
    const marked = reply.points.find((p) => p.number === index + 1);
    const awarded = Math.max(0, Math.min(criterion.marks, Math.round(marked?.awarded ?? 0)));
    return {
      point: criterion.point,
      max: criterion.marks,
      awarded,
      good: marked?.good ?? "",
      missing: marked ? marked.missing : "Not addressed.",
    };
  });
  return {
    points,
    total: points.reduce((sum, p) => sum + p.awarded, 0),
    max: points.reduce((sum, p) => sum + p.max, 0),
  };
}

// The score saved with the attempt: a percentage, two decimal places.
export function percentScore(total: number, max: number): number {
  return max > 0 ? Math.round((total / max) * 10_000) / 100 : 0;
}
