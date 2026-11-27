import { NextResponse } from "next/server";
import { confirmPayment, noticeIsGenuine, noticeSchema, txRefSchema } from "@/server/billing/flutterwave";

// Flutterwave's payment notices (Settings → Webhooks). A notice is only a hint: it must carry the
// secret phrase, and the payment is then checked with Flutterwave itself before anything is
// recorded (confirmPayment). Only Lawdeck's own references are handled.
export async function POST(request: Request) {
  if (!noticeIsGenuine(request.headers.get("verif-hash"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const body = noticeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !txRefSchema.safeParse(body.data.data.tx_ref).success) {
    // Not a Lawdeck payment: acknowledged, so Flutterwave does not keep sending it.
    return NextResponse.json({ ok: true });
  }
  const result = await confirmPayment(body.data.data.tx_ref, String(body.data.data.id));
  // An error asks Flutterwave to send the notice again later.
  if (result.status === "error") return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
