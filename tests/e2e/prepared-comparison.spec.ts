import { expect, test, type Page } from "@playwright/test";
import { GONZALEZ_COMPARISON as C } from "@/lib/demo/prepared-comparison";
import { isPhone, openApp } from "./helpers";

/**
 * The prepared comparison only exists for a live matter that holds the exact
 * file, so this stands the matter in for the live API: bootstrap gains the
 * matter and its document, and the view link points at a stub PDF.
 */
const MATTER = "00000000-0000-4000-8000-0000000000c1";
const DOC = "00000000-0000-4000-8000-0000000000d1";
const PDF = "/__test/original.pdf";

async function standIn(page: Page) {
  const views: string[] = [];
  await page.route("**/api/bootstrap*", async (route) => {
    const res = await route.fetch();
    const state = await res.json();
    const template = state.matters[0];
    state.matters.push({
      ...template,
      id: MATTER,
      name: C.matterName,
      sample: false,
    });
    state.documents.push({
      ...state.documents[0],
      id: DOC,
      matterId: MATTER,
      name: "Gonzalez v. United States (2d Cir. 2023)",
      ext: "pdf",
      processing: "uploaded",
      sha256: C.sha256,
    });
    await route.fulfill({ response: res, json: state });
  });
  await page.route(`**/api/documents/${DOC}/view*`, (route) => {
    views.push(route.request().url());
    return route.fulfill({
      json: { url: new URL(PDF, route.request().url()).href },
    });
  });
  // Headless Chromium saves PDFs instead of showing them, so the stand-in
  // original is a page: the test checks where the tab goes, not PDF.js.
  await page
    .context()
    .route(`**${PDF}*`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>Original</h1>" }),
    );
  return views;
}

test("compare opens each original at its page and keeps its place after refresh", async ({
  page,
}, info) => {
  test.skip(isPhone(info), "Desktop meeting path");
  const views = await standIn(page);
  await openApp(page, `/matters/${MATTER}`);
  await page.getByRole("link", { name: C.action }).click();
  await expect(page).toHaveURL(/view=compare/);
  await expect(page.getByText(C.label).first()).toBeVisible();
  await expect(page.getByText(C.difference)).toBeVisible();
  await expect(page.getByText(C.left.quote)).toBeVisible();
  await expect(page.getByText(C.right.quote)).toBeVisible();

  for (const side of [C.left, C.right]) {
    const [tab] = await Promise.all([
      page.context().waitForEvent("page"),
      page
        .getByRole("button", { name: `Open original, page ${side.page}` })
        .click(),
    ]);
    await expect(tab).toHaveURL(new RegExp(`${PDF}#page=${side.page}$`));
    await tab.close();
    // The comparison is still there, untouched.
    await expect(page).toHaveURL(/view=compare/);
    await expect(page.getByText(side.quote)).toBeVisible();
  }
  expect(views).toHaveLength(2);
  for (const v of views) expect(v).toContain(`sha256=${C.sha256}`);

  await page.reload();
  await expect(page.getByText(C.left.quote)).toBeVisible();
  await page.getByRole("link", { name: "Back to overview" }).click();
  await expect(page).toHaveURL(new RegExp(`/matters/${MATTER}$`));
  await page.goBack();
  await expect(page.getByText(C.right.quote)).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("no other matter shows the comparison", async ({ page }) => {
  await standIn(page);
  await openApp(page, "/matters/anderson");
  await expect(page.getByRole("link", { name: C.action })).toHaveCount(0);
  await page.goto("/matters/anderson?view=compare");
  await expect(page.getByText(C.label)).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
