import { expect, test } from "@playwright/test";
import { openApp, pageOverflow } from "./helpers";

test("case summary expands, saves a long edit and returns to the overview", async ({
  page,
}) => {
  await openApp(page, "/matters/anderson");
  await page.getByRole("link", { name: "Expand case summary" }).click();
  await expect(page).toHaveURL(/view=summary/);
  const expanded = page.locator(".expanded-matter-content");
  await expanded.getByRole("button", { name: "Edit", exact: true }).click();
  const summary = Array.from(
    { length: 20 },
    (_, i) =>
      `Sample case note ${i + 1}: review the supporting record with the case team.`,
  ).join("\n\n");
  await expanded.getByLabel("Case summary", { exact: true }).fill(summary);
  await expanded.getByRole("button", { name: "Save summary" }).click();
  await expect(expanded.getByLabel("Case summary text")).toHaveText(summary);
  expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "Back to overview" }).click();
  await expect(page).toHaveURL(/\/matters\/anderson$/);
  await expect(page.getByLabel("Case summary text")).toHaveText(summary);
  await expect(
    page.getByRole("link", { name: "Expand case summary" }),
  ).toBeVisible();
});

test("expanded analysis preserves sections and navigates to case work", async ({
  page,
}) => {
  await openApp(page, "/matters/anderson");
  await page.getByRole("link", { name: "Expand Casevex analysis" }).click();
  await expect(page).toHaveURL(/view=analysis/);
  await page.getByRole("button", { name: "Risks", exact: true }).click();
  await expect(page).toHaveURL(/analysis=risks/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Risks", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Analysis text")).toContainText(
    "negative treatment",
  );
  await page.getByRole("button", { name: "Next steps", exact: true }).click();
  await page
    .getByRole("link", { name: "Update the case strategy", exact: true })
    .click();
  await expect(page).toHaveURL(/\/matters\/anderson\/strategy$/);
  await page.goBack();
  await expect(page).toHaveURL(/view=analysis.*analysis=next-steps/);
  await expect(
    page.getByRole("button", { name: "Next steps", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const navigation = page.getByRole("navigation", {
    name: "Expanded case views",
  });
  await navigation
    .getByRole("link", { name: "Case summary", exact: true })
    .click();
  await expect(page).toHaveURL(/view=summary/);
  await expect(page.getByLabel("Case summary text")).toBeVisible();
});
