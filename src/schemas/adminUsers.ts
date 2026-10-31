import { z } from "@/lib/zod";

// The admin Users dashboard (migration 34). The filters come from the page address, so anything
// unexpected falls back to "no filter" instead of an error.

export const PAYMENT_FILTERS = ["paid", "unpaid", "past_due"] as const;
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number];

export const USERS_PAGE_SIZE = 50;

// How the people list is ordered (migration 42).
export const USER_SORTS = ["newest", "cost", "questions", "active"] as const;
export type UserSort = (typeof USER_SORTS)[number];

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const optionalText = (max: number) =>
  z.preprocess(
    firstValue,
    z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .transform((value) => (value === "" || value.length > max ? null : value))
      .nullable()
      .catch(null),
  );

export const userFilterSchema = z.object({
  q: optionalText(100),
  plan: optionalText(60),
  payment: z.preprocess(firstValue, z.enum(PAYMENT_FILTERS).nullable().catch(null)),
  sort: z.preprocess(firstValue, z.enum(USER_SORTS).catch("newest")),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(10_000).catch(1)),
});
export type UserFilter = z.infer<typeof userFilterSchema>;

export const userIdSchema = z.uuid();
