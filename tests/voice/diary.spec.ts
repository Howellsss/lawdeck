import { expect, test } from "@playwright/test";

// Study Diary layout (docs/specs/remembrance.md) on the test-only diary page: made-up entries.
for (const width of [360, 1200]) {
  test(`the Study Diary shows figures, filters and the timeline without sideways scrolling (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/diary");
    await expect(page.getByText("Recall accuracy", { exact: true })).toBeVisible();
    await expect(page.getByText("71%")).toBeVisible();
    await expect(page.getByRole("form", { name: "Filter the diary" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Study timeline" }).getByRole("link")).toHaveCount(3);
    await expect(page.getByText("Due for revision now", { exact: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
