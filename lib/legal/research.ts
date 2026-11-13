/**
 * Research answer assembly over retrieved evidence (04 steps 6-7).
 *
 * The model only ever sees short labels (S1, S2, ...) for passages the server
 * retrieved, and may only cite those labels. The server maps labels back to
 * passage IDs, drops anything else, checks every quote against the passage
 * text, and runs an independent support check. With no model configured the
 * answer is extractive: quoted passages, no legal conclusions.
 */
import {
  AiError,
  RunBudget,
  type Complete,
  type CompleteResult,
  type LegalModelTask,
} from "./model";
import type { Evidence, RetrievalResult } from "./retrieve";
import { checkQuote } from "./verify";
import {
  parseDraft,
  parseVerdicts,
  type SupportVerdict,
} from "./research-parse";
import {
  DRAFT_SYSTEM,
  PROMPT_VERSION,
  VERIFY_PROMPT_VERSION,
  VERIFY_SYSTEM,
  fence,
  sourcesBlock,
} from "./research-prompts";
import type {
  Claim,
  Draft,
  DraftItem,
  ModelRun,
  ResearchResult,
  SourceCard,
} from "./research-types";

export * from "./research-types";
export { parseDraft, parseVerdicts } from "./research-parse";
export { PROMPT_VERSION, VERIFY_PROMPT_VERSION } from "./research-prompts";

export interface ResearchOptions {
  complete?: Complete;
  /** Per-call USD ceiling. */
  /** Shared run budget (e.g. RunBudget.fromAgentProfile) or a USD ceiling for the whole run. */
  budgetUsd?: RunBudget | number;
  signal?: AbortSignal;
  /** Skip the separate support-check call (e.g. tight budget). */
  skipSupportCheck?: boolean;
}

function sourceCard(e: Evidence): SourceCard {
  return {
    sourceId: e.sourceId,
    authorityId: e.authority.id,
    title: e.authority.title,
    citation: e.authority.citations[0]?.cite ?? null,
    court: e.authority.court?.name ?? null,
    decisionDate: e.authority.decisionDate,
    pinpoint: e.passage.pinpoint,
    url: e.authority.provenance.canonicalUrl,
    provider: e.authority.provenance.provider,
    versionId: e.authority.provenance.versionId,
    checksum: e.authority.provenance.checksum,
    fetchedAt: e.authority.provenance.fetchedAt,
    licenseStatus: e.authority.provenance.licenseStatus,
    text: e.passage.text,
  };
}

function baseLimitations(r: RetrievalResult): string[] {
  const out = [
    "Subsequent treatment (later citing, limiting or overruling decisions) has not been checked.",
  ];
  if (r.unresolvedCitations.length)
    out.push(
      `Could not resolve: ${r.unresolvedCitations.join("; ")}. These were not used.`,
    );
  for (const e of r.providerErrors)
    out.push(`Source ${e.provider} was unavailable during this search.`);
  if (r.coverage.some((c) => c.stale))
    out.push("At least one source's coverage is degraded or stale.");
  if (
    r.evidence.some((e) => e.authority.provenance.licenseStatus === "synthetic")
  )
    out.push("Sources are synthetic fixtures, not real law.");
  return out;
}

function extractive(question: string, r: RetrievalResult): ResearchResult {
  const sources = r.evidence.map(sourceCard);
  const claims: Claim[] = r.evidence.slice(0, 6).map((e, i) => {
    const first =
      e.passage.text.match(/^.{20,400}?[.?!](?=\s|$)/)?.[0] ??
      e.passage.text.slice(0, 300);
    return {
      id: `claim-${i + 1}`,
      text: `${e.authority.title}${e.passage.pinpoint ? `, ${e.passage.pinpoint}` : ""}: “${first}”`,
      sourceIds: [e.sourceId],
      quotes: [
        {
          sourceId: e.sourceId,
          text: first,
          check: checkQuote(first, e.passage.text),
        },
      ],
      // A verbatim quote is not a legal conclusion; support stays unverified.
      verificationStatus: "unverified",
    };
  });
  const abstained = claims.length === 0;
  return {
    mode: "extractive",
    abstained,
    answer: {
      summary: abstained
        ? "No matching passages were found in the enabled sources for this question."
        : `The most relevant passages found for: “${question.slice(0, 200)}”. No AI analysis was run, so these are quotations, not conclusions.`,
      analysis: claims.map((c) => ({ text: c.text, claimIds: [c.id] })),
      contraryAuthorities: [],
      limitations: [
        "No AI model is configured; this is an extractive result.",
        ...baseLimitations(r),
      ],
      nextSteps: abstained
        ? ["Try different terms, a citation, or another jurisdiction."]
        : ["Read the full sources and confirm how each applies to the facts."],
    },
    claims,
    sources,
    rejectedSourceRefs: [],
    modelRuns: [],
    treatmentStatus: "not_checked",
  };
}

const run = (
  task: LegalModelTask,
  promptVersion: string,
  r: CompleteResult<unknown>,
): ModelRun => ({
  task,
  modelId: r.modelId,
  provider: r.provider ?? "unknown",
  costUsd: r.costUsd,
  promptVersion,
});

export async function answerQuestion(
  question: string,
  retrieval: RetrievalResult,
  opts: ResearchOptions = {},
): Promise<ResearchResult> {
  if (!opts.complete || retrieval.evidence.length === 0)
    return extractive(question, retrieval);
  const complete = opts.complete;
  // One budget across the draft and the support check.
  const budgetUsd =
    opts.budgetUsd instanceof RunBudget
      ? opts.budgetUsd
      : new RunBudget(opts.budgetUsd ?? 1.5);

  const labels = new Map<string, string>();
  const byLabel = new Map<string, Evidence>();
  retrieval.evidence.forEach((e, i) => {
    labels.set(e.sourceId, `S${i + 1}`);
    byLabel.set(`S${i + 1}`, e);
  });

  let draftRes: CompleteResult<Draft>;
  try {
    draftRes = await complete<Draft>({
      task: "research.draft",
      promptVersion: PROMPT_VERSION,
      budgetUsd,
      signal: opts.signal,
      responseSchema: { parse: parseDraft },
      messages: [
        { role: "system", content: DRAFT_SYSTEM },
        {
          role: "user",
          content: `Question: ${fence(question)}\n\nSources:\n${sourcesBlock(retrieval.evidence, labels)}`,
        },
      ],
    });
  } catch (err) {
    // No AI key configured: still answer, extractively, and say why.
    if (err instanceof AiError && err.code === "not_configured") {
      const r = extractive(question, retrieval);
      r.answer.limitations[0] =
        "No AI model is configured (no OpenRouter/Anthropic key); this is an extractive result.";
      return r;
    }
    throw err;
  }
  const modelRuns = [run("research.draft", PROMPT_VERSION, draftRes)];
  const draft = draftRes.output;
  const rejected = new Set<string>();

  let n = 0;
  const toClaims = (items: DraftItem[]): Claim[] =>
    items.map((it) => {
      const ev = it.sources.map((s) => {
        const e = byLabel.get(s.trim().toUpperCase());
        if (!e) rejected.add(s);
        return e;
      });
      const valid = ev.filter((e): e is Evidence => !!e);
      const quotes = it.quotes.flatMap((q) => {
        const e = byLabel.get(q.source.trim().toUpperCase());
        if (!e) {
          rejected.add(q.source);
          return [];
        }
        return [
          {
            sourceId: e.sourceId,
            text: q.text,
            check: checkQuote(q.text, e.passage.text),
          },
        ];
      });
      return {
        id: `claim-${++n}`,
        text: it.text,
        sourceIds: [...new Set(valid.map((e) => e.sourceId))],
        quotes,
        verificationStatus: valid.length ? "unverified" : "no_source",
      };
    });

  const analysisClaims = toClaims(draft.analysis);
  const contraryClaims = toClaims(draft.contrary);
  const claims = [...analysisClaims, ...contraryClaims];

  // Independent support check for claims that have sources.
  const checkable = claims.filter((c) => c.sourceIds.length);
  if (checkable.length && !opts.skipSupportCheck) {
    const passages = new Map(retrieval.evidence.map((e) => [e.sourceId, e]));
    const used = [...new Set(checkable.flatMap((c) => c.sourceIds))].map((id) =>
      passages.get(id)!,
    );
    const body = checkable
      .map(
        (c, i) =>
          `C${i + 1}: ${fence(c.text)}\nCited: ${c.sourceIds.map((id) => labels.get(id)).join(", ")}`,
      )
      .join("\n\n");
    try {
      const v = await complete<SupportVerdict[]>({
        task: "research.verify_support",
        promptVersion: VERIFY_PROMPT_VERSION,
        budgetUsd,
        signal: opts.signal,
        responseSchema: { parse: parseVerdicts },
        messages: [
          { role: "system", content: VERIFY_SYSTEM },
          {
            role: "user",
            content: `Claims:\n${body}\n\nSources:\n${sourcesBlock(used, labels)}`,
          },
        ],
      });
      modelRuns.push(run("research.verify_support", VERIFY_PROMPT_VERSION, v));
      for (const verdict of v.output) {
        const c = checkable[Number(verdict.claim.replace(/\D/g, "")) - 1];
        if (!c) continue;
        c.verificationStatus = verdict.status;
        c.supportReason = verdict.reason;
      }
    } catch {
      // Support check failed: claims stay "unverified" and the answer says so.
    }
  }
  // A quote that does not match its source can never count as support.
  for (const c of claims)
    if (
      c.quotes.some((q) => q.check.status === "mismatch") &&
      c.verificationStatus === "supported"
    )
      c.verificationStatus = "partially_supported";

  const supported = analysisClaims.filter(
    (c) =>
      c.verificationStatus === "supported" ||
      c.verificationStatus === "partially_supported",
  );
  const abstained = draft.insufficient || supported.length === 0;
  const limitations = [...draft.limitations, ...baseLimitations(retrieval)];
  if (claims.some((c) => c.verificationStatus === "unverified"))
    limitations.push(
      "Some points could not be verified against their sources and are marked unverified.",
    );
  if (rejected.size)
    limitations.push(
      "The draft cited sources that were not retrieved; those citations were removed.",
    );
  if (claims.some((c) => c.quotes.some((q) => q.check.status === "mismatch")))
    limitations.push(
      "At least one quotation did not match its source text and is flagged.",
    );

  return {
    mode: "model",
    abstained,
    answer: {
      summary: abstained
        ? `The retrieved sources do not support a confident answer. ${draft.summary}`.trim()
        : draft.summary,
      analysis: analysisClaims.map((c) => ({ text: c.text, claimIds: [c.id] })),
      contraryAuthorities: contraryClaims.map((c) => ({
        text: c.text,
        claimIds: [c.id],
      })),
      limitations,
      nextSteps: draft.nextSteps,
    },
    claims,
    sources: retrieval.evidence.map(sourceCard),
    rejectedSourceRefs: [...rejected],
    modelRuns,
    treatmentStatus: "not_checked",
  };
}
