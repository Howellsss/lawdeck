import { expect, test } from "@playwright/test";

// My progress layout (docs/specs/remembrance.md, Phase 4b) on the test-only page: made-up answers.
for (const width of [360, 1200]) {
  test(`My progress shows mastery, weakest topics, weeks and study days without sideways scrolling (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/progress");
    await expect(page.getByText("Points mastered", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /^All points: \d+ mastered, \d+ learning, \d+ slipping$/ })).toBeVisible();

    const weakest = page.getByRole("region", { name: "Worth revising first" });
    // The topic with the largest share slipping comes first, with its due questions to revise.
    await expect(weakest.getByRole("listitem").first()).toContainText("Quokka bail applications");
    await expect(weakest.getByRole("link", { name: "Revise now (1)" }).first()).toHaveAttribute("href", "/revise?topic=00000000-0000-4000-8000-000000000602");

    await expect(page.getByRole("table", { name: "Recall accuracy by week" }).locator("tbody tr")).toHaveCount(8);
    await expect(page.getByRole("list", { name: "Days studied" }).getByRole("listitem")).toHaveCount(35);

    const civil = page.locator("details", { hasText: "Civil Litigation" });
    await civil.locator("summary").click();
    await expect(civil.getByRole("link", { name: "Numbat appeals" })).toBeVisible();
    await expect(page.getByText(/not a prediction of exam results/)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
