import { expect, test } from "@playwright/test";

// Admin → Lessons "Write all missing lessons" (founder, 2026-11-05) on a test-only page. The test
// answers the writing requests itself: one topic fails, so "try again" is checked too.
for (const width of [360, 1200]) {
  test(`bulk write writes every missing lesson, reports failures and retries them (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let failKoala = true;
    const asked: string[] = [];
    await page.route("**/api/admin/lessons/generate", async (route) => {
      const { topicId } = route.request().postDataJSON() as { topicId: string };
      asked.push(topicId);
      if (topicId.endsWith("514") && failKoala) {
        failKoala = false;
        return route.fulfill({ status: 422, json: { ok: false, message: "The library has too little on this topic." } });
      }
      return route.fulfill({ json: { ok: true, sections: 3, checkpoints: 5, authorities: 2, removed: 0 } });
    });
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/test-pages/bulk-lessons");
    await expect(page.getByText("About US$0.80–2.00")).toBeVisible();

    await page.getByRole("button", { name: "Write 4 lessons" }).click();
    await expect(page.getByRole("status")).toContainText("3 of 4 written · 1 not written");
    await expect(page.getByText("Koala bail: The library has too little on this topic.")).toBeVisible();
    expect(asked).toHaveLength(4);

    await page.getByRole("button", { name: "Try the 1 again" }).click();
    await expect(page.getByRole("status")).toContainText("4 of 4 written");
    expect(asked).toHaveLength(5);
    await expect(page.getByRole("button", { name: "Write 0 lessons" })).toBeDisabled();

    await expect(page.getByText("Not yet read in full by a reviewer.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Report a problem" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("bulk write can be limited to one course", async ({ page }) => {
  await page.goto("/test-pages/bulk-lessons");
  await page.getByLabel("Which course").selectOption({ label: "Made-up criminal (1)" });
  await expect(page.getByRole("button", { name: "Write 1 lesson" })).toBeVisible();
  await expect(page.getByText("About US$0.20–0.50")).toBeVisible();
});
