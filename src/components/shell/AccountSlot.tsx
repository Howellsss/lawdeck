import { getCurrentAccount } from "@/server/auth/session";
import { AccountButton } from "./AccountButton";

// Server part of the account button: checks the sign-in on the server, then hands
// only the email and id to the screen.
export async function AccountSlot() {
  const account = await getCurrentAccount();
  return <AccountButton account={account} />;
}
