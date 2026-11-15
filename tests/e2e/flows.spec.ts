import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("new matter is created and opened", async ({ page }) => {
  await openApp(page, "/matters");
  await page.getByRole("button", { name: "New matter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Matter name/).fill("Browser test matter");
  await dialog.getByLabel(/^Court/).fill("S.D.N.Y.");
  await dialog.getByRole("button", { name: /Create matter/ }).click();
  await expect(page).toHaveURL(/\/matters\/(?!anderson)[\w-]+$/);
  await expect(page.locator("main h1")).toHaveText("Browser test matter");
});

test("matter search filters the table and updates the URL", async ({
  page,
}) => {
  await openApp(page, "/matters");
  await page.getByLabel("Search matters…").fill("Parker");
  await expect(page).toHaveURL(/q=Parker/);
  await expect(page.locator("main tbody tr")).toHaveCount(1);
  await expect(page.getByText("1 matters")).toBeVisible();
});

test("mark all read clears the unread count", async ({ page }) => {
  await openApp(page, "/notices");
  const button = page.getByRole("button", { name: "Mark all read" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "0 unread notices" }),
  ).toBeVisible();
});

test("a suggested prompt produces a labelled simulated answer", async ({
  page,
}) => {
  await openApp(page, "/matters/anderson/chat");
  await page.getByRole("button", { name: "Summarize the new ruling" }).click();
  await expect(page.locator(".answer").last()).toContainText(
    "Simulated answer",
    {
      timeout: 15_000,
    },
  );
  await expect(
    page.getByRole("button", { name: "Summarize the new ruling" }),
  ).toBeEnabled({
    timeout: 15_000,
  });
});

test("notice drawer opens from the inbox", async ({ page }) => {
  await openApp(page, "/notices");
  await page.locator("main .list-row, main .notice-row").first().click();
  await expect(page.locator("dialog.drawer")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Affected matters" }),
  ).toBeVisible();
});

test("agent assignment dialog opens from the catalogue", async ({ page }) => {
  await openApp(page, "/agents");
  await page
    .getByRole("button", { name: /Add agent/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Assign agent" }),
  ).toBeVisible();
});

test("many documents upload at once and a bad file does not stop the rest", async ({
  page,
}) => {
  await openApp(page, "/matters/anderson/documents");
  await page.getByRole("button", { name: "Upload documents" }).click();
  const dialog = page.getByRole("dialog");
  const pdf = (name: string) => ({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });
  await dialog
    .getByLabel("Choose files")
    .setInputFiles([
      pdf("Exhibit A.pdf"),
      pdf("Exhibit B.pdf"),
      { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") },
    ]);
  await expect(dialog.getByText("2 documents ready to upload.")).toBeVisible();
  await expect(dialog.getByText("Only PDF and Word")).toBeVisible();
  await dialog.getByRole("button", { name: "Upload 2 documents" }).click();
  await expect(dialog.getByText(/2 documents saved\./)).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Exhibit A").first()).toBeVisible();
  await expect(page.getByText("Exhibit B").first()).toBeVisible();
});
