import { expect, test } from "@playwright/test";
import { openApp, pageOverflow } from "./helpers";

test("a ruling explains different updates for each affected case", async ({
  page,
}) => {
  await openApp(page, "/notices");
  const notice = page.locator(".notice-row").filter({
    hasText: "Second Circuit broadens confidential-information standard",
  });
  await expect(notice).toContainText(
    "update Anderson’s supporting argument and Ridgeway’s risk analysis",
  );
  expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(1);
  await notice.click();
  const drawer = page.getByRole("dialog");
  const anderson = drawer.getByRole("region", {
    name: "Anderson v. Meridian Tech",
    exact: true,
  });
  const ridgeway = drawer.getByRole("region", {
    name: "Ridgeway Holdings LLC",
    exact: true,
  });
  await expect(anderson).toContainText("Suggested update");
  await expect(anderson).toContainText(
    "Compare the declaration with the sample ruling",
  );
  await expect(ridgeway).toContainText(
    "Document factual distinctions and defenses",
  );
  await anderson.getByRole("link", { name: "Review case strategy" }).click();
  await expect(page).toHaveURL(/\/matters\/anderson\/strategy$/);
  await expect(drawer).toBeHidden();
  await openApp(page, "/matters/anderson/notices");
  await expect(page.locator("main .list-row").first()).toContainText(
    "Compare the declaration with the sample ruling",
  );
});

test("deadline and docket notices link to the relevant case section", async ({
  page,
}) => {
  for (const [title, summary, action, route] of [
    [
      "Response to motion due in 7 days",
      "assign a drafting owner",
      "Review case deadlines",
      "/matters/ridgeway/deadlines",
    ],
    [
      "Docket update: order on motion to compel",
      "review its production requirements",
      "Review case documents",
      "/matters/anderson/documents",
    ],
  ]) {
    await openApp(page, "/notices");
    const notice = page.locator(".notice-row").filter({ hasText: title });
    await expect(notice).toContainText(summary);
    await notice.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Suggested update");
    await drawer.getByRole("link", { name: action }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(drawer).toBeHidden();
  }
});
