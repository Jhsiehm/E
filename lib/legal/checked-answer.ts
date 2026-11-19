/**
 * The checked answer: the only representation a screen, export or saved
 * finding may build substantive text from.
 *
 * A research result carries the model's draft claims and how each one fared
 * in the checks. This module selects, deterministically, the claims that are
 * eligible to be stated as an answer:
 *
 *   - the independent support check said "supported", and
 *   - at least one cited source is one the server issued for this run, and
 *   - at least one quotation from a cited source matched its passage, and
 *   - no quotation in the claim failed to match.
 *
 * The opening summary is those claim sentences, verbatim, each with its claim
 * and source IDs. The model's own free-text summary, limitations and next
 * steps are never shown: they are not individually checked. When nothing is
 * eligible the answer is a fixed explanation for the specific reason, plus
 * passages quoted exactly from the sources and labelled as such.
 *
 * Source identity, quotation match, claim support and later treatment are
 * reported separately per source; there is no single "verified" flag.
 */
import type {
  Claim,
  ClaimStatus,
  ResearchResult,
  SourceCard,
} from "./research-types";
import { checkQuote } from "./verify";

/** A result before (or regardless of) its attached checked answer. */
type Unchecked = Omit<ResearchResult, "checked">;

export type InsufficientReason =
  | "no_sources" // nothing was retrieved
  | "no_model" // extractive mode: quotations only
  | "model_insufficient" // the draft itself said the sources do not answer
  | "checker_failed" // the support check did not run or returned nothing
  | "no_supported_claims"; // the check ran and nothing passed

export interface CheckedSentence {
  claimId: string;
  text: string;
  sourceIds: string[];
}

export interface ReviewItem {
  claimId: string;
  /** The draft's wording, kept only for attorney review, never as an answer. */
  text: string;
  status: ClaimStatus;
  reason: string | null;
  quoteMismatch: boolean;
  sourceIds: string[];
}

export interface Excerpt {
  sourceId: string;
  /** Verbatim text from the source passage. */
  text: string;
}

export type QuoteMatch = "exact" | "close" | "mismatch" | "not_quoted";
export type SupportOutcome =
  "supports" | "partial" | "does_not_support" | "not_checked";

export interface SourceChecks {
  sourceId: string;
  /** Provider record this source was resolved to (always server-issued). */
  identity: { provider: string; authorityId: string; versionId: string };
  quote: QuoteMatch;
  support: SupportOutcome;
  treatment: "not_checked";
}

export interface CheckedAnswer {
  outcome: "answered" | "insufficient";
  reason: InsufficientReason | null;
  /** Deterministic text: the eligible sentences, or the fixed explanation. */
  summary: string;
  /** Summary sentences, each traceable to claims and sources. */
  summarySentences: CheckedSentence[];
  /** Every eligible analysis claim (summarySentences is the first few). */
  points: CheckedSentence[];
  /** Eligible claims from authority that cuts the other way. */
  contrary: CheckedSentence[];
  /** Partially supported claims, for detailed attorney review only. */
  review: ReviewItem[];
  /** Counts of draft claims withheld entirely, by why. */
  withheld: {
    contradicted: number;
    unchecked: number;
    noSource: number;
    quoteMismatch: number;
  };
  /** Labelled original excerpts shown when no conclusion is given. */
  excerpts: Excerpt[];
  sourceChecks: SourceChecks[];
  /** Server-defined next steps; never model text. */
  nextSteps: string[];
}

const SUMMARY_SENTENCES = 3;
const MAX_EXCERPTS = 4;

export const INSUFFICIENT_MESSAGE: Record<InsufficientReason, string> = {
  no_sources:
    "No passages in the enabled sources matched this question, so Casevex has no answer to give.",
  no_model:
    "No AI analysis was run. These are the most relevant passages, quoted exactly from the sources. They are quotations, not conclusions.",
  model_insufficient:
    "The sources found do not answer this question, so Casevex is not giving a conclusion. The closest passages are quoted below.",
  checker_failed:
    "The independent source check did not complete, so no drafted point can be given as a conclusion. The passages found are quoted below.",
  no_supported_claims:
    "None of the drafted points passed the source check, so Casevex is not giving a conclusion. The closest passages are quoted below.",
};

const NEXT_STEPS: Record<CheckedAnswer["outcome"], string[]> = {
  answered: [
    "Open each cited source and read the passage in context before relying on it.",
  ],
  insufficient: [
    "Try narrower terms, a specific citation, or another jurisdiction.",
  ],
};

const matched = (c: Claim) =>
  c.quotes.some(
    (q) => q.check.status !== "mismatch" && c.sourceIds.includes(q.sourceId),
  );
const mismatched = (c: Claim) =>
  c.quotes.some((q) => q.check.status === "mismatch");

/** True when a claim may be stated as an answer (see the module comment). */
export function isEligible(c: Claim, issued: Set<string>): boolean {
  return (
    c.verificationStatus === "supported" &&
    c.sourceIds.some((s) => issued.has(s)) &&
    matched(c) &&
    !mismatched(c)
  );
}

function firstSentence(text: string): string {
  const t = text.trim();
  return (
    t.match(/^[\s\S]{20,400}?[.?!](?=\s|$)/)?.[0] ?? t.slice(0, 300)
  ).trim();
}

/** Passages quoted exactly; each is re-checked against its source text. */
function excerptsFrom(sources: SourceCard[]): Excerpt[] {
  return sources
    .slice(0, MAX_EXCERPTS)
    .map((s) => ({ s, text: firstSentence(s.text) }))
    .filter(
      ({ s, text }) => text && checkQuote(text, s.text).status === "exact",
    )
    .map(({ s, text }) => ({ sourceId: s.sourceId, text }));
}

function supportCheckRan(r: Unchecked, sourced: Claim[]): boolean {
  if (r.supportCheck) return r.supportCheck === "completed";
  // Older results: the check ran if it reached any verdict.
  return sourced.some((c) => c.verificationStatus !== "unverified");
}

function contraryIds(r: Unchecked): Set<string> {
  return new Set(r.answer.contraryAuthorities.flatMap((p) => p.claimIds));
}

function sourceChecks(
  r: Unchecked,
  shown: Claim[],
  eligible: Set<string>,
  excerpts: Excerpt[],
): SourceChecks[] {
  const quoted = new Set(excerpts.map((e) => e.sourceId));
  return r.sources.map((s) => {
    const citing = shown.filter((c) => c.sourceIds.includes(s.sourceId));
    const quotes = citing.flatMap((c) =>
      c.quotes.filter((q) => q.sourceId === s.sourceId),
    );
    // An excerpt is quoted exactly by construction (excerptsFrom).
    const quote: QuoteMatch = !quotes.length
      ? quoted.has(s.sourceId)
        ? "exact"
        : "not_quoted"
      : quotes.some((q) => q.check.status === "mismatch")
        ? "mismatch"
        : quotes.every((q) => q.check.status === "exact")
          ? "exact"
          : "close";
    const support: SupportOutcome = citing.some((c) => eligible.has(c.id))
      ? "supports"
      : citing.some((c) => c.verificationStatus === "partially_supported")
        ? "partial"
        : citing.some((c) => c.verificationStatus === "contradicted")
          ? "does_not_support"
          : "not_checked";
    return {
      sourceId: s.sourceId,
      identity: {
        provider: s.provider,
        authorityId: s.authorityId,
        versionId: s.versionId,
      },
      quote,
      support,
      treatment: "not_checked",
    };
  });
}

/**
 * Builds the checked answer from a result's claims. Never reads the result's
 * `answer.summary`, `limitations` or `nextSteps` text, so a renderer that
 * calls this cannot show an unchecked conclusion, whatever produced `r`.
 */
export function checkAnswer(r: Unchecked): CheckedAnswer {
  const issued = new Set(r.sources.map((s) => s.sourceId));
  const against = contraryIds(r);
  const eligible = new Set(
    r.claims.filter((c) => isEligible(c, issued)).map((c) => c.id),
  );
  const sentence = (c: Claim): CheckedSentence => ({
    claimId: c.id,
    text: c.text.trim(),
    sourceIds: c.sourceIds.filter((s) => issued.has(s)),
  });
  const points = r.claims
    .filter((c) => eligible.has(c.id) && !against.has(c.id))
    .map(sentence);
  const contrary = r.claims
    .filter((c) => eligible.has(c.id) && against.has(c.id))
    .map(sentence);
  const rest = r.claims.filter((c) => !eligible.has(c.id));
  const review: ReviewItem[] = rest
    .filter(
      (c) =>
        c.verificationStatus === "partially_supported" && r.mode === "model",
    )
    .map((c) => ({
      claimId: c.id,
      text: c.text.trim(),
      status: c.verificationStatus,
      reason: c.supportReason?.trim() || null,
      quoteMismatch: mismatched(c),
      sourceIds: c.sourceIds.filter((s) => issued.has(s)),
    }));
  const inReview = new Set(review.map((x) => x.claimId));
  const withheld = {
    contradicted: 0,
    unchecked: 0,
    noSource: 0,
    quoteMismatch: 0,
  };
  if (r.mode === "model")
    for (const c of rest) {
      if (inReview.has(c.id)) continue;
      if (c.verificationStatus === "contradicted") withheld.contradicted++;
      else if (!c.sourceIds.some((s) => issued.has(s))) withheld.noSource++;
      else if (mismatched(c)) withheld.quoteMismatch++;
      else withheld.unchecked++;
    }

  const sourced = r.claims.filter((c) => c.sourceIds.length);
  const reason: InsufficientReason | null = points.length
    ? null
    : !r.sources.length
      ? "no_sources"
      : r.mode === "extractive"
        ? "no_model"
        : r.draftInsufficient
          ? "model_insufficient"
          : sourced.length && !supportCheckRan(r, sourced)
            ? "checker_failed"
            : "no_supported_claims";

  const summarySentences = points.slice(0, SUMMARY_SENTENCES);
  const excerpts =
    reason && reason !== "no_sources" ? excerptsFrom(r.sources) : [];
  const shown = r.claims.filter(
    (c) => eligible.has(c.id) || inReview.has(c.id),
  );
  return {
    outcome: reason ? "insufficient" : "answered",
    reason,
    summary: reason
      ? INSUFFICIENT_MESSAGE[reason]
      : summarySentences.map((s) => s.text).join(" "),
    summarySentences,
    points,
    contrary,
    review,
    withheld,
    excerpts,
    sourceChecks: sourceChecks(r, shown, eligible, excerpts),
    nextSteps: NEXT_STEPS[reason ? "insufficient" : "answered"],
  };
}

/**
 * Attaches the checked answer and rewrites the legacy `answer` fields from
 * it, so API callers that read `answer.summary` get checked text too.
 * `answer.limitations` must already be server-written.
 */
export function withCheckedAnswer(r: Unchecked): ResearchResult {
  const checked = checkAnswer(r);
  const item = (s: CheckedSentence) => ({
    text: s.text,
    claimIds: [s.claimId],
  });
  return {
    ...r,
    abstained: checked.outcome === "insufficient",
    answer: {
      summary: checked.summary,
      analysis: checked.points.map(item),
      contraryAuthorities: checked.contrary.map(item),
      limitations: r.answer.limitations,
      nextSteps: checked.nextSteps,
    },
    checked,
  };
}
