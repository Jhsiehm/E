import { expect, test } from "@playwright/test";

test("an existing account without a workspace can finish setup", async ({
  page,
}) => {
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "workspace_required",
          message: "Finish setting up your private workspace to continue.",
        },
      }),
    }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding\?workspace=1$/);
  await expect(page.getByRole("status")).toHaveText(
    /Finish setup to create your private workspace/,
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/bootstrap");
  await page.getByRole("button", { name: /Open my workspace/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main h1").first()).toBeVisible();
});

test("workspace load errors show the server's explanation", async ({
  page,
}) => {
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "forbidden",
          message: "Your account needs a workspace invitation.",
        },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText(
    "Your account needs a workspace invitation.",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
