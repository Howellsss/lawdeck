import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/PolicyPage";
import { PRIVACY_NOTICE } from "@/templates/policies/privacy";

export const metadata: Metadata = {
  title: "Privacy Notice · Lawdeck",
  description: "What personal data Lawdeck collects, why, who it is shared with, how long it is kept, and your rights.",
};

export default function PrivacyPage() {
  return <PolicyPage policy={PRIVACY_NOTICE} />;
}
