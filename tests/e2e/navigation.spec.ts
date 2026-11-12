import { expect, test } from "@playwright/test";
import { isPhone, openApp } from "./helpers";

const NAV: [string, RegExp, string | RegExp][] = [
  ["Matters", /\/matters$/, "Matters"],
  ["Agents", /\/agents$/, "Legal agents"],
  ["Precedents", /\/precedents$/, "Precedents"],
  ["Notices", /\/notices$/, "Notices"],
  ["Calendar", /\/calendar$/, "Calendar"],
  ["Documents", /\/documents$/, "Documents"],
  ["Settings", /\/settings\/profile$/, "Settings"],
  ["Dashboard", /\/$/, /^Good /],
];

test("primary navigation reaches every section and marks it current", async ({
  page,
}) => {
  await openApp(page, "/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [name, url, heading] of NAV) {
    const link = nav.getByRole("link", { name: new RegExp("^" + name) });
    await link.click();
    await expect(page).toHaveURL(url);
    await expect(page.locator("main h1").first()).toHaveText(heading);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
});

test("matter tabs switch content and keep the matter", async ({ page }) => {
  await openApp(page, "/matters/anderson");
  const tabs = page.getByRole("navigation", { name: "Matter sections" });
  for (const [t, slug] of [
    ["Documents", "/documents"],
    ["Research", "/research"],
    ["Notices", "/notices"],
    ["Deadlines", "/deadlines"],
    ["Strategy", "/strategy"],
    ["Agent chat", "/chat"],
    ["Overview", ""],
  ]) {
    const link = tabs.getByRole("link", { name: new RegExp("^" + t) });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/matters/anderson${slug}$`));
    await expect(page.locator("main h1")).toHaveText(
      "Anderson v. Meridian Tech",
    );
    await expect(link).toHaveAttribute("aria-current", "page");
  }
});

test("sidebar matter shortcuts open the matter", async ({ page }, info) => {
  test.skip(isPhone(info), "sidebar matter list is hidden at phone width");
  await openApp(page, "/");
  await page
    .locator(".sidebar-matters")
    .getByRole("link", { name: "Ridgeway Holdings LLC" })
    .click();
  await expect(page).toHaveURL(/\/matters\/ridgeway$/);
  await expect(page.locator("main h1")).toHaveText("Ridgeway Holdings LLC");
});
