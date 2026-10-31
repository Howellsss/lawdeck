import { getCurrentAccount } from "@/server/auth/session";
import { getFullName } from "@/server/db/profile";
import { AccountButton } from "./AccountButton";

// Server part of the account button: checks the sign-in on the server, then hands
// only the email, id and name to the screen.
export async function AccountSlot() {
  const account = await getCurrentAccount();
  const name = account ? await getFullName() : null;
  return <AccountButton account={account} name={name} />;
}
