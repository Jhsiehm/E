import { expect, test } from "@playwright/test";
import { openApp, pageOverflow } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("public demo opens a complete sample workspace without signup", async ({
  page,
}) => {
  await openApp(page, "/demo");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main h1").first()).toContainText("Jordan");
  const banner = page.getByRole("note");
  await expect(banner).toContainText("Demo workspace.");
  await expect(banner).toContainText("Fictional data and simulated research");
  await expect(
    banner.getByRole("link", { name: "Restart demo" }),
  ).toBeVisible();
  expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(1);
  await openApp(page, "/matters");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await openApp(page, "/documents");
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await openApp(page, "/matters/anderson/chat");
  await page.getByRole("button", { name: "Summarize the new ruling" }).click();
  await expect(page.locator(".answer").last()).toContainText(
    "Simulated answer",
    { timeout: 15_000 },
  );
});

test("demo can restart after edits and exit to normal sign-in", async ({
  page,
}) => {
  await openApp(page, "/demo");
  const created = await page.request.post("/api/matters", {
    data: { name: "Temporary demo matter" },
  });
  expect(created.status()).toBe(201);
  await openApp(page, "/matters");
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await page.getByRole("link", { name: "Restart demo" }).click();
  await expect(page).toHaveURL(/\/$/);
  await openApp(page, "/matters");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("link", { name: "Explore the demo" }),
  ).toBeVisible();
});
