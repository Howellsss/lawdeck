import { getGreetingName } from "@/server/db/profile";
import { Greeting } from "./Greeting";

// The greeting with the signed-in person's first name, read on the server.
export async function NamedGreeting() {
  const name = await getGreetingName();
  return <Greeting name={name ?? undefined} />;
}
