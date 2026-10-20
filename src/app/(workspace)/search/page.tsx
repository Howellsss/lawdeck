import type { Metadata } from "next";
import { StateMessage } from "@/components/ui/StateMessage";

export const metadata: Metadata = { title: "Search · Lawdeck" };

export default function SearchPage() {
  return (
    <StateMessage title="Search your work" action={{ label: "Back to home", href: "/" }}>
      Search across your chats, documents and uploads arrives once you can sign in.
    </StateMessage>
  );
}
