import { describe, expect, it } from "vitest";
import { trialBannerText, trialStatus } from "@/lib/trial";

const now = new Date("2026-11-28T10:00:00Z");
const trial = (over: object = {}) => ({ used: 12, limit: 30, unlimited: false, trial: true, periodEndsAt: "2026-12-03T09:00:00Z", ...over });

describe("the 7-day free trial as the student sees it", () => {
  it("shows the days and credits left", () => {
    const t = trialStatus(trial(), now);
    expect(t).toMatchObject({ state: "active", daysLeft: 5, creditsLeft: 18, credits: 30 });
    expect(trialBannerText(t!)).toBe("Free trial: 5 days left (ends Thu 3 Dec) · 18 of 30 trial credits left · no card needed.");
  });

  it("warns in the last 2 days", () => {
    const t = trialStatus(trial({ periodEndsAt: "2026-11-29T08:00:00Z" }), now);
    expect(t).toMatchObject({ state: "ending", daysLeft: 1 });
    expect(trialBannerText(t!)).toMatch(/ends within a day .* Choose a plan/);
  });

  it("asks for a plan when the trial credits are used up or the 7 days are over", () => {
    expect(trialStatus(trial({ used: 30 }), now)).toMatchObject({ state: "used" });
    expect(trialStatus(trial({ limit: 0 }), now)).toEqual({ state: "ended" });
    expect(trialStatus(trial({ periodEndsAt: "2026-11-27T09:00:00Z" }), now)).toEqual({ state: "ended" });
    expect(trialBannerText({ state: "ended" })).toMatch(/has ended\. Choose a plan.*progress are kept/);
  });

  it("shows nothing to paying students and staff", () => {
    expect(trialStatus(trial({ trial: false }), now)).toBeNull();
    expect(trialStatus(trial({ unlimited: true }), now)).toBeNull();
    expect(trialStatus(null, now)).toBeNull();
  });
});
