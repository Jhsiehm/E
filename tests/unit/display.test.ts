import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY,
  DISPLAY_BOOT_SCRIPT,
  decodeDisplay,
  encodeDisplay,
  sanitizeDisplay,
} from "@/lib/account/display";
import { sanitizeProfile } from "@/lib/account/profile";

describe("display settings", () => {
  it("round-trips through the cookie form", () => {
    const p = {
      theme: "dark",
      text: "xlarge",
      contrast: "high",
      motion: "reduce",
    } as const;
    expect(encodeDisplay(p)).toBe("dark.xlarge.high.reduce");
    expect(decodeDisplay(encodeDisplay(p))).toEqual(p);
  });

  it("drops unknown values back to the defaults", () => {
    expect(sanitizeDisplay({ theme: "neon", text: "huge" })).toEqual(
      DEFAULT_DISPLAY,
    );
    expect(decodeDisplay("x.y.z")).toEqual(DEFAULT_DISPLAY);
    expect(decodeDisplay(undefined)).toEqual(DEFAULT_DISPLAY);
  });

  it("is kept on the profile's layout and validated there", () => {
    const p = sanitizeProfile({
      layout: { display: { theme: "dark", text: "large", contrast: "bogus" } },
    });
    expect(p.layout.display).toEqual({
      theme: "dark",
      text: "large",
      contrast: "standard",
      motion: "system",
    });
    expect(sanitizeProfile({ layout: {} }).layout.display).toBeUndefined();
  });

  it("boot script sets only known values on <html>", () => {
    const attrs: Record<string, string> = {};
    const doc = {
      cookie: "a=1; cvx-display=dark.large.bogus.reduce",
      documentElement: {
        setAttribute: (k: string, v: string) => (attrs[k] = v),
      },
    };
    new Function("document", DISPLAY_BOOT_SCRIPT)(doc);
    expect(attrs).toEqual({
      "data-theme": "dark",
      "data-text": "large",
      "data-motion": "reduce",
    });
  });
});
