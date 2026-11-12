import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("skip link is the first stop and moves focus to main", async ({
  page,
}) => {
  await openApp(page, "/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator("main#main")).toBeFocused();
});

test("primary navigation is reachable and operable by keyboard", async ({
  page,
}) => {
  await openApp(page, "/");
  const link = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: /^Matters/ });
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/matters$/);
});

test("dialogs open from the keyboard and close with Escape", async ({
  page,
}) => {
  await openApp(page, "/matters");
  const button = page.getByRole("button", { name: "New matter" });
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "New matter" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("search dialog submits with Enter", async ({ page }) => {
  await openApp(page, "/");
  await page
    .getByRole("button", { name: "Search all precedents" })
    .first()
    .click();
  const input = page
    .getByRole("dialog")
    .getByLabel("Search cases, citations, or topics");
  await input.fill("arbitration");
  await input.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/precedents\?q=arbitration$/);
});
