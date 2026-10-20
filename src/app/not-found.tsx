import { StateMessage } from "@/components/ui/StateMessage";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <StateMessage title="Page not found" action={{ label: "Go to the Lawdeck home page", href: "/" }}>
        The page you asked for doesn’t exist or has moved.
      </StateMessage>
    </main>
  );
}
