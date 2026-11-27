import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/server/db/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const {
  confirmPayment,
  createCheckoutLink,
  judgePayment,
  noticeIsGenuine,
  verifyTransaction,
} = await import("@/server/billing/flutterwave");

const REF = "ldk_0123456789abcdef0123456789abcdef";
const verified = (over: object = {}) => ({ id: 4455, tx_ref: REF, status: "successful", amount: 4999, currency: "NGN", ...over });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubEnv("FLUTTERWAVE_SECRET_KEY", "FLWSECK_TEST-abc");
  vi.stubEnv("FLUTTERWAVE_WEBHOOK_HASH", "a long phrase only Flutterwave knows");
  rpc.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("what Flutterwave's answer means (launch task 15, part 2)", () => {
  it("counts only a successful naira payment with Lawdeck's own reference", () => {
    expect(judgePayment(verified(), REF)).toBe("paid");
    expect(judgePayment(verified({ currency: "USD" }), REF)).toBe("mismatch");
    expect(judgePayment(verified({ tx_ref: "ldk_ffffffffffffffffffffffffffffffff" }), REF)).toBe("mismatch");
    expect(judgePayment(verified({ status: "failed" }), REF)).toBe("failed");
    expect(judgePayment(verified({ status: "pending" }), REF)).toBe("pending");
  });
});

describe("starting a payment", () => {
  it("asks Flutterwave for a checkout in naira with the secret key, and returns its page", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(json({ status: "success", data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/abc" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const link = await createCheckoutLink({ txRef: REF, amountNgn: 4999, email: "s@example.com", planName: "Standard", redirectUrl: "https://mylawdeck.com/plans/done" });
    expect(link).toBe("https://checkout.flutterwave.com/v3/hosted/pay/abc");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.flutterwave.com/v3/payments");
    expect(init.headers.Authorization).toBe("Bearer FLWSECK_TEST-abc");
    expect(JSON.parse(init.body)).toMatchObject({ tx_ref: REF, amount: 4999, currency: "NGN" });
  });

  it("never sends the student anywhere but Flutterwave", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "success", data: { link: "https://evil.example/pay" } })));
    expect(await createCheckoutLink({ txRef: REF, amountNgn: 1, email: "s@example.com", planName: "Pro", redirectUrl: "https://mylawdeck.com/plans/done" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "error", message: "bad key" }, 401)));
    expect(await createCheckoutLink({ txRef: REF, amountNgn: 1, email: "s@example.com", planName: "Pro", redirectUrl: "https://mylawdeck.com/plans/done" })).toBeNull();
  });
});

describe("confirming a payment", () => {
  it("records a payment only after Flutterwave confirms it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "success", data: verified() })));
    rpc.mockResolvedValue({ data: [{ plan_name: "Standard", period_end: "2026-12-27T10:00:00Z" }], error: null });
    expect(await confirmPayment(REF, "4455")).toEqual({ status: "paid", planName: "Standard", periodEnd: "2026-12-27T10:00:00Z" });
    expect(rpc).toHaveBeenCalledWith("record_payment", { ref: REF, provider_id: "4455", paid_amount: 4999, paid_currency: "NGN" });
  });

  it("records nothing for a failed, pending, foreign or unverifiable payment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "success", data: verified({ status: "failed" }) })));
    expect(await confirmPayment(REF, "4455")).toEqual({ status: "failed" });
    expect(rpc).toHaveBeenCalledWith("fail_payment", { ref: REF });
    rpc.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "success", data: verified({ status: "pending" }) })));
    expect(await confirmPayment(REF, "4455")).toEqual({ status: "pending" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "success", data: verified({ tx_ref: "someone-else" }) })));
    expect(await confirmPayment(REF, "4455")).toEqual({ status: "error" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ status: "error" }, 404)));
    expect(await confirmPayment(REF, "4455")).toEqual({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses odd references and transaction ids without asking anyone", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await confirmPayment("ldk_x", "4455")).toEqual({ status: "error" });
    expect(await confirmPayment(REF, "../../admin")).toEqual({ status: "error" });
    expect(await verifyTransaction("12; drop")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Flutterwave's payment notices", () => {
  it("accepts only notices carrying the secret phrase", () => {
    expect(noticeIsGenuine("a long phrase only Flutterwave knows")).toBe(true);
    expect(noticeIsGenuine("a guess")).toBe(false);
    expect(noticeIsGenuine(null)).toBe(false);
    vi.stubEnv("FLUTTERWAVE_WEBHOOK_HASH", "");
    expect(noticeIsGenuine("")).toBe(false);
  });
});
