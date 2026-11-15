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
  await page.getByRole("button", { name: "Take the guided tour" }).click();

  // The tour walks through the labelled sample cases, one screen per step.
  const tour = page.getByRole("dialog", { name: "Welcome to Casevex" });
  await expect(tour).toContainText("Step 1 of 7");
  const banner = page.getByRole("note");
  await expect(banner).toContainText("You are exploring sample cases");
  await expect(banner).toContainText("not real clients");

  await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/matters$/);
  await expect(page.getByRole("dialog", { name: "Matters" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(page.locator("tbody .sample-tag")).toHaveCount(5);
  await expect(page.locator(".table-wrap.tour-target")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/matters\/anderson\/chat$/);
  await expect(
    page.getByRole("dialog", { name: "Ask a question" }),
  ).toContainText("check it yourself");
  await page.getByRole("dialog").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/matters\/anderson\/documents$/);
  // The tab's count matches the files actually listed.
  const rows = await page.locator("main tbody tr").count();
  await expect(
    page.getByRole("link", { name: `Documents (${rows})` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // It can be taken again from the banner, and Escape closes it.
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(
    page.getByRole("dialog", { name: "Welcome to Casevex" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openApp(page, "/matters");
  await page.getByRole("button", { name: "Remove sample cases" }).click();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("the last tour step can remove the sample cases", async ({ page }) => {
  await openApp(page, "/");
  await page.getByRole("button", { name: "Take the guided tour" }).click();
  for (let i = 0; i < 6; i++)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Next" })
      .click();
  const last = page.getByRole("dialog", { name: "You are ready" });
  await expect(last).toContainText("Step 7 of 7");
  await last.getByRole("button", { name: "Remove sample cases" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your workspace is ready" }),
  ).toBeVisible();
});
