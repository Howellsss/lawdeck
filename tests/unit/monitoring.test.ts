import { describe, expect, it } from "vitest";
import { overLimits } from "@/lib/unusualActivity";
import { scrubMessage, scrubPath, scrubType } from "@/server/monitoring/scrub";
import { buildEnvelope, parseDsn } from "@/server/monitoring/sentry";

// Monitoring (step 7e): error reports never carry personal data or secrets (rule I-03), and the
// hourly check reports counts over their limits only.

describe("error reports are scrubbed", () => {
  it("blanks emails, ids, keys, phone numbers and quoted text", () => {
    const text = scrubMessage(
      'Failed for ada.obi@example.com on 3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a with sk-ant-api03-AbCdEf1234567890xyz, call +234 803 123 4567: "the defendant Quokka Ltd owes N2,350,000"',
    );
    expect(text).not.toMatch(/ada\.obi|example\.com|3f2b6d1e|sk-ant|803|Quokka|2,350/);
    expect(text).toContain("[email]");
    expect(text).toContain("[id]");
    expect(text).toContain("[secret]");
    expect(text).toContain("[number]");
    expect(text).toContain("[text]");
  });

  it("keeps messages short", () => {
    expect(scrubMessage("x ".repeat(500)).length).toBeLessThanOrEqual(200);
  });

  it("takes ids and share codes out of page addresses", () => {
    expect(scrubPath("/documents/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a?tab=facts")).toBe("/documents/:id");
    expect(scrubPath("/shared/Zk3v9QpL2mN8xR4tW6yB1c/documents/x")).toBe("/shared/:id/documents/x");
  });

  it("keeps only plain error type names", () => {
    expect(scrubType("TypeError")).toBe("TypeError");
    expect(scrubType("<script>")).toBe("Error");
    expect(scrubType(undefined)).toBe("Error");
  });
});

describe("Sentry", () => {
  const dsn = "https://abc123publickey@o123.ingest.de.sentry.io/4507";

  it("reads the DSN, and refuses anything else", () => {
    expect(parseDsn(dsn)).toEqual({ endpoint: "https://o123.ingest.de.sentry.io/api/4507/envelope/", publicKey: "abc123publickey" });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("http://key@host/1")).toBeNull();
    expect(parseDsn("not a dsn")).toBeNull();
  });

  it("sends only the scrubbed type, message and page", () => {
    const envelope = buildEnvelope(
      { type: "Error", message: "Upload by ada@example.com failed", path: "/documents/3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a", source: "server", where: "route" },
      dsn,
      new Date("2026-10-23T12:00:00Z"),
    );
    const [header, item, event] = envelope.split("\n").map((line) => JSON.parse(line));
    expect(header.dsn).toBe(dsn);
    expect(item.type).toBe("event");
    expect(event.exception.values[0]).toEqual({ type: "Error", value: "Upload by [email] failed" });
    expect(event.transaction).toBe("/documents/:id");
    expect(envelope).not.toContain("ada@example.com");
    // Nothing beyond these fields (the release is added on Vercel).
    const allowed = ["environment", "event_id", "exception", "level", "platform", "release", "tags", "timestamp", "transaction"];
    expect(Object.keys(event).filter((key) => !allowed.includes(key))).toEqual([]);
  });
});

describe("the hourly unusual-access check", () => {
  it("reports only counts over their limits, in plain words", () => {
    expect(
      overLimits([
        { metric: "failed_sign_ins", value: 51 },
        { metric: "most_downloads_by_one_account", value: 30 },
        { metric: "sign_ups", value: 3 },
      ]),
    ).toEqual(["51 failed sign-ins in total in the last hour (limit 50)"]);
    expect(overLimits([])).toEqual([]);
  });
});
