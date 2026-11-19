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
  quote: "exact" | "mismatch" | null = "exact",
) => ({
  id,
  text: id,
  sourceIds,
  verificationStatus,
  quotes: quote
    ? [
        {
          sourceId: sourceIds[0],
          text: "q",
          check: { status: quote, similarity: 1, span: null },
        },
      ]
    : [],
});

const result: Omit<ResearchResult, "checked"> = {
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
    contraryAuthorities: [
      { text: "A contrary view.", claimIds: ["c5"] },
      { text: "A checked contrary view.", claimIds: ["c6"] },
    ],
    limitations: ["Subsequent treatment has not been checked."],
    nextSteps: ["Read Case 2 in full."],
  },
  claims: [
    { ...claim("c1", ["a2#p1"], "supported"), text: "Point one." },
    claim("c2", ["a1#p1", "a2#p1"], "unverified"),
    claim("c3", ["a3#p1"], "contradicted"),
    claim("c4", ["a1#p1"], "supported", "mismatch"),
    {
      ...claim("c5", ["a3#p1"], "partially_supported"),
      text: "A contrary view.",
      supportReason: "only for written notices",
    },
    {
      ...claim("c6", ["a1#p1"], "supported"),
      text: "A checked contrary view.",
    },
  ],
  sources: [card(1), card(2), card(3)],
  rejectedSourceRefs: [],
  modelRuns: [],
  treatmentStatus: "not_checked",
  supportCheck: "completed",
};

describe("toChatMessage", () => {
  const msg = toChatMessage(result, "m1");
  const paras = msg.text.split("\n\n");

  it("states only checked claims, never the stored summary", () => {
    expect(paras[0]).toBe("Point one. [1]");
    expect(msg.text).not.toContain("Reliance is not required.");
    for (const left of ["c2", "c3", "c4"]) expect(msg.text).not.toContain(left);
    expect(msg.outcome).toBe("answered");
    expect(msg.mode).toBe("model");
  });

  it("numbers sources by first citation and reports each check separately", () => {
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
      checks: { quote: "exact", support: "supports", treatment: "not_checked" },
    });
    // Case 3 is cited only by a partly supported point: not verified.
    expect(msg.sources?.[2]).toMatchObject({
      verified: false,
      checks: { support: "partial" },
    });
  });

  it("keeps checked points against, flags partial ones and counts the rest", () => {
    const against = paras.indexOf("Points against");
    expect(paras[against + 1]).toBe("A checked contrary view. [2]");
    const review = paras.indexOf("Not confirmed: review before relying");
    expect(paras[review + 1]).toBe(
      "Drafted: “A contrary view.” [3] Source check: the source supports this only in part (only for written notices).",
    );
    const cautions = paras.indexOf("Before you rely on this");
    expect(paras.slice(cautions + 1, cautions + 4)).toEqual([
      "• 1 drafted point was left out because the source check found the cited source does not support it.",
      "• 1 drafted point was left out because a quotation did not match the source text.",
      "• 1 drafted point was left out because it could not be checked against its source.",
    ]);
  });

  it("uses server-written next steps, not the model's", () => {
    expect(paras.at(-2)).toBe("Recommended next step");
    expect(paras.at(-1)).toMatch(/^• Open each cited source/);
    expect(msg.text).not.toContain("Read Case 2 in full.");
  });

  it("labels a no-key answer as quoted passages", async () => {
    const reg = buildRegistry({ NODE_ENV: "test" });
    const q = "Is reliance required for a consumer protection claim?";
    const a = await answerQuestion(q, await retrieve(reg, { question: q }));
    const m = toChatMessage(a, "m2");
    expect(m.mode).toBe("extractive");
    expect(m.outcome).toBe("insufficient");
    expect(m.sources?.length).toBeGreaterThan(0);
    expect(m.sources?.every((s) => !s.verified)).toBe(true);
    expect(m.text).toContain("No AI model is configured");
    expect(m.text).toContain("Quoted passages (not conclusions)");
  });
});
