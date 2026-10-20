import type { Metadata } from "next";
import { HealthCheckForm } from "./HealthCheckForm";

export const metadata: Metadata = {
  title: "Connection check · Lawdeck",
  robots: { index: false },
};

// Phase 0 test page: proves the server can reach Claude. Protected by a private test code.
export default function HealthPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="font-serif text-3xl font-normal">Connection check</h1>
      <p className="max-w-md text-muted">
        Sends Claude a one-line test message. It costs a fraction of a cent.
      </p>
      <HealthCheckForm />
    </main>
  );
}
