import { expect, test } from "@playwright/test";

// Topic Lessons (docs/specs/remembrance.md) on the test-only lesson page: made-up names.
for (const width of [360, 1200]) {
  test(`a lesson shows its highlights calmly and switches between Full, Quiet and Off (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/lesson");
    await expect(page.getByRole("list", { name: "Highlight key" })).toBeVisible();
    const frame = page.locator("[data-highlights]");
    await expect(frame).toHaveAttribute("data-highlights", "full");
    await page.getByText("Quiet", { exact: true }).click();
    await expect(frame).toHaveAttribute("data-highlights", "quiet");
    await page.getByText("Off", { exact: true }).click();
    await expect(frame).toHaveAttribute("data-highlights", "off");
    // The choice is remembered on this device.
    await page.reload();
    await expect(page.locator("[data-highlights]")).toHaveAttribute("data-highlights", "off");
    // Each mark names its kind for screen readers; never more than four in a paragraph.
    await expect(page.locator(".mark")).toHaveCount(6);
    await expect(page.locator("p").first().locator(".mark")).toHaveCount(4);
    // The answer is not on the page before the student tries.
    await expect(page.getByText("Answer:", { exact: false })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
