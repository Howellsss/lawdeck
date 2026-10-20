import type { Metadata } from "next";
import { StateMessage } from "@/components/ui/StateMessage";

export const metadata: Metadata = { title: "Projects · Lawdeck" };

export default function ProjectsPage() {
  return (
    <StateMessage title="No projects yet" action={{ label: "Back to home", href: "/" }}>
      Projects keep your chats, documents and notes together. They arrive once you can sign in.
    </StateMessage>
  );
}
