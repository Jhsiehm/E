import { describe, expect, it } from "vitest";
import { buildLayout, matchesNiche, promptsFor } from "@/lib/account/layout";
import {
  emptyProfile,
  sanitizeProfile,
  type Profile,
} from "@/lib/account/profile";
import { allowOpenSignup, resolveAuthMode } from "@/lib/account/auth-mode";

const p = (over: Partial<Profile>): Profile => ({
  ...emptyProfile("a@b.co"),
  ...over,
});

describe("buildLayout", () => {
  it("puts deadlines and calendar first for litigators", () => {
    const l = buildLayout(
      p({
        practiceAreas: ["consumer_class_action"],
        primaryArea: "consumer_class_action",
      }),
    );
    expect(l.preset).toBe("litigation");
    expect(l.nav.slice(0, 3)).toEqual(["dashboard", "matters", "calendar"]);
    expect(l.nav.at(-1)).toBe("settings");
    expect(l.cards[0]).toBe("deadlines");
    expect(l.defaultPractice).toBe("Consumer and class action");
  });

  it("puts documents ahead for transactional work and notices for regulatory", () => {
    expect(
      buildLayout(p({ practiceAreas: ["corporate"], primaryArea: "corporate" }))
        .nav[2],
    ).toBe("documents");
    const reg = buildLayout(
      p({ practiceAreas: ["regulatory"], primaryArea: "regulatory" }),
    );
    expect(reg.nav[1]).toBe("notices");
    expect(reg.cards[0]).toBe("notices");
  });

  it("honors manual order and hidden items but keeps every item and the fixed ends", () => {
    const l = buildLayout(
      p({
        practiceAreas: ["corporate"],
        primaryArea: "corporate",
        layout: {
          navOrder: ["agents", "matters"],
          hiddenNav: ["calendar"],
          dashboardCards: ["activity"],
        },
      }),
    );
    expect(l.nav.slice(0, 3)).toEqual(["dashboard", "agents", "matters"]);
    expect(new Set(l.nav).size).toBe(8);
    expect(l.nav.at(-1)).toBe("settings");
    expect(l.hiddenNav).toEqual(["calendar"]);
    expect(l.cards).toEqual(["activity"]);
  });

  it("writes prompts for the person's niches and court", () => {
    const prompts = promptsFor(
      p({
        practiceAreas: ["consumer_class_action"],
        primaryArea: "consumer_class_action",
        niches: ["TCPA"],
        jurisdictions: ["S.D.N.Y."],
      }),
    );
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain("TCPA");
    expect(prompts[0]).toContain("S.D.N.Y.");
  });

  it("falls back to general defaults with no answers", () => {
    const l = buildLayout(emptyProfile());
    expect(l.preset).toBe("litigation");
    expect(l.defaultPractice).toBe("General research");
    expect(l.prompts).toHaveLength(3);
  });

  it("tags notices that mention a niche", () => {
    expect(matchesNiche("New TCPA ruling", ["TCPA"])).toBe(true);
    expect(matchesNiche("New ruling", ["TCPA"])).toBe(false);
  });
});

describe("sanitizeProfile", () => {
  it("drops unknown areas, caps lists and fixes the primary area", () => {
    const s = sanitizeProfile({
      fullName: "  Ana  ",
      practiceAreas: [
        "employment",
        "nope",
        "employment",
        "corporate",
        "family",
        "regulatory",
      ],
      primaryArea: "nope",
      accent: "neon",
      aiExperience: "guru",
      timeZone: "Mars/Base",
      layout: { navOrder: ["settings", "matters", "evil"], hiddenNav: "x" },
      role: "owner",
    });
    expect(s.fullName).toBe("Ana");
    expect(s.practiceAreas).toEqual(["employment", "corporate", "family"]);
    expect(s.primaryArea).toBe("employment");
    expect(s.accent).toBe("rose");
    expect(s.aiExperience).toBeNull();
    expect(s.timeZone).toBe("America/New_York");
    expect(s.layout).toEqual({ navOrder: ["matters"] });
    expect("role" in s).toBe(false);
  });
});

describe("resolveAuthMode", () => {
  const keys = {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  };
  it("uses Supabase whenever it is configured", () => {
    expect(resolveAuthMode({ ...keys, NODE_ENV: "production" })).toBe(
      "supabase",
    );
  });
  it("offers demo sign-in only with fixture data", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" })).toBe("demo");
    expect(
      resolveAuthMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "fixture" }),
    ).toBe("demo");
    expect(resolveAuthMode({ NODE_ENV: "production" })).toBe("unconfigured");
  });
  it("never allows demo sign-in or open sign-up in a pilot", () => {
    expect(
      resolveAuthMode({
        CASEVEX_DEPLOYMENT: "pilot",
        CASEVEX_DATA_MODE: "live",
      }),
    ).toBe("unconfigured");
    expect(allowOpenSignup({ CASEVEX_DEPLOYMENT: "pilot" })).toBe(false);
    expect(allowOpenSignup({})).toBe(true);
  });
});

import { safeNext } from "@/lib/account/safe-next";
describe("safeNext", () => {
  const o = "https://casevex.vercel.app";
  it("keeps same-site paths", () => {
    expect(safeNext("/matters?tab=open#x", o)).toBe("/matters?tab=open#x");
    expect(safeNext(null, o, "/onboarding")).toBe("/onboarding");
  });
  it("rejects every way of pointing off-site", () => {
    for (const v of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r\\evil.com",
      "javascript:alert(1)",
      "http://casevex.vercel.app.evil.com/",
      "/.//evil.com",
      "/a/..//evil.com",
      "https://casevex.vercel.app//evil.com",
    ])
      expect(safeNext(v, o)).toBe("/");
  });
});
