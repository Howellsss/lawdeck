import { termsToAccept } from "@/server/account/terms";
import { TermsGate } from "./TermsGate";

// Server part of "Before you continue": checks on the server whether the signed-in person has
// accepted the current version, and shows the box only if not.
export async function TermsGateSlot() {
  const links = await termsToAccept();
  return links ? <TermsGate terms={links.terms} privacy={links.privacy} /> : null;
}
