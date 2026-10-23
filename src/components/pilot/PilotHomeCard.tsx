import { getPilotStatus } from "@/server/db/pilot";
import { PriceQuestion } from "./PriceQuestion";

// On the home page during the closed pilot: the price question, once, for students with access.
// (Students without access already see the closed-pilot note under the question box.)
export async function PilotHomeCard() {
  const status = await getPilotStatus().catch(() => null);
  if (!status?.priceQuestion) return null;
  return <PriceQuestion priceNgn={status.priceQuestion.priceNgn} />;
}
