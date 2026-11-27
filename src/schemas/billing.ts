import { z } from "@/lib/zod";

// Plans and payments (launch task 15, migration 68).

const wholeNumber = (what: string, max: number) =>
  z
    .string({ error: `Enter the ${what}.` })
    .trim()
    .transform((value) => Number(value.replace(/[,₦\s]/g, "")))
    .pipe(
      z
        .number({ error: `Enter the ${what} as a number.` })
        .int({ error: `Enter the ${what} as a whole number.` })
        .min(0, { error: "It can't be below 0." })
        .max(max, { error: `At most ${max.toLocaleString("en-GB")}.` }),
    );

// Admin → Plans: a plan's monthly price in naira and its monthly credits.
export const planEditSchema = z.object({
  planId: z.uuid({ error: "That plan could not be found." }),
  price: wholeNumber("monthly price in naira", 1_000_000),
  credits: wholeNumber("number of credits", 100_000),
});

// Admin → Plans: credits every few hours and a week (migration 74). Empty means no such limit.
const optionalLimit = (what: string, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value.replace(/[,\s]/g, ""))))
    .pipe(
      z
        .number({ error: `Enter the ${what} as a number, or leave it empty.` })
        .int({ error: `Enter the ${what} as a whole number.` })
        .min(1, { error: "At least 1, or leave it empty for no limit." })
        .max(max, { error: `At most ${max.toLocaleString("en-GB")}.` })
        .nullable(),
    );

export const planLimitsSchema = z.object({
  planId: z.uuid({ error: "That plan could not be found." }),
  windowCredits: optionalLimit("credits every 3 hours", 10_000),
  weeklyCredits: optionalLimit("credits a week", 100_000),
});
