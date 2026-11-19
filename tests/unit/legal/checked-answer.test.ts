/**
 * Regression cases for the answer-rendering gap (engineering brief, PR 1):
 * a scripted draft whose own summary asserts a contradicted claim. Only
 * claims that passed the checks may reach the API's summary or the chat.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Answer } from "@/components/workspace/Answer";
import { WorkspaceContext } from "@/components/workspace/context";
import { researchPreview } from "@/lib/legal/api";
import { toChatMessage } from "@/lib/legal/chat-message";
import { checkAnswer, INSUFFICIENT_MESSAGE } from "@/lib/legal/checked-answer";
import type { Complete } from "@/lib/legal/model";
import { buildRegistry } from "@/lib/legal/registry";
import type { ResearchResult } from "@/lib/legal/research";
import type { Message } from "@/lib/mock/types";

const question =
  "What are the elements of a consumer protection claim and is reliance required?";
// Fixture retrieval order for this question: S1 = elements, S3 = reliance.
const ELEMENTS =
  "a plaintiff must allege that the defendant engaged in consumer-oriented conduct";
const NO_RELIANCE = "The statute does not require reliance";

const GOOD =
  "The claim requires consumer-oriented conduct, a materially misleading act and injury.";
const BAD = "Reliance must be proven for every consumer protection claim.";
const DRAFT_SUMMARY = "Reliance is required, so this claim fails outright.";
const MODEL_STEP = "File a motion to dismiss for failure to plead reliance.";
const MODEL_LIMIT = "This claim clearly fails under settled law.";
/** Text that must never be presented as an answer in any scenario. */
const NEVER = [BAD, DRAFT_SUMMARY, MODEL_STEP, MODEL_LIMIT];

type Verdicts = { claim: string; status: string; reason: string }[] | "throw";

function scripted(verdicts: Verdicts, goodQuote = ELEMENTS): Complete {
  return async (req) => {
    if (req.task === "research.verify_support" && verdicts === "throw")
      throw new Error("checker unavailable");
    const raw =
      req.task === "research.draft"
        ? {
            summary: DRAFT_SUMMARY,
            analysis: [
              {
                text: GOOD,
                sources: ["S1"],
                quotes: [{ source: "S1", text: goodQuote }],
              },
              {
                text: BAD,
                sources: ["S3"],
                quotes: [{ source: "S3", text: NO_RELIANCE }],
              },
            ],
            contrary: [],
            limitations: [MODEL_LIMIT],
            nextSteps: [MODEL_STEP],
            insufficient: false,
          }
        : { verdicts };
    const parse =
      req.responseSchema && "parse" in req.responseSchema
        ? req.responseSchema.parse
        : (v: unknown) => v;
    return {
      output: parse(raw) as never,
      modelId: `test/${req.task}`,
      provider: "test",
      costUsd: 0,
      usage: {} as never,
    };
  };
}

async function run(complete: Complete) {
  const res = await researchPreview(
    buildRegistry({ NODE_ENV: "test" }),
    new Request("http://localhost/api/v1/legal-research/preview", {
      method: "POST",
      body: JSON.stringify({ question }),
      headers: { "content-type": "application/json" },
    }),
    { complete },
  );
  expect(res.status).toBe(200);
  const api = (await res.json()).data as ResearchResult;
  const msg = toChatMessage(api, "m1");
  return { api, msg, html: render(msg) };
}

function render(msg: Message) {
  const ws = { data: { agents: [], matters: [] }, matter: null } as never;
  return renderToStaticMarkup(
    createElement(
      WorkspaceContext.Provider,
      { value: ws },
      createElement(Answer, { msg }),
    ),
  );
}

/** The parts of the API answer a screen could present as conclusions. */
const presented = (api: ResearchResult) =>
  JSON.stringify([
    api.answer,
    api.checked.summary,
    api.checked.points,
    api.checked.contrary,
  ]);

function expectNoLeak(api: ResearchResult, msg: Message, html: string) {
  for (const t of NEVER) {
    expect(presented(api)).not.toContain(t);
    expect(msg.text).not.toContain(t);
    expect(html).not.toContain(t);
  }
}

describe("checked answers: only claims that pass every check are stated", () => {
  it("contradicted claim in the draft summary: only the supported claim is the headline", async () => {
    const { api, msg, html } = await run(
      scripted([
        { claim: "C1", status: "supported", reason: "states the elements" },
        {
          claim: "C2",
          status: "contradicted",
          reason: "the source says reliance is not required",
        },
      ]),
    );
    expect(api.abstained).toBe(false);
    expect(api.checked.outcome).toBe("answered");
    expect(api.answer.summary).toBe(GOOD);
    expect(api.checked.summarySentences).toEqual([
      { claimId: "claim-1", text: GOOD, sourceIds: ["fixture:op-1#p2"] },
    ]);
    expect(api.answer.analysis).toEqual([
      { text: GOOD, claimIds: ["claim-1"] },
    ]);
    expect(api.checked.withheld.contradicted).toBe(1);
    expectNoLeak(api, msg, html);

    expect(msg.text.split("\n\n")[0]).toBe(`${GOOD} [1]`);
    expect(msg.outcome).toBe("answered");
    expect(msg.sources).toEqual([
      expect.objectContaining({
        index: 1,
        verified: true,
        checks: {
          quote: "exact",
          support: "supports",
          treatment: "not_checked",
        },
      }),
    ]);
    expect(html).toContain("Checked against sources");
    expect(html).toContain(
      "Quote matches · supports the point · Later treatment not checked",
    );
  });

  it("zero support: a fixed explanation and exact excerpts, no drafted point", async () => {
    const { api, msg, html } = await run(
      scripted([
        { claim: "C1", status: "contradicted", reason: "no" },
        { claim: "C2", status: "contradicted", reason: "no" },
      ]),
    );
    expect(api.abstained).toBe(true);
    expect(api.checked.reason).toBe("no_supported_claims");
    expect(api.answer.summary).toBe(INSUFFICIENT_MESSAGE.no_supported_claims);
    expect(api.answer.analysis).toEqual([]);
    expect(presented(api)).not.toContain(GOOD);
    expect(msg.text).not.toContain(GOOD);
    expect(api.checked.excerpts.length).toBeGreaterThan(0);
    for (const e of api.checked.excerpts)
      expect(
        api.sources.find((s) => s.sourceId === e.sourceId)!.text,
      ).toContain(e.text);
    expect(msg.sources?.every((s) => !s.verified)).toBe(true);
    // Excerpt cards: quoted exactly, support not assessed.
    expect(
      msg.sources?.every(
        (s) =>
          s.checks?.quote === "exact" && s.checks.support === "not_checked",
      ),
    ).toBe(true);
    expect(html).toContain("No checked conclusion");
    expect(html).toContain("Quoted passages (not conclusions)");
    expectNoLeak(api, msg, html);
  });

  it("mismatched quotation: never a headline, only flagged for review", async () => {
    const { api, msg, html } = await run(
      scripted(
        [
          { claim: "C1", status: "supported", reason: "states the elements" },
          { claim: "C2", status: "contradicted", reason: "no" },
        ],
        "plaintiffs must always prove reliance and treble damages",
      ),
    );
    expect(api.checked.outcome).toBe("insufficient");
    expect(api.answer.summary).toBe(INSUFFICIENT_MESSAGE.no_supported_claims);
    expect(api.checked.points).toEqual([]);
    expect(api.checked.review).toEqual([
      expect.objectContaining({ claimId: "claim-1", quoteMismatch: true }),
    ]);
    expect(msg.text).toContain("Not confirmed: review before relying");
    expect(msg.text).toContain("a quotation did not match the source text");
    expect(msg.text.split("\n\n")[0]).toBe(
      INSUFFICIENT_MESSAGE.no_supported_claims,
    );
    expect(msg.sources?.[0].checks?.quote).toBe("mismatch");
    expect(msg.sources?.[0].verified).toBe(false);
    expectNoLeak(api, msg, html);
  });

  it("failed checker: nothing drafted is shown, the reason is specific", async () => {
    const { api, msg, html } = await run(scripted("throw"));
    expect(api.supportCheck).toBe("failed");
    expect(api.checked.reason).toBe("checker_failed");
    expect(api.answer.summary).toBe(INSUFFICIENT_MESSAGE.checker_failed);
    expect(api.checked.withheld.unchecked).toBe(2);
    expect(msg.text).not.toContain(GOOD);
    expect(html).not.toContain(GOOD);
    expect(msg.text).toMatch(
      /2 drafted points were left out because they could not be checked/,
    );
    expectNoLeak(api, msg, html);
  });
});

describe("renderers ignore stored text and recompute from claims", () => {
  it("an older result with an unchecked summary opens without it", () => {
    const legacy = {
      mode: "model",
      abstained: false,
      answer: {
        summary: DRAFT_SUMMARY,
        analysis: [{ text: BAD, claimIds: ["c1"] }],
        contraryAuthorities: [],
        limitations: [MODEL_LIMIT],
        nextSteps: [MODEL_STEP],
      },
      claims: [
        {
          id: "c1",
          text: BAD,
          sourceIds: ["s1"],
          quotes: [],
          verificationStatus: "unverified",
        },
      ],
      sources: [],
      rejectedSourceRefs: [],
      modelRuns: [],
      treatmentStatus: "not_checked",
    } satisfies Omit<ResearchResult, "checked">;
    const checked = checkAnswer(legacy);
    expect(checked.outcome).toBe("insufficient");
    const msg = toChatMessage(legacy, "old");
    for (const t of NEVER) expect(msg.text).not.toContain(t);
    expect(msg.text).toContain(
      "Later treatment of these sources has not been checked.",
    );
  });
});
