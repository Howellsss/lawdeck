import { expect, test } from "@playwright/test";

// Security headers (step 7g, rule P-05): on every page, and the content security policy (still
// "report only") would block nothing on the public pages.

for (const path of ["/", "/sign-in", "/sign-up", "/takedown", "/courses"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
  });

  test(`${path} breaks none of the content security policy`, async ({ page }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { cspViolations: string[] }).cspViolations ??= [];
        (window as unknown as { cspViolations: string[] }).cspViolations.push(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    violations.push(...(await page.evaluate(() => (window as unknown as { cspViolations?: string[] }).cspViolations ?? [])));
    expect(violations).toEqual([]);
  });
}

test("the policy report address accepts reports and returns nothing", async ({ request }) => {
  const response = await request.post("/api/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({ "csp-report": { "effective-directive": "script-src", "blocked-uri": "https://evil.example/x?token=1" } }),
  });
  expect(response.status()).toBe(204);
  expect(await response.text()).toBe("");
});
