import { expect, test } from "@playwright/test";

// Sign-in screens, tested with Supabase switched off: checks the screens, validation
// and safety rules without creating real accounts.

test("sign in: email first, then password", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "The law, within reach" })).toBeVisible();

  const email = page.getByLabel("Email address");
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();

  await email.fill("ada@example.com");
  await email.press("Enter");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toBeFocused();

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your password.")).toBeVisible();

  await password.fill("a long enough password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Fake details never sign in: depending on set-up, Supabase is off, unreachable or says no.
  await expect(
    page.getByText(/Sign-in isn’t switched on|Something went wrong while signing in|don’t match/),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("ada@example.com");
});

test("sign in ignores links that try to send students to another site", async ({ page }) => {
  const next = page.locator('input[name="next"]');
  // Exactly one sign-in form, carrying only a Lawdeck path.
  await page.goto("/sign-in?next=/courses");
  await expect(next).toHaveCount(1);
  await expect(next).toHaveValue("/courses");
  await page.goto("/sign-in?next=//evil.example");
  await expect(next).toHaveCount(1);
  await expect(next).toHaveValue("/");
});

test("password can be shown and hidden", async ({ page }) => {
  await page.goto("/sign-up");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
});

test("create account checks the password length on the server", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
});

test("forgot password checks the email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
});

test("reset password page needs a valid link", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for a new reset link" })).toBeVisible();
});

test("a broken email link explains what happened", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bad&type=signup");
  await expect(page).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page.getByText("That link has expired or was already used")).toBeVisible();
});

test("a link opened in another browser gets a clear next step", async ({ page }) => {
  await page.goto("/sign-in?error=browser");
  await expect(page.getByText("open the link in the same browser")).toBeVisible();
});

test("an unfinished Google sign-in returns to sign-in with a clear message", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied");
  await expect(page).toHaveURL(/\/sign-in\?error=google$/);
  await expect(page.getByText("Google sign-in didn’t finish")).toBeVisible();
});

test("the Google button only appears when Google sign-in is switched on", async ({ page }) => {
  await page.goto("/sign-in");
  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(google).toHaveCount(process.env.GOOGLE_SIGN_IN_ENABLED === "true" ? 1 : 0);
});

test("the invite link welcomes testers and offers Google; its next step needs sign-in", async ({ page }) => {
  await page.goto("/invite");
  await expect(page.getByRole("heading", { name: "You’re invited" })).toBeVisible();
  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(google).toHaveCount(process.env.GOOGLE_SIGN_IN_ENABLED === "true" ? 1 : 0);
  await page.goto("/invite/welcome");
  await expect(page).toHaveURL(/\/invite$/);
});

test("signed-out visitors see Sign in in the menu", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "phone-360") await page.getByRole("button", { name: /menu/i }).first().click();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("the main pages fit a phone without sideways scrolling (founder, 2026-10-25)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/", "/courses", "/drafting", "/invite"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    // The page edge is clipped, so also check that nothing pokes past it.
    const poking = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 1 && box.height > 1 && box.right > window.innerWidth + 0.5;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
    );
    expect(poking, path).toEqual([]);
    // iPhones zoom (and the page then slides sideways) when a field's text is under 16px.
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.id || el.getAttribute("name") || el.tagName),
    );
    expect(small, path).toEqual([]);
  }
});

test("sign-in screens fit a 360 px phone without sideways scrolling", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/invite"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
