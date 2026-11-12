import { describe, expect, it } from "vitest";
import {
  AI_FUNCTIONS,
  MODELS,
  PILOT_FIRM,
  PIPELINES,
  TIERS,
  allowsDataClass,
  defaultPrimary,
  isModelId,
  pipelineCost,
  resolveRoute,
  runAiFunction,
  scenarioCost,
  type AiFunctionKey,
} from "@/lib/ai";

const keys = Object.keys(AI_FUNCTIONS) as AiFunctionKey[];

describe("AI function registry", () => {
  it("routes every function to catalog models allowed for its data", () => {
    for (const key of keys) {
      const route = resolveRoute(key, {});
      expect(route.chain.length, key).toBeGreaterThan(0);
      for (const id of route.chain) {
        expect(isModelId(id), `${key} -> ${id}`).toBe(true);
        if (isModelId(id))
          expect(
            allowsDataClass(MODELS[id], AI_FUNCTIONS[key].dataClass),
            `${key} -> ${id}`,
          ).toBe(true);
      }
    }
  });

  it("keeps the bulk tier for public data only", () => {
    for (const key of keys)
      if (AI_FUNCTIONS[key].tier === "bulk")
        expect(AI_FUNCTIONS[key].dataClass, key).toBe("public");
  });

  it("shares no vendor between a check and any model of the function it checks", () => {
    for (const key of keys) {
      const other = AI_FUNCTIONS[key].independentOf as
        AiFunctionKey | undefined;
      if (!other) continue;
      const theirs = new Set(
        resolveRoute(other, {}).specs.map((s) => s!.vendor),
      );
      for (const spec of resolveRoute(key, {}).specs)
        expect(theirs.has(spec!.vendor), `${key} ${spec!.id} vs ${other}`).toBe(
          false,
        );
    }
  });

  it("refuses overrides that break checker independence", () => {
    const env = (o: unknown) => ({ CASEVEX_AI_OVERRIDES: JSON.stringify(o) });
    expect(() =>
      resolveRoute(
        "research.verify_support",
        env({ "research.verify_support": "anthropic/claude-opus-5.5" }),
      ),
    ).toThrow(/independent of research.draft/);
    // the drafter moving onto the checker's vendor is caught too
    expect(() =>
      resolveRoute(
        "research.verify_support",
        env({ "tier:frontier": ["google/gemini-3.1-pro-preview"] }),
      ),
    ).toThrow(/shares its vendor/);
    expect(
      resolveRoute(
        "research.verify_support",
        env({
          "research.verify_support": "openai/gpt-6.1-terra",
          "research.draft": "anthropic/claude-opus-5.5",
        }),
      ).chain,
    ).toEqual(["openai/gpt-6.1-terra"]);
  });

  it("adds reasoning headroom and keeps reasoning on for models that require it", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response(
        JSON.stringify({
          model: "x",
          choices: [{ message: { content: "{}" } }],
          usage: { cost: 0 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const deps = {
      env: { OPENROUTER_API_KEY: "k" },
      fetch: fetchImpl,
      sleep: async () => {},
    };
    const m = [{ role: "user" as const, content: "q" }];
    await runAiFunction("research.verify_support", { messages: m }, deps);
    expect(bodies[0].reasoning).toBeUndefined();
    expect(bodies[0].max_tokens).toBe(400 + 2000);
    await runAiFunction("research.route", { messages: m }, deps);
    expect(bodies[1].reasoning).toEqual({ enabled: false });
    expect(bodies[1].max_tokens).toBe(150);
    await runAiFunction(
      "research.route",
      { messages: m },
      {
        ...deps,
        env: {
          ...deps.env,
          CASEVEX_AI_OVERRIDES: JSON.stringify({
            "research.route": "google/gemini-3.5-flash-lite",
          }),
        },
      },
    );
    expect(bodies[2].reasoning).toBeUndefined();
    expect(bodies[2].max_tokens).toBe(150 + 1000);
  });

  it("stays within each tier's per-call ceiling at typical sizes", () => {
    for (const key of keys) {
      const route = resolveRoute(key, {});
      const typical = scenarioCost().rows.find((r) => r.key === key)!;
      expect(typical.usdPerCall, key).toBeLessThan(route.maxUsdPerCall);
    }
  });

  it("keeps a research run inside the default $1.50 agent budget", () => {
    for (const name of Object.keys(PIPELINES))
      expect(pipelineCost(name), name).toBeLessThan(1.5);
  });

  it("produces a finite monthly estimate", () => {
    const { totalUsdPerMonth, byTier } = scenarioCost(PILOT_FIRM);
    expect(Number.isFinite(totalUsdPerMonth)).toBe(true);
    expect(totalUsdPerMonth).toBeGreaterThan(0);
    expect(Object.keys(byTier).sort()).toEqual(Object.keys(TIERS).sort());
  });
});

describe("model overrides", () => {
  const env = (o: unknown, extra: Record<string, string> = {}) => ({
    CASEVEX_AI_OVERRIDES: JSON.stringify(o),
    ...extra,
  });

  it("lets a function override beat a tier override", () => {
    const e = env({
      "tier:frontier": "openai/gpt-6.1-sol",
      "research.draft": ["google/gemini-3.1-pro-preview"],
    });
    expect(resolveRoute("research.draft", e).chain).toEqual([
      "google/gemini-3.1-pro-preview",
    ]);
    expect(resolveRoute("motion.draft", e).chain).toEqual([
      "openai/gpt-6.1-sol",
    ]);
    expect(resolveRoute("motion.draft", {}).chain[0]).toBe(
      defaultPrimary("motion.draft"),
    );
  });

  it("refuses public-only models for confidential functions", () => {
    expect(() =>
      resolveRoute(
        "research.draft",
        env({ "research.draft": "deepseek/deepseek-v4.1-flash" }),
      ),
    ).toThrow(/public data only/);
    expect(
      resolveRoute(
        "monitor.classify_event",
        env({ "monitor.classify_event": "qwen/qwen3.8-flash" }),
      ).chain,
    ).toEqual(["qwen/qwen3.8-flash"]);
  });

  it("allows unlisted models only as an experiment outside pilot", () => {
    const o = { "research.thread_title": "some-lab/new-model" };
    expect(() => resolveRoute("research.thread_title", env(o))).toThrow(
      /not in the model catalog/,
    );
    expect(
      resolveRoute(
        "research.thread_title",
        env(o, { CASEVEX_AI_EXPERIMENTS: "1" }),
      ).chain,
    ).toEqual(["some-lab/new-model"]);
    expect(() =>
      resolveRoute(
        "research.thread_title",
        env(o, { CASEVEX_AI_EXPERIMENTS: "1", CASEVEX_DEPLOYMENT: "pilot" }),
      ),
    ).toThrow(/pilot/);
  });

  it("rejects unknown keys and bad JSON", () => {
    expect(() =>
      resolveRoute("research.draft", { CASEVEX_AI_OVERRIDES: "{" }),
    ).toThrow(/valid JSON/);
    expect(() =>
      resolveRoute("research.draft", env({ "research.nope": "x" })),
    ).toThrow(/unknown key/);
  });
});
