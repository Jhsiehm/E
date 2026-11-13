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
  system?: string;
}

export interface RoutingResult {
  ok: boolean;
  modelUsed?: string;
  fellBack?: boolean;
  gateway?: string;
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
  vendorOf(model: string): string | undefined;
  /** Task this task's model must be independent of (different vendor). */
  independentOf(task: string): string | undefined;
  /** Run two calls against one shared run budget. */
  runShared?(
    reqs: RoutingRequest[],
    limitUsd: number,
    fake: ReturnType<typeof scriptedFetch>,
  ): Promise<RoutingResult[]>;
}

export interface ExperienceAdapter {
  owner: string;
  levels: string[];
  roles: string[];
  allFeatures: string[];
  levelFor(ai: string | null | undefined): string;
  features(ctx: { level: string; role: string; isAdmin?: boolean }): string[];
}

export interface AgentConfigLite {
  key: string;
  verification: Record<string, unknown>;
  tiers: Record<"plan" | "rerank" | "draft" | "verify", string>;
  budgets: { maxUSDPerRun: number };
}

export interface AgentsAdapter {
  owner: string;
  catalog: AgentConfigLite[];
  validate(cfg: AgentConfigLite): { path: string; message: string }[];
}

export const THREADS = {
  auth: "Matters database and access rules (bedrock 1)",
  sources: "Legal data retrieval",
  routing: "AI model routing",
  agents: "Specialized legal agents",
} as const;

// ---- Wiring (update as branches land) -------------------------------------

export async function authAdapter(): Promise<AuthAdapter | null> {
  // Bedrock 1: RLS on a real Postgres. Needs CASEVEX_TEST_DATABASE_URL.
  if (!process.env.CASEVEX_TEST_DATABASE_URL) return null;
  const { dbAuthAdapter } = await import("../db/auth-adapter");
  return dbAuthAdapter();
}

export { citationAdapter } from "./citation-adapter";

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
          messages: [
            ...(req.system
              ? [{ role: "system" as const, content: req.system }]
              : []),
            { role: "user" as const, content: req.prompt },
          ],
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
        gateway: r.usage.gateway,
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
    vendorOf: (m) => ai.MODELS[m]?.vendor,
    independentOf: (t) => ai.AI_FUNCTIONS[t].independentOf,
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
    {
      dataClass: "public" | "confidential";
      structuredOutput: boolean;
      independentOf?: string;
    }
  >;
  MODELS: Record<string, { id: string; maxDataClass: string; vendor: string }>;
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
    usage: {
      modelUsed: string;
      fellBack: boolean;
      costUsd: number;
      gateway?: string;
    };
  }>;
}

export async function experienceAdapter(): Promise<ExperienceAdapter | null> {
  // PR #7 "Agent catalog ... and AI experience levels" (lib/agents)
  const m = await loadModule<{
    levelFor(ai: string | null | undefined): string;
    featuresFor(ctx: {
      level: string;
      role: string;
      isAdmin?: boolean;
    }): string[];
    FEATURE_LEVEL: Record<string, string>;
    LEVEL_FOR: Record<string, string>;
  }>("lib/agents/experience");
  if (!m) return null;
  return {
    owner: THREADS.agents,
    levels: [...new Set(Object.values(m.LEVEL_FOR))],
    roles: ["attorney", "paralegal", "student", "other"],
    allFeatures: Object.keys(m.FEATURE_LEVEL),
    levelFor: m.levelFor,
    features: m.featuresFor,
  };
}

export async function agentsAdapter(): Promise<AgentsAdapter | null> {
  const m = await loadModule<{
    AGENT_CATALOG: AgentConfigLite[];
    validateAgentConfig(
      a: AgentConfigLite,
    ): { path: string; message: string }[];
  }>("lib/agents/index");
  if (!m) return null;
  return {
    owner: THREADS.agents,
    catalog: [...m.AGENT_CATALOG],
    validate: m.validateAgentConfig,
  };
}
