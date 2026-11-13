import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/PolicyPage";
import { TERMS_OF_SERVICE } from "@/templates/policies/terms";

export const metadata: Metadata = {
  title: "Terms of Service · Lawdeck",
  description: "The terms for using Lawdeck: what it is, your account, plans and payment, proper use, campus chat, content and liability.",
};

export default function TermsPage() {
  return <PolicyPage policy={TERMS_OF_SERVICE} />;
}
