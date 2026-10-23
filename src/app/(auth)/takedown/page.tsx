import type { Metadata } from "next";
import { AuthHero } from "@/components/auth/AuthHero";
import { TakedownForm } from "@/components/feedback/TakedownForm";
import { TAKEDOWN_DAYS } from "@/schemas/feedback";

export const metadata: Metadata = { title: "Request removal · Lawdeck" };

// The takedown route (PRD FB-03): anyone, signed in or not, can ask for material to be removed.
export default function TakedownPage() {
  return (
    <>
      <AuthHero title="Request removal">
        If something on Lawdeck is yours or about you and should not be here, tell us. The team acts within {TAKEDOWN_DAYS} days.
      </AuthHero>
      <TakedownForm />
    </>
  );
}
