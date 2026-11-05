import { expect, test } from "@playwright/test";

// Students' own marks in a lesson (docs/specs/remembrance.md, Phase 3a), made-up text.
for (const width of [360, 1200]) {
  test(`a student's marks show in their own look, notes open, and earlier ones are kept (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/lesson-marks");
    await expect(page.locator(".ann-underline")).toHaveText("court wil");
    await expect(page.locator(".ann-circle")).toHaveCount(1);
    await page.getByRole("button", { name: "Your note: Made-up note" }).click();
    const bar = page.getByRole("dialog", { name: "Your mark" });
    await expect(bar).toBeVisible();
    await expect(bar.getByLabel("Your note")).toHaveValue("Made-up note");
    await bar.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("Your marks from an earlier version of this lesson (1)")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("selecting words measures them exactly, even across one of Lawdeck's highlights, and saving needs an account", async ({ page }) => {
  await page.goto("/test-pages/lesson-marks");
  // Select "wombat summons suits" programmatically: it starts inside the definition highlight.
  await page.evaluate(() => {
    const pieces = [...document.querySelectorAll<HTMLElement>("[data-paragraph] [data-o]")];
    const first = pieces.find((p) => p.textContent?.includes("wombat summons"))!;
    const after = pieces.find((p) => Number(p.dataset.o) === 16)!;
    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(after.firstChild!, 6);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await expect(page.getByTestId("pending")).toHaveText("2-22:wombat summons suits");
  const bar = page.getByRole("dialog", { name: "Mark these words" });
  await bar.getByRole("button", { name: "Highlight" }).click();
  await expect(bar.getByRole("alert")).toHaveText("Sign in to mark lessons.");
});
