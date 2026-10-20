import type { Metadata } from "next";
import { StateMessage } from "@/components/ui/StateMessage";

export const metadata: Metadata = { title: "Documents · Lawdeck" };

export default function DocumentsPage() {
  return (
    <StateMessage title="No documents yet" action={{ label: "Back to home", href: "/" }}>
      Documents you draft will be listed here. Drafting in Nigerian formats arrives in Phase 5.
    </StateMessage>
  );
}
