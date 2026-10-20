import type { Metadata } from "next";
import { StateMessage } from "@/components/ui/StateMessage";

export const metadata: Metadata = { title: "Drafting catalogue · Lawdeck" };

export default function DraftingPage() {
  return (
    <StateMessage title="Drafting catalogue" action={{ label: "Back to home", href: "/" }}>
      Writs, deeds, motions and more, laid out as Nigerian courts and registries expect. The catalogue arrives in Phase 5,
      once each template has been reviewed.
    </StateMessage>
  );
}
