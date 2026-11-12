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
  /** Feature flags the UI/agents enable for a given AI experience level. */
  featuresFor(level: "new" | "some" | "advanced"): Promise<string[]> | string[];
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
  // PR #5 "legal data retrieval" (lib/legal). The synthetic corpus is served
  // through a test LegalProviderAdapter whose citation index is an exact
  // lookup, like a real provider's. Everything after that (citation parsing,
  // unresolved handling, withdrawn exclusion, label issuing, rejection of
  // unissued labels, quote checking) is the module's own code.
  const [retrieveMod, researchMod, citeMod, storeMod] = await Promise.all([
    loadModule<{ retrieve: LegalRetrieve }>("lib/legal/retrieve"),
    loadModule<{ answerQuestion: LegalAnswer }>("lib/legal/research"),
    loadModule<{ extractCitations: (t: string) => { normalized: string }[] }>(
      "lib/legal/citations",
    ),
    loadModule<{ MemoryAuthorityStore: new () => unknown }>("lib/legal/store"),
  ]);
  if (!retrieveMod || !researchMod || !citeMod || !storeMod) return null;
  const { corpus } = await import("../shared/fixtures/citations");
  const { createHash } = await import("node:crypto");

  const citationShapes = (text: string) => [
    ...citeMod.extractCitations(text).map((c) => c.normalized),
    ...[...text.matchAll(/\b(\d+)\s+Synth\.\s+(\d+)\b/g)].map(
      (m) => `${m[1]} Synth. ${m[2]}`,
    ),
  ];
  const toAuthority = (a: (typeof corpus)[number]) => {
    const [volume, reporter, page] = [
      a.citation.split(" ")[0],
      a.citation.split(" ").slice(1, -1).join(" "),
      a.citation.split(" ").at(-1)!,
    ];
    const checksum = createHash("sha256")
      .update(a.passages.map((p) => p.text).join("\n\n"))
      .digest("hex");
    return {
      id: `fixture:${a.sourceId}`,
      kind: "opinion",
      title: a.title,
      citations: [{ cite: a.citation, volume, reporter, page }],
      court: { id: "synthetic", name: a.court },
      jurisdictionId: "NY",
      decisionDate: a.decided,
      docketNumber: null,
      textAvailability: "full_text",
      provenance: {
        provider: "fixture",
        providerRecordId: a.sourceId,
        canonicalUrl: a.url,
        sourceTimestamp: null,
        fetchedAt: new Date(0).toISOString(),
        checksum,
        versionId: a.version,
        publicationStatus: a.status === "withdrawn" ? "withdrawn" : "published",
        licenseStatus: "synthetic",
        attribution: "Casevex QA synthetic corpus",
      },
    };
  };
  const byRecord = (id: string) => {
    const a = corpus.find((x) => x.sourceId === id);
    if (!a)
      throw Object.assign(new Error(`not found ${id}`), { code: "not_found" });
    return a;
  };
  const provider = {
    id: "fixture",
    getCoverage: () => ({
      provider: "fixture",
      displayName: "QA synthetic corpus",
      enabled: true,
      disabledReason: null,
      kinds: ["opinion"],
      jurisdictionIds: ["NY"],
      scope: "QA synthetic corpus, not real law",
      treatmentCoverage: "none",
      lastSucceededAt: null,
      lastError: null,
      stale: false,
      termsUrl: "https://example.invalid/terms",
    }),
    async search(q: { q: string }) {
      const terms = q.q.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
      return corpus
        .map((a) => {
          const hay =
            `${a.title} ${a.passages.map((p) => p.text).join(" ")}`.toLowerCase();
          return { a, score: terms.filter((t) => hay.includes(t)).length };
        })
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score)
        .map((x, i) => ({
          authority: toAuthority(x.a),
          snippet: null,
          providerRank: i + 1,
        }));
    },
    async resolveCitations(text: string) {
      // Real reporters via the module's parser, plus the synthetic "Synth."
      // reporter the parser deliberately does not know (as in fixture.ts).
      return citationShapes(text).map((cite) => {
        const hit = corpus.filter((a) => a.citation === cite);
        return {
          citation: cite,
          normalized: cite,
          status: hit.length ? "resolved" : "unresolved",
          candidates: hit.map(toAuthority),
          provider: "fixture",
        };
      });
    },
    async fetchAuthority(id: string) {
      return toAuthority(byRecord(id));
    },
    async fetchFullText(id: string) {
      const a = byRecord(id);
      const authority = toAuthority(a);
      return {
        authority,
        passages: a.passages.map((p) => ({
          id: `${authority.id}#p${p.para}`,
          authorityId: authority.id,
          versionId: a.version,
          ordinal: p.para,
          pinpoint: `para ${p.para}`,
          text: p.text,
        })),
      };
    },
  };
  const registry = () => ({
    mode: "fixture",
    providers: [provider],
    enabled: [provider],
    get: () => provider,
    store: new storeMod.MemoryAuthorityStore(),
  });

  return {
    owner: THREADS.sources,
    async verify(probe) {
      const { citation, sourceId, quote } = probe.claimed;
      if (citation) {
        if (!citationShapes(citation).length)
          return { state: "incorrect_citation", verified: false };
        const r = await retrieveMod.retrieve(registry(), {
          question: citation,
        });
        if (
          r.unresolvedCitations.length ||
          r.citations.some((c) => c.status !== "resolved")
        )
          return { state: "unavailable", verified: false };
        const ids = r.citations
          .filter((c) => c.status === "resolved")
          .flatMap((c) => c.candidates.map((a) => a.id));
        const usable = ids.filter((id) =>
          r.authorities.some((a) => a.id === id),
        );
        return usable.length
          ? { state: "exists", verified: true }
          : { state: "unavailable", verified: false };
      }
      // Source id + quote: go through the answer pipeline with a fake model
      // that cites the server label for that source (or an unissued label).
      const r = await retrieveMod.retrieve(registry(), {
        question: quote ?? sourceId ?? "",
        maxPassagesPerAuthority: 10,
        maxPassages: 30,
      });
      const { checkQuote } = (await loadModule<{
        checkQuote: (q: string, p: string) => { similarity: number };
      }>("lib/legal/verify"))!;
      let label = "S99";
      let best = -1;
      r.evidence.forEach((e, i) => {
        if (e.authority.provenance.providerRecordId !== sourceId) return;
        const sim = quote ? checkQuote(quote, e.passage.text).similarity : 1;
        if (sim > best) [best, label] = [sim, `S${i + 1}`];
      });
      const complete = async (req: { task: string }) => ({
        output:
          req.task === "research.draft"
            ? {
                summary: "s",
                analysis: [
                  {
                    text: "The claim.",
                    sources: [label],
                    quotes: quote ? [{ source: label, text: quote }] : [],
                  },
                ],
                contrary: [],
                limitations: [],
                nextSteps: [],
                insufficient: false,
              }
            : [{ claim: "C1", status: "supported", reason: "fake" }],
        modelId: "fake/model",
        provider: "fake",
        costUsd: 0,
      });
      const res = await researchMod.answerQuestion(quote ?? "", r, {
        complete,
      });
      const claim = res.claims[0];
      if (
        !claim ||
        claim.verificationStatus === "no_source" ||
        res.rejectedSourceRefs.length
      )
        return { state: "unavailable", verified: false };
      if (claim.quotes.some((q) => q.check.status === "mismatch"))
        return { state: "unsupported_quote", verified: false };
      return {
        state: "exists",
        verified: claim.verificationStatus === "supported",
      };
    },
  };
}

type LegalRetrieve = (
  registry: unknown,
  req: Record<string, unknown>,
) => Promise<{
  evidence: {
    passage: { text: string };
    authority: { provenance: { providerRecordId: string } };
  }[];
  authorities: { id: string }[];
  citations: { status: string; candidates: { id: string }[] }[];
  unresolvedCitations: string[];
}>;
type LegalAnswer = (
  question: string,
  retrieval: unknown,
  opts: Record<string, unknown>,
) => Promise<{
  claims: {
    verificationStatus: string;
    quotes: { check: { status: string } }[];
  }[];
  rejectedSourceRefs: string[];
}>;

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
  return null; // waiting for onboarding experience levels
}
