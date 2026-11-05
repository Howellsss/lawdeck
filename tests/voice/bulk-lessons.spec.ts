import { expect, test } from "@playwright/test";

// Admin → Lessons "Write all missing lessons" (founder, 2026-11-05) on a test-only page. The test
// answers the writing requests itself: one topic fails, so "try again" is checked too, and one
// lesson's memory aids fail, which is reported without failing the lesson.
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
    const aidsAsked: string[] = [];
    await page.route("**/api/admin/lessons/extras", async (route) => {
      const { topicId } = route.request().postDataJSON() as { topicId: string };
      aidsAsked.push(topicId);
      if (topicId.endsWith("511")) return route.fulfill({ status: 422, json: { ok: false, message: "Claude is busy right now." } });
      return route.fulfill({ json: { ok: true, aids: 2, stories: 2, removed: 0 } });
    });
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/test-pages/bulk-lessons");
    const lessons = page.getByRole("region", { name: "Write all missing lessons" });
    // Lessons with their memory aids: 4 × (US$0.20–0.50 + 0.10–0.25).
    await expect(lessons.getByText("About US$1.20–3.00")).toBeVisible();

    await page.getByRole("button", { name: "Write 4 lessons" }).click();
    await expect(page.getByRole("region", { name: "Write all missing lessons" }).getByRole("status")).toContainText("3 of 4 written · 1 not written");
    await expect(page.getByText("Koala bail: The library has too little on this topic.")).toBeVisible();
    expect(asked).toHaveLength(4);
    // Each written lesson's memory aids were asked for straight after it; one did not work.
    expect(aidsAsked).toHaveLength(3);
    await expect(lessons.getByText("Wombat summons: Claude is busy right now.")).toBeVisible();

    await page.getByRole("button", { name: "Try the 1 again" }).click();
    await expect(page.getByRole("region", { name: "Write all missing lessons" }).getByRole("status")).toContainText("4 of 4 written");
    expect(asked).toHaveLength(5);
    expect(aidsAsked).toHaveLength(4);
    await expect(page.getByRole("button", { name: "Write 0 lessons" })).toBeDisabled();

    await expect(page.getByText("Not yet read in full by a reviewer.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Report a problem" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("bulk write can be limited to one course", async ({ page }) => {
  await page.goto("/test-pages/bulk-lessons");
  const panel = page.getByRole("region", { name: "Write all missing lessons" });
  await panel.getByRole("combobox").selectOption({ label: "Made-up criminal (1)" });
  await expect(panel.getByRole("button", { name: "Write 1 lesson" })).toBeVisible();
  await expect(panel.getByText("About US$0.30–0.75")).toBeVisible();
  // Without memory aids, only the lesson's cost.
  await panel.getByLabel("Also write each lesson’s memory aids and stories").uncheck();
  await expect(panel.getByText("About US$0.20–0.50")).toBeVisible();
});

test("memory aids are written in bulk through their own route, and an acronym shows every letter", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/api/admin/lessons/extras", async (route) => {
    asked.push((route.request().postDataJSON() as { topicId: string }).topicId);
    return route.fulfill({ json: { ok: true, aids: 3, stories: 2, removed: 0 } });
  });
  await page.route("**/api/admin/lessons/generate", (route) => route.abort());
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/test-pages/bulk-lessons");
  const panel = page.getByRole("region", { name: "Write memory aids and stories for every lesson" });
  await expect(panel.getByText("About US$0.20–0.50")).toBeVisible();
  await panel.getByRole("button", { name: "Write 2 sets of memory aids" }).click();
  await expect(panel.getByRole("status")).toContainText("2 of 2 written");
  expect(asked).toHaveLength(2);
  const aid = page.getByRole("region", { name: "Memory aid: Made-up conditions for a wombat licence" });
  await expect(aid.getByText("RWFOI")).toBeVisible();
  await expect(aid.getByRole("definition")).toHaveCount(5);
});
