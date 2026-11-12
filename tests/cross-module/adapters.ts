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
import { loadModule } from "../shared/pending";

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
  /** AI function id from the routing table, e.g. "research.plan". */
  task: string;
  prompt: string;
  /** Per-run budget in USD. */
  budgetUsd?: number;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export interface RoutingResult {
  ok: boolean;
  modelUsed?: string;
  fellBack?: boolean;
  costUsd?: number;
  text?: string;
  /** Typed error code from the module, or "untyped:<Name>" if a raw error escaped. */
  error?: string;
  errorMessage?: string;
}

export interface RoutingAdapter {
  owner: string;
  tasks: string[];
  dataClass(task: string): "public" | "confidential";
  structured(task: string): boolean;
  /** Pure routing decision. Throws when the configuration is refused. */
  plan(req: RoutingRequest): { primary: string; fallbacks: string[] };
  /** Full call path with an injected fetch. */
  run(
    req: RoutingRequest,
    fake: ReturnType<typeof scriptedFetch>,
  ): Promise<RoutingResult>;
  /** Models that may receive confidential matter content. */
  approvedForConfidential: string[];
  /** Run two calls against one shared run budget. */
  runShared?(
    reqs: RoutingRequest[],
    limitUsd: number,
    fake: ReturnType<typeof scriptedFetch>,
  ): Promise<RoutingResult[]>;
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
  // PR #3 "Add AI model routing by cost tier (OpenRouter)"
  const ai = await loadModule<AiModule>("lib/ai/index");
  if (!ai) return null;
  const baseEnv = { OPENROUTER_API_KEY: "sk-or-test-key" };
  const toResult = (e: unknown): RoutingResult =>
    e instanceof ai.AiError
      ? { ok: false, error: e.code, errorMessage: e.message }
      : {
          ok: false,
          error: `untyped:${(e as Error)?.name ?? typeof e}`,
          errorMessage: (e as Error)?.message,
        };
  const call = async (
    req: RoutingRequest,
    fake: ReturnType<typeof scriptedFetch>,
    budget?: unknown,
  ): Promise<RoutingResult> => {
    try {
      const r = await ai.runAiFunction(
        req.task,
        {
          messages: [{ role: "user", content: req.prompt }],
          budget:
            budget ??
            (req.budgetUsd !== undefined
              ? new ai.RunBudget(req.budgetUsd)
              : undefined),
          signal: req.signal,
        },
        {
          env: { ...baseEnv, ...req.env },
          fetch: fake.fetch,
          sleep: async () => {},
          random: () => 0,
        },
      );
      return {
        ok: true,
        modelUsed: r.usage.modelUsed,
        fellBack: r.usage.fellBack,
        costUsd: r.usage.costUsd,
        text: r.text,
      };
    } catch (e) {
      return toResult(e);
    }
  };
  return {
    owner: THREADS.routing,
    tasks: Object.keys(ai.AI_FUNCTIONS),
    dataClass: (t) => ai.AI_FUNCTIONS[t].dataClass,
    structured: (t) => ai.AI_FUNCTIONS[t].structuredOutput,
    plan(req) {
      const r = ai.resolveRoute(req.task, { ...baseEnv, ...req.env });
      return { primary: r.chain[0], fallbacks: r.chain.slice(1) };
    },
    run: (req, fake) => call(req, fake),
    approvedForConfidential: Object.values(ai.MODELS)
      .filter((m) => m.maxDataClass === "confidential")
      .map((m) => m.id),
    async runShared(reqs, limitUsd, fake) {
      const budget = new ai.RunBudget(limitUsd);
      const out = [];
      for (const r of reqs) out.push(await call(r, fake, budget));
      return out;
    },
  };
}

// Minimal structural view of lib/ai so this file typechecks before it lands.
interface AiModule {
  AiError: new (...a: never[]) => Error & { code: string };
  RunBudget: new (limitUsd: number) => unknown;
  AI_FUNCTIONS: Record<
    string,
    { dataClass: "public" | "confidential"; structuredOutput: boolean }
  >;
  MODELS: Record<string, { id: string; maxDataClass: string }>;
  resolveRoute(
    key: string,
    env: Record<string, string | undefined>,
  ): { chain: string[] };
  runAiFunction(
    key: string,
    opts: Record<string, unknown>,
    deps: Record<string, unknown>,
  ): Promise<{
    text: string;
    usage: { modelUsed: string; fellBack: boolean; costUsd: number };
  }>;
}

export async function experienceAdapter(): Promise<ExperienceAdapter | null> {
  return null; // waiting for onboarding experience levels
}
