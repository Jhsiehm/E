import { expect, test } from "@playwright/test";
import { isPhone, openApp, pageOverflow, ROUTES } from "./helpers";

for (const [path, heading] of ROUTES) {
  test(`renders ${path} without page-level overflow`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openApp(page, path);
    await expect(page.locator("main#main h1").first()).toHaveText(heading);
    const overflow = await pageOverflow(page);
    expect(overflow.horizontal, "horizontal page scroll").toBeLessThanOrEqual(
      0,
    );
    if (!isPhone(info))
      expect(
        overflow.vertical,
        "desktop page must not scroll",
      ).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("unknown routes show the not-found screen", async ({ page }) => {
  await openApp(page, "/no-such-page");
  await expect(page.locator("main h1")).toHaveText("Page not found");
  await page.getByRole("link", { name: "Return to dashboard" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("sample data is labelled as such", async ({ page }) => {
  await openApp(page, "/");
  await expect(page.getByText("Sample cases shown.").first()).toBeVisible();
  const res = await page.request.get("/api/bootstrap");
  expect(res.headers()["x-casevex-data-mode"]).toBe("fixture");
});
