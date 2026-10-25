import { z } from "@/lib/zod";
import data from "@/templates/sourceLabels.json";

// Template notes ("why each part is there") may name the private materials a template was written
// from. Students see a descriptive label instead (founder, 2026-10-25); reviewers still see the
// original wording on the admin pages. The mapping is data in src/templates/sourceLabels.json.
const sourceLabelsSchema = z.object({
  note: z.string(),
  labels: z.array(z.object({ original: z.string().min(3), label: z.string().min(3) })),
});

const { labels } = sourceLabelsSchema.parse(data);

export function studentSourceText(text: string): string {
  return labels.reduce((out, { original, label }) => out.split(original).join(label), text);
}
