import { z } from "@/lib/zod";

// Deleting an account (Phase 6, step 6f; PRD AC-05): the student types DELETE to confirm.
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { error: "Type DELETE in capitals to confirm." }),
});
