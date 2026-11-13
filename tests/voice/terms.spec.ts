import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
  test(`Terms of Service and Privacy Notice: sign-up tick box and Before you continue (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/test-pages/terms");
    const gate = page.getByRole("dialog", { name: "Before you continue" });
    await expect(gate).toBeVisible();
    await expect(gate.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await expect(gate.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    await expect(gate.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("target", "_blank");
    const box = gate.getByRole("checkbox", { name: /I am 18 or over/ });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await expect(gate.getByRole("button", { name: "Accept and continue" })).toBeEnabled();
    // The sign-up form has the same tick box.
    await expect(page.getByRole("checkbox", { name: /I am 18 or over/ })).toHaveCount(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
