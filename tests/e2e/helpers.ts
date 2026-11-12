import { expect, type Page, type TestInfo } from "@playwright/test";

export const isPhone = (info: TestInfo) =>
  (info.project.use.viewport?.width ?? 1280) < 600;

/** Every principal screen, including nested matter tabs and settings sections. */
export const ROUTES: [path: string, heading: string | RegExp][] = [
  ["/", /^Good (morning|afternoon|evening), /],
  ["/matters", "Matters"],
  ["/matters/anderson", "Anderson v. Meridian Tech"],
  ...["documents", "research", "notices", "deadlines", "strategy", "chat"].map(
    (t) =>
      [`/matters/anderson/${t}`, "Anderson v. Meridian Tech"] as [
        string,
        string,
      ],
  ),
  ["/agents", "Legal agents"],
  ["/precedents", "Precedents"],
  ["/notices", "Notices"],
  ["/calendar", "Calendar"],
  ["/documents", "Documents"],
  ...[
    "profile",
    "practice",
    "layout",
    "workspace",
    "notifications",
    "integrations",
    "security",
  ].map((s) => [`/settings/${s}`, "Settings"] as [string, string]),
];

export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("main#main h1").first()).toBeVisible();
}

export async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));
}
