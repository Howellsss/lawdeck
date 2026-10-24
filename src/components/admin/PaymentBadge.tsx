import { PAYMENT_LABELS, type PaymentStatus } from "@/lib/adminUsers";

// Colour only for meaning: green when paid, amber when a payment failed; plain otherwise.
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid" ? "border-success text-success" : status === "past_due" ? "border-warning text-warning" : "border-line text-muted";
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>{PAYMENT_LABELS[status]}</span>;
}
