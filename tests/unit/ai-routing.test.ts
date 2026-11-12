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

  it("uses a different vendor for independent checks", () => {
    for (const key of keys) {
      const other = AI_FUNCTIONS[key].independentOf as
        AiFunctionKey | undefined;
      if (!other) continue;
      const drafter = resolveRoute(other, {}).specs[0]!.vendor;
      for (const spec of resolveRoute(key, {}).specs)
        expect(spec!.vendor, `${key} vs ${other}`).not.toBe(drafter);
    }
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
