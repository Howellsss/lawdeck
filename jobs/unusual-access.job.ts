// ADMIN JOB: the hourly unusual-access check (step 7e, rule P-03). Uses the service key to read
// last hour's counts (migration 31). If any count is over its limit the job fails, and GitHub
// emails the founder. Prints counts only, never who (the repository is public).
import { expect, it } from "vitest";
import { overLimits, UNUSUAL_LIMITS } from "@/lib/unusualActivity";
import { createAdminClient } from "@/server/db/admin";

it("finds no unusual access in the last hour", async () => {
  const db = createAdminClient();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  const { data, error } = await db.rpc("unusual_activity", { minutes: 60 });
  if (error) throw new Error(`The counts could not be read (${error.code})`);
  for (const row of data) console.info(`${row.metric}: ${row.value} (limit ${UNUSUAL_LIMITS[row.metric]?.limit ?? "none"})`);
  expect(data.length).toBe(Object.keys(UNUSUAL_LIMITS).length);
  expect(overLimits(data), "Unusual access: check Supabase logs (docs/breach-response-plan.md, step 2)").toEqual([]);
});
