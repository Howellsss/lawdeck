import { z } from "@/lib/zod";

// The period on the admin usage page: 7, 30 or 90 days. It comes from the page address, so
// anything unexpected falls back to 30 days instead of an error.
export const USAGE_PERIODS = [7, 30, 90] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

export const usagePeriodSchema = z.object({
  days: z.preprocess(
    (value) => Number(firstValue(value)),
    z.number().refine((n): n is UsagePeriod => (USAGE_PERIODS as readonly number[]).includes(n)),
  ).catch(30),
});
