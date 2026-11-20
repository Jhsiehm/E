import { expect, test } from "@playwright/test";
import { openApp, pageOverflow } from "./helpers";

// The lawyer's path through the real court case in the public demo.
test.use({ storageState: { cookies: [], origins: [] } });

test("the dashboard leads to the Gonzalez public court record", async ({
  page,
}) => {
  await openApp(page, "/demo");
  await page.getByRole("link", { name: /Explore a real court case/ }).click();
  await expect(page).toHaveURL(/\/matters\/gonzalez$/);
  await expect(page.locator("main h1").first()).toHaveText(
    "Gonzalez v. United States",
  );
  await expect(
    page.getByText("Public court record · Demonstration").first(),
  ).toBeVisible();
  expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(1);
});

test("the comparison opens each original at its cited page", async ({
  page,
}) => {
  await openApp(page, "/demo");
  await openApp(page, "/matters/gonzalez");
  await page
    .getByRole("link", { name: "Compare the judges’ views on damages" })
    .click();
  await expect(
    page.getByText("Majority opinion", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Partial dissent", { exact: true }),
  ).toBeVisible();
  const links = page.locator("a.record-link");
  await expect(links).toHaveCount(2);
  expect(
    await links.evaluateAll((as) => as.map((a) => a.getAttribute("href"))),
  ).toEqual([
    "/court-records/21-548-2023-08-24.pdf#page=39",
    "/court-records/21-548-2023-08-24.pdf#page=54",
  ]);
  expect(await page.getByText("not controlling law").count()).toBeGreaterThan(
    0,
  );
});

test("the research workflow is labelled as prepared, with linked sources", async ({
  page,
}) => {
  await openApp(page, "/demo");
  await openApp(page, "/matters/gonzalez?view=workflow");
  const view = page.getByLabel("Legal research workflow");
  await expect(view).toContainText("Casevex AI did not write it");
  await expect(view).toContainText("Subsequent treatment");
  const hrefs = await view
    .locator("a.record-link")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.some((h) => h?.startsWith("/court-records/14-3555"))).toBe(true);
  expect(hrefs.some((h) => h?.startsWith("/court-records/21-548"))).toBe(true);
});

test("both opinions are public, read-only files", async ({ page }) => {
  for (const name of ["21-548-2023-08-24.pdf", "14-3555-2016-03-04.pdf"]) {
    const res = await page.request.get(`/court-records/${name}`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(
      (
        await page.request.post(`/court-records/${name}`, { maxRedirects: 0 })
      ).ok(),
    ).toBe(false);
  }
});

test("a real precedent quotes its holding and links the original", async ({
  page,
}) => {
  await openApp(page, "/demo");
  await openApp(page, "/precedents/carpenter");
  await expect(
    page.getByText("Holding, quoted from the opinion"),
  ).toBeVisible();
  await expect(page.getByText("(simulated)")).toHaveCount(0);
  await expect(page.locator("a.record-link")).toHaveAttribute(
    "href",
    "/court-records/carpenter_v._united_states.pdf#page=26",
  );
});
