import { describe, expect, it } from "vitest";
import { toChatMessage } from "@/lib/legal/chat-message";
import { buildRegistry } from "@/lib/legal/registry";
import { answerQuestion, type ResearchResult } from "@/lib/legal/research";
import { retrieve } from "@/lib/legal/retrieve";

const card = (n: number) => ({
  sourceId: `a${n}#p1`,
  authorityId: `a${n}`,
  title: `Case ${n}`,
  citation: `${n} Synth. 1`,
  court: "Court of Appeals",
  decisionDate: "2021-05-04",
  pinpoint: `${n} Synth. at ${n}0`,
  url: `https://example.invalid/${n}`,
  provider: "fixture",
  versionId: "v1",
  checksum: "x",
  fetchedAt: "2026-11-16T00:00:00Z",
  licenseStatus: "synthetic",
  text: "passage",
});

const claim = (
  id: string,
  sourceIds: string[],
  verificationStatus: ResearchResult["claims"][number]["verificationStatus"],
  mismatch = false,
) => ({
  id,
  text: id,
  sourceIds,
  verificationStatus,
  quotes: mismatch
    ? [
        {
          sourceId: sourceIds[0],
          text: "q",
          check: { status: "mismatch" } as never,
        },
      ]
    : [],
});

const result: ResearchResult = {
  mode: "model",
  abstained: false,
  answer: {
    summary: "Reliance is not required.",
    analysis: [
      { text: "Point one.", claimIds: ["c1"] },
      { text: "Point two.", claimIds: ["c2"] },
      { text: "Point three.", claimIds: ["c3"] },
      { text: "Point four.", claimIds: ["c4"] },
    ],
    contraryAuthorities: [{ text: "A contrary view.", claimIds: ["c5"] }],
    limitations: ["Subsequent treatment has not been checked."],
    nextSteps: ["Read Case 2 in full."],
  },
  claims: [
    claim("c1", ["a2#p1"], "supported"),
    claim("c2", ["a1#p1", "a2#p1"], "unverified"),
    claim("c3", ["a3#p1"], "contradicted"),
    claim("c4", ["a1#p1"], "supported", true),
    claim("c5", ["a3#p1"], "partially_supported"),
  ],
  sources: [card(1), card(2), card(3)],
  rejectedSourceRefs: [],
  modelRuns: [],
  treatmentStatus: "not_checked",
};

describe("toChatMessage", () => {
  const msg = toChatMessage(result, "m1");
  const paras = msg.text.split("\n\n");

  it("numbers sources in order of first citation and lists only cited ones", () => {
    expect(paras[1]).toBe("Point one. [1]");
    expect(paras[2]).toBe(
      "Point two. [2][1] (Not yet confirmed against the source.)",
    );
    expect(msg.sources?.map((s) => s.title)).toEqual([
      "Case 2",
      "Case 1",
      "Case 3",
    ]);
    expect(msg.sources?.[0]).toMatchObject({
      index: 1,
      href: "https://example.invalid/2",
      meta: "2 Synth. at 20 · Court of Appeals · 2021",
      verified: true,
    });
    expect(msg.mode).toBe("model");
  });

  it("leaves out contradicted points, flags bad quotes and says why", () => {
    expect(msg.text).not.toContain("Point three.");
    expect(msg.text).toContain(
      "Point four. [2] (A quotation here did not match the source text.)",
    );
    const cautions = paras.indexOf("Before you rely on this");
    expect(paras[cautions + 1]).toMatch(/^• 1 point was left out/);
  });

  it("keeps points against and next steps under their own headings", () => {
    const against = paras.indexOf("Points against");
    expect(paras[against + 1]).toBe(
      "A contrary view. [3] (The source supports this only in part.)",
    );
    expect(paras.at(-2)).toBe("Recommended next step");
    expect(paras.at(-1)).toBe("• Read Case 2 in full.");
  });

  it("labels a no-key answer as quoted passages", async () => {
    const reg = buildRegistry({ NODE_ENV: "test" });
    const q = "Is reliance required for a consumer protection claim?";
    const a = await answerQuestion(q, await retrieve(reg, { question: q }));
    const m = toChatMessage(a, "m2");
    expect(m.mode).toBe("extractive");
    expect(m.sources?.length).toBeGreaterThan(0);
    expect(m.text).toContain("No AI model is configured");
  });
});
