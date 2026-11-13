import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEMO_STATE } from "./global-setup";
import { openApp } from "./helpers";

// Signed in to the demo, but without the sample-cases cookie the other specs
// use: this is what a brand-new account sees.
const signedIn = JSON.parse(readFileSync(DEMO_STATE, "utf8"));
test.use({
  storageState: {
    ...signedIn,
    cookies: signedIn.cookies.filter(
      (c: { name: string }) => c.name !== "casevex-samples",
    ),
  },
});

test("a new account starts empty; sample cases are an optional, labelled tutorial", async ({
  page,
}) => {
  await openApp(page, "/matters");
  await expect(page.locator("tbody tr")).toHaveCount(0);

  await openApp(page, "/");
  await expect(
    page.getByRole("heading", { name: "Your workspace is ready" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Practice with sample cases" })
    .click();

  const banner = page.getByRole("note");
  await expect(banner).toContainText("You are exploring sample cases");
  await expect(banner).toContainText("not real clients");
  await openApp(page, "/matters");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(page.locator("tbody .sample-tag")).toHaveCount(5);

  await page.getByRole("button", { name: "Remove sample cases" }).click();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
