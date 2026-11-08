import { expect, test } from "@playwright/test";

// Library: paste Google Drive links and set details for every file at once (founder, 2026-11-08).
for (const width of [360, 1280]) {
  test(`paste Drive links and apply details to all files (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-pages/drive-links");
    const box = page.getByLabel("Or paste Google Drive links (files or folders, one per line)");
    await expect(page.getByRole("button", { name: "Find files from links" })).toBeDisabled();
    await box.fill("https://drive.google.com/drive/folders/0BxYzFolder1234567890");
    await page.getByRole("button", { name: "Find files from links" }).click();
    // Test pages have no Google key or admin: the admin is told plainly, nothing breaks.
    await expect(page.getByRole("alert").first()).toBeVisible();

    const files = page.getByRole("list", { name: "Files to import" });
    await expect(files.getByRole("listitem")).toHaveCount(2);
    const all = page.getByRole("group", { name: "Apply to all files" });
    await all.getByLabel("Course for all files").selectOption({ label: "Property Law" });
    await all.getByLabel("Year for all files").fill("2025");
    await all.getByRole("button", { name: "Apply to all" }).click();
    for (const i of [0, 1]) {
      const row = files.getByRole("listitem").nth(i);
      await expect(row.getByLabel("Course", { exact: true })).toHaveValue("00000000-0000-4000-8000-000000000902");
      await expect(row.getByLabel("Year", { exact: true })).toHaveValue("2025");
    }
    // A single file can still be changed afterwards.
    await files.getByRole("listitem").nth(1).getByLabel("Course", { exact: true }).selectOption({ label: "Civil Litigation" });
    await expect(files.getByRole("listitem").nth(0).getByLabel("Course", { exact: true })).toHaveValue("00000000-0000-4000-8000-000000000902");
    await expect(page.getByRole("button", { name: "Import 2 files" })).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
