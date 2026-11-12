// One place that connects the cross-module suites to the real modules.
//
// Each adapter translates the shared fixtures into a call on the module under
// test. Until a module is merged (or while its exports are still moving), its
// adapter returns null and the suites that need it are skipped with a note.
// When a feature branch lands, wire its adapter here; the suites switch on.

import type { AccessCase, Decision } from "../shared/fixtures/access-matrix";
import type {
  CitationOutcome,
  CitationProbe,
} from "../shared/fixtures/citations";
import type { scriptedFetch } from "../shared/fakes/scripted-fetch";

export interface AuthAdapter {
  owner: string;
  /** Run one authorization decision through the real policy/route/RLS. */
  check(c: AccessCase): Promise<Decision>;
  /** A request with a forged or expired session must be rejected. */
  checkWithSession?(token: string | null, c: AccessCase): Promise<Decision>;
  /** Client claims a higher role (e.g. job title "Partner") — must not escalate. */
  checkWithClaimedRole?(c: AccessCase, claimedRole: string): Promise<Decision>;
}

export interface CitationAdapter {
  owner: string;
  verify(
    probe: CitationProbe,
  ): Promise<{ state: CitationOutcome; verified: boolean }>;
}

export interface RoutingRequest {
  /** AI function id from the routing table, e.g. "research.answer". */
  task: string;
  prompt: string;
  /** Matter-confidential content must stay on approved/no-retention models. */
  confidential?: boolean;
  /** Per-run budget in USD. */
  budgetUsd?: number;
  /** User's AI experience level from onboarding. */
  experience?: "new" | "some" | "regular";
}

export interface RoutingResult {
  ok: boolean;
  modelUsed?: string;
  attempted: string[];
  costUsd?: number;
  error?: string;
  text?: string;
}

export interface RoutingAdapter {
  owner: string;
  /** Pure routing decision: which model (and fallbacks) a task would use. */
  plan(req: RoutingRequest): Promise<{ primary: string; fallbacks: string[] }>;
  /** Full call path with an injected fetch. */
  run(
    req: RoutingRequest,
    fake: ReturnType<typeof scriptedFetch>,
  ): Promise<RoutingResult>;
  /** Models that may receive confidential matter content. */
  approvedForConfidential?: string[];
}

export interface ExperienceAdapter {
  owner: string;
  /** Feature flags the UI/agents enable for a given AI experience level. */
  featuresFor(level: "new" | "some" | "regular"): Promise<string[]> | string[];
}

export const THREADS = {
  auth: "Supabase sign-in and onboarding",
  sources: "Legal data retrieval",
  routing: "AI model routing",
} as const;

// ---- Wiring (update as branches land) -------------------------------------

export async function authAdapter(): Promise<AuthAdapter | null> {
  return null; // waiting for the P1 auth/RLS branch
}

export async function citationAdapter(): Promise<CitationAdapter | null> {
  return null; // waiting for the P3 retrieval/verification branch
}

export async function routingAdapter(): Promise<RoutingAdapter | null> {
  return null; // waiting for the OpenRouter routing branch
}

export async function experienceAdapter(): Promise<ExperienceAdapter | null> {
  return null; // waiting for onboarding experience levels
}
