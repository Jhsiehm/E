import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("display choices apply at once and survive a reload", async ({ page }) => {
  await openApp(page, "/settings/display");
  const html = page.locator("html");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Extra large" }).click();
  await expect(html).toHaveAttribute("data-text", "xlarge");
  await page.reload();
  // Applied by the head script before paint, then confirmed by the account.
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-text", "xlarge");
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const bg = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(bg).toBe("rgb(17, 25, 31)");
});
