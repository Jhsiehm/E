import { describe, expect, it } from "vitest";
import { AiError, type CompleteRequest } from "@/lib/ai";
import { answerCaseQuestion } from "@/lib/legal/case-answer";
import {
  documentSources,
  matterSource,
  selectPassages,
  type DocChunk,
} from "@/lib/legal/case-passages";
import { fallbackPlan, planCaseQuestion } from "@/lib/legal/case-plan";
import { toChatMessage } from "@/lib/legal/chat-message";
import type { Complete } from "@/lib/legal/model";

const facts = {
  id: "m-1",
  name: "Rivera v. Northside Properties",
  docket: "Index No. 12345/2026",
  court: "Supreme Court, Kings County",
  practiceArea: "NY civil litigation",
  partyRole: "Plaintiff",
  status: "active",
  summary: "Tenant sues landlord over a withheld security deposit.",
  strategy: "",
  deadlines: [{ title: "Answer due", dueOn: "2026-12-01" }],
};

const chunk = (
  doc: string,
  ordinal: number,
  body: string,
  page = ordinal + 1,
): DocChunk => ({
  documentId: doc,
  documentName: doc === "lease" ? "Lease" : "Demand letter",
  ext: "pdf",
  page,
  ordinal,
  body,
});

/** A fake model: returns canned output per task and records every call. */
function fakeModel(outputs: Partial<Record<string, unknown>>) {
  const calls: CompleteRequest<unknown>[] = [];
  const complete = (async (r: CompleteRequest<unknown>) => {
    calls.push(r);
    if (!(r.task in outputs)) throw new AiError("not_configured", "no key");
    const raw = outputs[r.task];
    const parse =
      typeof r.responseSchema === "function"
        ? r.responseSchema
        : r.responseSchema?.parse;
    return {
      output: parse ? parse(raw) : raw,
      modelId: `model-for-${r.task}`,
      provider: "test",
      costUsd: 0.01,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }) as unknown as Complete;
  return { complete, calls };
}

describe("matter chat: which case text the AI sees", () => {
  it("shows a small case whole, in reading order", () => {
    const chunks = [
      chunk("lease", 1, "Deposit of $3,000."),
      chunk("lease", 0, "Lease between Rivera and Northside."),
    ];
    expect(selectPassages(chunks, "anything").map((c) => c.ordinal)).toEqual([
      0, 1,
    ]);
  });

  it("in a large case, picks matching passages plus the opening of every document", () => {
    const filler = (i: number) => `Boilerplate clause ${i}. `.repeat(80);
    const chunks = [
      ...Array.from({ length: 40 }, (_, i) =>
        chunk(
          "lease",
          i,
          i === 23
            ? "The security deposit shall be returned within 14 days."
            : filler(i),
        ),
      ),
      chunk("letter", 0, "Demand for return of deposit."),
    ];
    const picked = selectPassages(
      chunks,
      "when must the security deposit be returned",
      {
        maxChars: 8000,
        maxPassages: 6,
      },
    );
    const keys = picked.map((c) => `${c.documentId}:${c.ordinal}`);
    expect(keys).toContain("lease:23");
    expect(keys).toContain("lease:0");
    expect(keys).toContain("letter:0");
    expect(picked.reduce((n, c) => n + c.body.length, 0)).toBeLessThanOrEqual(
      8000,
    );
  });

  it("case details become source M1 and skip empty fields", () => {
    const m = matterSource(facts);
    expect(m.label).toBe("M1");
    expect(m.text).toContain("Our client's side: Plaintiff");
    expect(m.text).toContain("2026-12-01: Answer due");
    expect(m.text).not.toContain("Strategy notes");
  });
});

describe("matter chat: follow-up questions", () => {
  const turns = [
    {
      role: "user" as const,
      text: "What does the lease say about the deposit?",
    },
    { role: "agent" as const, text: "It must be returned within 14 days [1]." },
  ];

  it("without a model, folds a short follow-up into the last question", () => {
    const p = fallbackPlan("And what if they kept it longer?", turns);
    expect(p.question).toContain("What does the lease say about the deposit?");
    expect(p.searchLaw).toBe(false);
    expect(fallbackPlan("Is there case law on this?", turns).searchLaw).toBe(
      true,
    );
    expect(fallbackPlan("Thoughts on this case?", []).question).toBe(
      "Thoughts on this case?",
    );
  });

  it("uses the model's rewrite and sends it the conversation", async () => {
    const { complete, calls } = fakeModel({
      "research.route": {
        question:
          "What happens if the landlord kept the deposit longer than 14 days?",
        searchLaw: true,
        lawQuery: "security deposit return 14 days GOL 7-108",
      },
    });
    const plan = await planCaseQuestion("And if they kept it longer?", turns, {
      complete,
      matterName: facts.name,
    });
    expect(plan.searchLaw).toBe(true);
    expect(plan.question).toMatch(/longer than 14 days/);
    expect(calls[0].task).toBe("research.route");
    expect(JSON.stringify(calls[0].messages)).toContain(
      "returned within 14 days",
    );
  });

  it("falls back to rules when the model fails", async () => {
    const { complete } = fakeModel({});
    const plan = await planCaseQuestion("Thoughts on this case?", [], {
      complete,
      matterName: "x",
    });
    expect(plan).toEqual({
      question: "Thoughts on this case?",
      searchLaw: false,
      lawQuery: "Thoughts on this case?",
    });
  });
});

describe("matter chat: answers grounded in the case", () => {
  const passages = [
    chunk(
      "lease",
      0,
      "Tenant paid a security deposit of $3,000 on March 1, 2025.",
    ),
    chunk(
      "letter",
      0,
      "Northside has not returned the deposit as of June 30, 2026.",
    ),
  ];
  const sources = [matterSource(facts), ...documentSources("m-1", passages)];
  const turns = [{ role: "user" as const, text: "Who is our client?" }];

  it("drafts from documents, checks each point, and names the document and page", async () => {
    const { complete, calls } = fakeModel({
      "research.document_qa": {
        summary: "Our client has a straightforward deposit claim.",
        analysis: [
          {
            text: "Rivera paid a $3,000 deposit.",
            sources: ["D1"],
            quotes: [{ source: "D1", text: "security deposit of $3,000" }],
          },
          { text: "A made-up point.", sources: ["D9"], quotes: [] },
        ],
        contrary: [],
        limitations: [],
        nextSteps: ["Research the statutory deadline for returning deposits."],
        insufficient: false,
      },
      "research.verify_support": {
        verdicts: [
          { claim: "C1", status: "supported", reason: "Stated in the lease." },
        ],
      },
    });
    const r = await answerCaseQuestion(
      "Thoughts on this case?",
      sources,
      turns,
      {
        complete,
        notes: ["1 document is still being read and was not included."],
      },
    );
    expect(calls.map((c) => c.task)).toEqual([
      "research.document_qa",
      "research.verify_support",
    ]);
    // The conversation goes to the drafting model as context.
    expect(JSON.stringify(calls[0].messages)).toContain("Who is our client?");
    expect(r.claims[0].verificationStatus).toBe("supported");
    expect(r.claims[0].quotes[0].check.status).not.toBe("mismatch");
    expect(r.claims[1].verificationStatus).toBe("no_source");
    expect(r.rejectedSourceRefs).toEqual(["D9"]);
    expect(r.abstained).toBe(false);

    const msg = toChatMessage(r, "a1");
    expect(msg.text).toContain("Rivera paid a $3,000 deposit. [1]");
    expect(msg.sources?.[0]).toMatchObject({
      title: "Lease.pdf",
      meta: "page 1",
      href: "/matters/m-1/documents",
    });
    expect(msg.text).toContain("still being read");
  });

  it("uses the drafting model for law and notes later treatment is unchecked", async () => {
    const law = {
      ...sources[1],
      label: "S1",
      kind: "law" as const,
      title: "Some opinion",
    };
    const { complete, calls } = fakeModel({
      "research.draft": {
        summary: "s",
        analysis: [{ text: "x", sources: ["S1"], quotes: [] }],
        contrary: [],
        limitations: [],
        nextSteps: [],
        insufficient: false,
      },
    });
    const r = await answerCaseQuestion("q", [...sources, law], [], {
      complete,
    });
    expect(calls[0].task).toBe("research.draft");
    expect(r.answer.limitations.join(" ")).toMatch(/Later treatment/);
  });

  it("with no AI key, quotes the documents and draws no conclusions", async () => {
    const { complete } = fakeModel({});
    const r = await answerCaseQuestion("Thoughts on this case?", sources, [], {
      complete,
    });
    expect(r.mode).toBe("extractive");
    expect(r.claims.map((c) => c.sourceIds[0])).toEqual(["D1", "D2"]);
    expect(r.answer.summary).toMatch(/quotations, not conclusions/);
  });
});
