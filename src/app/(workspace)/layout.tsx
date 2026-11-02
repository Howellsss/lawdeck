import { Suspense } from "react";
import { AccountButtonPlaceholder } from "@/components/shell/AccountButton";
import { AccountSlot } from "@/components/shell/AccountSlot";
import { AppShell } from "@/components/shell/AppShell";
import { RecentsPlaceholder } from "@/components/shell/RecentsList";
import { RecentsSlot } from "@/components/shell/RecentsSlot";
import { StaffNavSlot } from "@/components/shell/StaffNavSlot";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      // Both read the sign-in cookie, so they stream in without holding up the page.
      account={
        <Suspense fallback={<AccountButtonPlaceholder />}>
          <AccountSlot />
        </Suspense>
      }
      staffNav={
        <Suspense fallback={null}>
          <StaffNavSlot />
        </Suspense>
      }
      recents={
        <Suspense fallback={<RecentsPlaceholder />}>
          <RecentsSlot />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
