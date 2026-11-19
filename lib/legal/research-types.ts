/** Shapes of a research answer and of the model draft it is built from. */
import type { QuoteCheck } from "./verify";
import type { LegalModelTask } from "./model";
import type { CheckedAnswer } from "./checked-answer";

export type ClaimStatus =
  | "supported"
  | "partially_supported"
  | "contradicted"
  | "unverified"
  | "no_source";

export interface Claim {
  id: string;
  text: string;
  sourceIds: string[];
  quotes: { sourceId: string; text: string; check: QuoteCheck }[];
  verificationStatus: ClaimStatus;
  supportReason?: string;
}

/**
 * Legacy answer shape (03 research detail). Every field is derived from the
 * checked answer: `summary` is eligible claim sentences or a fixed
 * explanation, `analysis` and `contraryAuthorities` list eligible claims
 * only, and `limitations` and `nextSteps` are written by the server.
 */
export interface ResearchAnswer {
  summary: string;
  analysis: { text: string; claimIds: string[] }[];
  contraryAuthorities: { text: string; claimIds: string[] }[];
  limitations: string[];
  nextSteps: string[];
}

export interface SourceCard {
  sourceId: string;
  authorityId: string;
  title: string;
  citation: string | null;
  court: string | null;
  decisionDate: string | null;
  pinpoint: string | null;
  url: string;
  provider: string;
  versionId: string;
  checksum: string;
  fetchedAt: string;
  licenseStatus: string;
  text: string;
}

export interface ModelRun {
  task: LegalModelTask;
  modelId: string;
  provider: string;
  costUsd: number;
  promptVersion: string;
}

export interface ResearchResult {
  mode: "model" | "extractive";
  abstained: boolean;
  answer: ResearchAnswer;
  claims: Claim[];
  sources: SourceCard[];
  /** Model output that cited labels the server never issued. */
  rejectedSourceRefs: string[];
  modelRuns: ModelRun[];
  treatmentStatus: "not_checked";
  /** Whether the independent support check ran. Absent on older results. */
  supportCheck?: "completed" | "failed" | "skipped";
  /** The draft said the sources do not answer the question. */
  draftInsufficient?: boolean;
  /**
   * The canonical answer every renderer uses (checked-answer.ts). Renderers
   * recompute it from `claims` rather than trust stored text.
   */
  checked: CheckedAnswer;
}

// --- model output shapes, validated by hand (no schema dependency) ----------

export interface DraftItem {
  text: string;
  sources: string[];
  quotes: { source: string; text: string }[];
}
export interface Draft {
  summary: string;
  analysis: DraftItem[];
  contrary: DraftItem[];
  limitations: string[];
  nextSteps: string[];
  insufficient: boolean;
}
