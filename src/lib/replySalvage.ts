// Keeping a paid AI reply when only part of it is off (lessons and memory aids). Claude's reply is
// still checked against the full schema afterwards; this only tidies what can be tidied safely and
// drops the pieces that cannot, instead of throwing away the whole lesson because, say, one
// authority's id has a capital letter or one paragraph lists too many passages.
import type { z } from "@/lib/zod";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// "Ibrahim v. State" -> "ibrahim-v-state": the form authority ids must take.
export function slugKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Passage ids: whole numbers in range, no repeats, at most `max`.
export function tidySources(value: unknown, max = 20, top = 99): number[] {
  const ids = list(value).filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= top);
  return [...new Set(ids)].slice(0, max);
}

// Items that pass their own schema, up to `max`; the rest are dropped.
export function keepValid<T extends z.ZodType>(items: unknown, schema: T, max: number): unknown[] {
  return list(items)
    .filter((item) => schema.safeParse(item).success)
    .slice(0, max);
}

const clampInt = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v as number)) : v);

export function tidyLessonJson(raw: unknown, parts: { mark: z.ZodType; paragraph: z.ZodType; section: z.ZodType; authority: z.ZodType; checkpoint: z.ZodType }): unknown {
  if (!isObj(raw)) return raw;
  const sections = list(raw.sections).map((section) => {
    if (!isObj(section)) return section;
    const paragraphs = list(section.paragraphs).map((p) => {
      if (!isObj(p)) return p;
      const marks = list(p.marks).map((m) => (isObj(m) && m.authority ? { ...m, authority: slugKey(m.authority) } : m));
      return { ...p, sources: tidySources(p.sources), marks: keepValid(marks, parts.mark, 12) };
    });
    return { ...section, paragraphs: keepValid(paragraphs, parts.paragraph, 12) };
  });
  const authorities = list(raw.authorities).map((a) => (isObj(a) ? { ...a, key: slugKey(a.key), sources: tidySources(a.sources) } : a));
  const checkpoints = list(raw.checkpoints).map((c) =>
    isObj(c) ? { ...c, after_section: clampInt(c.after_section, 0, 13), sources: tidySources(c.sources) } : c,
  );
  return {
    ...raw,
    title: typeof raw.title === "string" ? raw.title.slice(0, 200) : raw.title,
    sections: keepValid(sections, parts.section, 14),
    authorities: keepValid(authorities, parts.authority, 40),
    checkpoints: keepValid(checkpoints, parts.checkpoint, 60),
  };
}

export function tidyExtrasJson(raw: unknown, parts: { aid: z.ZodType; story: z.ZodType }): unknown {
  if (!isObj(raw)) return raw;
  const fix = (item: unknown) => (isObj(item) ? { ...item, after_section: clampInt(item.after_section, 0, 199), sources: tidySources(item.sources, 40, 500) } : item);
  const stories = list(raw.stories).map((s) => (isObj(s) && s.authority ? fix({ ...s, authority: slugKey(s.authority) }) : fix(s)));
  return { ...raw, memory_aids: keepValid(list(raw.memory_aids).map(fix), parts.aid, 12), stories: keepValid(stories, parts.story, 8) };
}
