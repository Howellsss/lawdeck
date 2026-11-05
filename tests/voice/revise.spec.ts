import { expect, test } from "@playwright/test";

// "Before you move on" memory challenge layout (docs/specs/remembrance.md, Phase 1d), made-up questions.
for (const width of [360, 1200]) {
  test(`the memory challenge shows one question at a time and can always be left (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/revise");
    await expect(page.getByText("Question 1 of 2 · from Wombat summons")).toBeVisible();
    await expect(page.getByText("Which made-up case settled when a wombat summons is used?")).toBeVisible();
    await expect(page.getByText("In one line, when will the court refuse")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Stop here and carry on studying" }).click();
    await expect(page.getByRole("heading", { name: "Revision done" })).toBeVisible();
    await expect(page.getByText("These questions will wait for you.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to today’s study" })).toBeVisible();
  });
}
