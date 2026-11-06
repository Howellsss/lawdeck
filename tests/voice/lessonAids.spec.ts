import { expect, test } from "@playwright/test";

// Memory aids and stories in a lesson (docs/specs/remembrance.md, Phase 2b), made-up content.
for (const width of [360, 1200]) {
  test(`memory aids show every letter, stories stay closed until opened and are labelled (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/lesson-aids");
    const aid = page.getByRole("region", { name: "Memory aid: Made-up licence conditions" });
    await expect(aid.getByText("RWFOI")).toBeVisible();
    await expect(aid.getByRole("definition")).toHaveCount(5);
    await expect(aid.getByRole("button", { name: "Save “Made-up licence conditions” to my memory aids" })).toBeVisible();

    // Stories are closed until opened, so the lesson stays calm.
    await expect(page.getByText("No inspection, no valid licence.")).toHaveCount(0);
    await page.getByRole("button", { name: "Read it as a story: Chidi's poultry licence" }).click();
    const story = page.getByRole("region", { name: "Story: Chidi's poultry licence" });
    await expect(story.getByText("Illustration, not a real case")).toBeVisible();
    await expect(story.getByText("No inspection, no valid licence.")).toBeVisible();
    await expect(story.getByRole("button", { name: "No", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Read it as a story: The farm that was never inspected" }).click();
    await expect(page.getByText("Case story: Quokka v Numbat Licensing Board")).toBeVisible();

    // Saved aids from an earlier version of the lesson still show, in a closed list.
    await expect(page.getByText("Your saved memory aids (1)")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("another memory aid and tell it another way are offered, say they use a question, and need an account", async ({ page }) => {
  await page.goto("/test-pages/lesson-aids");
  await page.getByRole("button", { name: "Another memory aid" }).click();
  await expect(page.getByText("Sign in to ask for another version.")).toBeVisible();
  await page.getByRole("button", { name: "Read it as a story: Chidi's poultry licence" }).click();
  const story = page.getByRole("region", { name: "Story: Chidi's poultry licence" });
  await expect(story.getByRole("button", { name: "Tell it another way" })).toBeVisible();
  await expect(story.getByText("uses one question")).toBeVisible();
});

test("saving needs an account: a visitor is told plainly", async ({ page }) => {
  await page.goto("/test-pages/lesson-aids");
  await page.getByRole("button", { name: "Save “Made-up licence conditions” to my memory aids" }).click();
  await expect(page.getByRole("region", { name: "Memory aid: Made-up licence conditions" }).getByRole("alert")).toContainText("Sign in to save memory aids.");
});

// "Stories in this topic" (founder, 2026-11-06): one folded line at the top of a lesson; opened, the
// stories are cards that open in place.
for (const width of [360, 1200]) {
  test(`a topic lists its stories in one folded line that opens to cards (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/topic-stories");
    await expect(page.getByText("Stories in this topic (2)")).toBeVisible();
    // Folded: the story cards stay hidden until the line is opened.
    await expect(page.getByRole("button", { name: /Read it as a story/ })).toHaveCount(0);
    await page.getByText("Stories in this topic (2)").click();
    const card = page.getByRole("button", { name: "Read it as a story: The farm that was never inspected" });
    await expect(card).toContainText("Case story");
    await expect(page.getByRole("button", { name: "Read it as a story: Chidi's poultry licence" })).toContainText("Story");
    await card.click();
    await expect(page.getByText("Case story: Quokka v Numbat Licensing Board")).toBeVisible();
    await expect(page.getByText("Inspection is a condition of validity.")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
