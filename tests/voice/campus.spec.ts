import { expect, test } from "@playwright/test";

// Campus choice (PRD v2.1 CH-01) on the test-only page: the compact form asks for a campus, offers
// "Law School aspirant", and the Account form starts on the saved campus.
for (const width of [360, 1200]) {
  test(`students choose a campus or Law School aspirant (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/campus");
    const prompt = page.getByRole("region", { name: "Your campus" });
    const ask = prompt.getByLabel("Which Law School campus are you on?");
    await expect(ask).toHaveValue("");
    await expect(ask.locator("option", { hasText: "Law School aspirant" })).toHaveCount(1);
    await ask.selectOption("aspirant");
    await expect(ask).toHaveValue("aspirant");
    await expect(prompt.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Account" }).getByLabel("Your campus")).toHaveValue("lagos");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
