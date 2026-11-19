import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NY_CIVIL_JURISDICTIONS } from "@/lib/legal/jurisdictions";
import { COURTS_BY_JURISDICTION } from "@/lib/legal/providers/courtlistener";

describe("NY civil research scope", () => {
  it("names only jurisdictions the case-law source understands", () => {
    for (const j of NY_CIVIL_JURISDICTIONS)
      expect(COURTS_BY_JURISDICTION[j], j).toBeDefined();
  });

  it("covers NY trial and appellate courts and the NY federal courts", () => {
    const courts = NY_CIVIL_JURISDICTIONS.flatMap(
      (j) => COURTS_BY_JURISDICTION[j],
    );
    for (const c of [
      "ny",
      "nyappdiv",
      "nysupct",
      "ca2",
      "nysd",
      "nyed",
      "scotus",
    ])
      expect(courts).toContain(c);
  });

  it("is what the matter chat searches with", () => {
    const src = readFileSync("lib/adapters/live/chat.ts", "utf8");
    expect(src).toMatch(/jurisdictionIds: \[\.\.\.NY_CIVIL_JURISDICTIONS\]/);
  });
});
