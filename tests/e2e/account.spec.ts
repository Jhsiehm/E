import { expect, test } from "@playwright/test";
import { isPhone } from "./helpers";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("demo sign-in, onboarding, then a litigation workspace", async ({
    page,
  }, info) => {
    await page.goto("/matters");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fmatters/);
    await page
      .getByRole("button", { name: /Continue with the demo account/ })
      .click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await expect(
      page.getByRole("heading", { name: "About you" }),
    ).toBeVisible();
    const cont = page.getByRole("button", { name: /^Continue/ });
    await expect(cont).toBeDisabled();
    await page.getByLabel("Full name").fill("Ana Ruiz");
    await page.getByLabel("Job title").fill("Associate");
    await page.getByRole("radio", { name: "Law student" }).click();
    await page.getByRole("radio", { name: "I'm new to this" }).click();
    await cont.click();

    await expect(
      page.getByRole("heading", { name: "Practice areas" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Consumer and class action/ })
      .click();
    await page.getByRole("button", { name: /^Corporate/ }).click();
    await cont.click();

    await page.getByRole("button", { name: "TCPA", exact: true }).click();
    await page.getByPlaceholder(/Add a niche/).fill("BIPA");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await cont.click();

    await page.getByRole("button", { name: "S.D.N.Y.", exact: true }).click();
    await cont.click();

    await expect(
      page.getByRole("heading", { name: "Your workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Litigation layout").first()).toBeVisible();
    if (!isPhone(info))
      await page.getByRole("button", { name: "Hide" }).first().click();
    await page.getByRole("button", { name: /Open my workspace/ }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("main h1").first()).toHaveText(/, Ana\.$/);
    await expect(
      page.getByText(/Consumer and class action · TCPA, BIPA · S\.D\.N\.Y\./),
    ).toBeAttached();
    await expect(
      page.getByRole("button", { name: /TCPA/ }).first(),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Primary" });
    // Litigation order is Matters, Calendar, …; on desktop the test hid Matters.
    await expect(nav.getByRole("link").nth(1)).toHaveText(
      isPhone(info) ? /^Matters/ : /^Calendar/,
    );
  });

  test("the API rejects signed-out requests", async ({ request }) => {
    const res = await request.get("/api/bootstrap");
    expect(res.status()).toBe(401);
  });
});

test("tab switches keep the workspace mounted with no loading screen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main#main h1").first()).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __boots: number }).__boots = 0;
    new MutationObserver(() => {
      if (document.querySelector(".boot"))
        (window as unknown as { __boots: number }).__boots++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const nav = page.getByRole("navigation", { name: "Primary" });
  const links = nav.getByRole("link");
  const count = await links.count();
  for (let round = 0; round < 2; round++)
    for (let i = 0; i < count; i++) {
      await links.nth(i).click();
      await expect(links.nth(i)).toHaveAttribute("aria-current", "page");
    }
  expect(
    await page.evaluate(
      () => (window as unknown as { __boots: number }).__boots,
    ),
  ).toBe(0);
});

test("profile changes reorder the sidebar without a reload", async ({
  page,
}, info) => {
  test.skip(isPhone(info), "layout editor checked on desktop");
  await page.goto("/settings/layout");
  await page.getByRole("button", { name: "Move Calendar up" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved." }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link").nth(1)).toHaveText(/^Calendar/);
});
