// Post-sign-in redirects stay on this site, both ways: in-app paths are kept,
// anything that would leave the origin falls back. The check resolves the
// sanitizer's OUTPUT again, because that is what the router/redirect does.

import { describe, expect, it } from "vitest";
import { loadModule } from "../shared/pending";
import { THREADS } from "./adapters";

type SafeNext = (
  v: string | null | undefined,
  origin: string,
  fallback?: string,
) => string;
const mod = await loadModule<{ safeNext: SafeNext }>("lib/account/safe-next");
const ORIGIN = "https://casevex.example.invalid";

const KEEP: [string, string][] = [
  ["/matters", "/matters"],
  ["/matters/m1?tab=documents#top", "/matters/m1?tab=documents#top"],
  ["/onboarding", "/onboarding"],
  [`${ORIGIN}/calendar`, "/calendar"],
];

const ATTACKS = [
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "\\\\evil.example",
  "/\t/evil.example",
  "/\n/evil.example",
  "/\r\\evil.example",
  "/.//evil.example",
  "/a/..//evil.example",
  `${ORIGIN}//evil.example`,
  "javascript:alert(1)",
  "data:text/html,hi",
  "https://casevex.example.invalid.evil.example/",
  "https://casevex.example.invalid@evil.example/",
];

describe.skipIf(!mod)(`post-sign-in redirect [${THREADS.auth}]`, () => {
  for (const [input, want] of KEEP)
    it(`keeps in-app path ${JSON.stringify(input)}`, () => {
      expect(mod!.safeNext(input, ORIGIN)).toBe(want);
    });

  for (const input of ATTACKS)
    it(`never leaves the site for ${JSON.stringify(input)}`, () => {
      const out = mod!.safeNext(input, ORIGIN);
      expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
    });

  it("falls back on empty input", () => {
    expect(mod!.safeNext(null, ORIGIN, "/onboarding")).toBe("/onboarding");
  });
});

describe.skipIf(!!mod)("post-sign-in redirect (pending)", () => {
  it.todo(`waiting on "${THREADS.auth}" (lib/account/safe-next.ts)`);
});
