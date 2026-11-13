/** Shapes of a research answer and of the model draft it is built from. */
import type { QuoteCheck } from "./verify";
import type { LegalModelTask } from "./model";

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
