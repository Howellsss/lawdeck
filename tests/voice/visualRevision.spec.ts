import { expect, test } from "@playwright/test";

// Visual Revision Mode (docs/specs/remembrance.md, Phase 3b), made-up text.
for (const width of [360, 1200]) {
  test(`visual revision lists each point in its sentence and filters by kind (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/visual");
    const points = page.getByRole("list", { name: "Points to revise" }).getByRole("listitem");
    await expect(points).toHaveCount(3);
    await expect(points.nth(1)).toContainText("The court will not decide disputed facts on affidavits alone.");
    await expect(points.nth(1)).toContainText("Your note: Made-up note");

    await page.getByRole("button", { name: "Show only my marks" }).click();
    await expect(points).toHaveCount(1);
    await page.getByRole("button", { name: "Show only cases" }).click();
    await expect(points).toHaveCount(1);
    await points.first().getByRole("button", { name: "Wombat v Quokka" }).click();
    await expect(page.getByRole("complementary", { name: "Case" })).toContainText("A made-up principle.");
    await expect(points.first().getByRole("link", { name: "Read it in the lesson" })).toHaveAttribute("href", /#lesson-section-0$/);

    await page.getByLabel("Cases (1)").uncheck();
    await expect(page.getByText("Nothing to show with these filters.")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
