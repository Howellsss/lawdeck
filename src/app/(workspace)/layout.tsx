import { Suspense } from "react";
import { AccountButtonPlaceholder } from "@/components/shell/AccountButton";
import { AccountSlot } from "@/components/shell/AccountSlot";
import { AppShell } from "@/components/shell/AppShell";
import { RecentsPlaceholder } from "@/components/shell/RecentsList";
import { RecentsSlot } from "@/components/shell/RecentsSlot";
import { ChatNavSlot } from "@/components/shell/ChatNavSlot";
import { StaffNavSlot } from "@/components/shell/StaffNavSlot";
import { TermsGateSlot } from "@/components/account/TermsGateSlot";

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
      chatNav={
        <Suspense fallback={null}>
          <ChatNavSlot />
        </Suspense>
      }
      recents={
        <Suspense fallback={<RecentsPlaceholder />}>
          <RecentsSlot />
        </Suspense>
      }
    >
      {children}
      <Suspense fallback={null}>
        <TermsGateSlot />
      </Suspense>
    </AppShell>
  );
}
