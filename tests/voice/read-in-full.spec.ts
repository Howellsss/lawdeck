import { expect, test } from "@playwright/test";

// Skim, tick and approve layout (docs/specs/remembrance.md) on the test-only page: a made-up lesson
// with its first section already checked.
for (const width of [360, 1200]) {
  test(`reading a lesson in full shows each section's evidence and tick, and holds approval until all are ticked (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/read-in-full");
    await expect(page.getByText("1 of 3 ticked")).toBeVisible();
    await expect(page.locator("span", { hasText: /^✓ Checked$/ })).toHaveCount(1);
    // Under the first section: the case it names, matched in the library, and its recall question.
    await expect(page.getByText("✓ Found in the library")).toBeVisible();
    await expect(page.getByText("Facts not in the library: verification required.")).toBeVisible();
    await expect(page.getByText("Answer: Questions of construction.")).toBeVisible();
    // The second section and the end-of-topic test are still to tick.
    await expect(page.getByRole("button", { name: "✓ Checked" })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "End-of-topic test (1 question)" })).toBeVisible();
    await expect(page.getByText("Still to tick: section 2, the test.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve as read in full" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send back for a fix" })).toHaveCount(0);
    // One click per lesson: at the top (always in view) and at the end.
    await expect(page.getByRole("button", { name: "All correct: approve and next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All correct: tick everything, approve and go to the next lesson" })).toBeVisible();

    // A problem needs a note before it can be saved.
    await page.getByRole("button", { name: "Problem…" }).first().click();
    await expect(page.getByRole("button", { name: "Mark as a problem" })).toBeDisabled();
    await page.getByLabel("What is wrong?").fill("Wrong order number");
    await expect(page.getByRole("button", { name: "Mark as a problem" })).toBeEnabled();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
