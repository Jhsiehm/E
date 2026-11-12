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

test("switching screens keeps the workspace mounted (no boot screen, no refetch)", async ({
  page,
}) => {
  await openApp(page, "/");
  let bootstraps = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/bootstrap")) bootstraps++;
  });
  await page.evaluate(() => {
    (window as unknown as { __boots: number }).__boots = 0;
    new MutationObserver(() => {
      if (document.querySelector(".boot"))
        (window as unknown as { __boots: number }).__boots++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const name of [
    "Matters",
    "Agents",
    "Notices",
    "Calendar",
    "Dashboard",
  ]) {
    await nav.getByRole("link", { name: new RegExp("^" + name) }).click();
    await expect(page.locator("main h1").first()).toBeVisible();
  }
  await openApp(page, "/matters/anderson");
  bootstraps = 0;
  await page.evaluate(() => {
    (window as unknown as { __boots: number }).__boots = 0;
    new MutationObserver(() => {
      if (document.querySelector(".boot"))
        (window as unknown as { __boots: number }).__boots++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const tabs = page.getByRole("navigation", { name: "Matter sections" });
  for (const t of ["Documents", "Strategy", "Agent chat", "Overview"]) {
    await tabs.getByRole("link", { name: new RegExp("^" + t) }).click();
    await expect(page.locator("main h1")).toHaveText(
      "Anderson v. Meridian Tech",
    );
  }
  expect(
    await page.evaluate(
      () => (window as unknown as { __boots: number }).__boots,
    ),
  ).toBe(0);
  expect(bootstraps).toBe(0);
});
