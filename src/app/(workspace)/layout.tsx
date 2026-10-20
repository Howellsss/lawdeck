import { Suspense } from "react";
import { AccountButtonPlaceholder } from "@/components/shell/AccountButton";
import { AccountSlot } from "@/components/shell/AccountSlot";
import { AppShell } from "@/components/shell/AppShell";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      account={
        // The sign-in check reads cookies, so it streams in without holding up the page.
        <Suspense fallback={<AccountButtonPlaceholder />}>
          <AccountSlot />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
