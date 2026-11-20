import "server-only";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Plans and credit costs (migration 68), read with the person's own access.

export type PlanRow = { id: string; name: string; priceNgn: number; credits: number | null; onSale: boolean };
export type CreditCost = { kind: string; credits: number };

export type PlansAdmin = { plans: PlanRow[]; costs: CreditCost[] };

// Admin → Plans. Null for anyone who is not an admin (the page then says "not found").
export async function getPlansAdmin(): Promise<PlansAdmin | null> {
  if ((await getStaffRole()) !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  const [plans, costs] = await Promise.all([
    supabase.from("plans").select("id, name, price_ngn, monthly_message_limit, on_sale, position").order("position"),
    supabase.from("credit_costs").select("kind, credits").order("credits"),
  ]);
  // Before migration 68 the new columns and table are missing: the page asks for the update.
  const missing = (code?: string) => code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205";
  if (missing(plans.error?.code) || missing(costs.error?.code)) return { plans: [], costs: [] };
  if (plans.error || costs.error) {
    console.error("plans read failed", { code: plans.error?.code ?? costs.error?.code });
    throw new Error("The plans could not be loaded.");
  }
  return {
    plans: plans.data.map((p) => ({
      id: p.id,
      name: p.name,
      priceNgn: p.price_ngn ?? 0,
      credits: p.monthly_message_limit,
      onSale: p.on_sale,
    })),
    costs: costs.data,
  };
}
