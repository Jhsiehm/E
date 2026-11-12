// Model routing: the cheap path works when it should, falls back when a
// provider fails, and fails safely (never silently, never over budget, never
// sending confidential matter text to a non-approved model).

import { describe, expect, it } from "vitest";
import {
  openRouterCompletion,
  openRouterModel,
  scriptedFetch,
  type Step,
} from "../shared/fakes/scripted-fetch";
import { routingAdapter, THREADS, type RoutingRequest } from "./adapters";

const routing = await routingAdapter();

const TASK: RoutingRequest = {
  task: "research.answer",
  prompt: "Summarize the elements of a deceptive practices claim.",
};

async function withScript(
  req: RoutingRequest,
  primary: Step[],
  fallback: Step[] = [{ kind: "json", body: {} }],
) {
  const plan = await routing!.plan(req);
  const fb = plan.fallbacks[0];
  const fake = scriptedFetch([
    openRouterModel(plan.primary, primary),
    ...(fb
      ? [
          openRouterModel(
            fb,
            fallback.map((s) =>
              s.kind === "json" && !Object.keys(s.body as object).length
                ? {
                    kind: "json" as const,
                    body: openRouterCompletion(fb, "fallback answer"),
                  }
                : s,
            ),
          ),
        ]
      : []),
  ]);
  return { plan, fake, result: await routing!.run(req, fake) };
}

describe.skipIf(!routing)(`model routing [${THREADS.routing}]`, () => {
  it("uses the primary model when it is healthy", async () => {
    const plan = await routing!.plan(TASK);
    const { result } = await withScript(TASK, [
      {
        kind: "json",
        body: openRouterCompletion(plan.primary, "primary answer"),
      },
    ]);
    expect(result.ok).toBe(true);
    expect(result.modelUsed).toBe(plan.primary);
    expect(result.attempted).toEqual([plan.primary]);
  });

  for (const [label, step] of [
    [
      "429 rate limit",
      { kind: "http", status: 429, headers: { "retry-after": "0" } },
    ],
    ["503 outage", { kind: "http", status: 503 }],
    ["network error", { kind: "network" }],
    ["malformed JSON", { kind: "malformed" }],
  ] as [string, Step][]) {
    it(`falls back to the next model on ${label}`, async () => {
      const { plan, result } = await withScript(TASK, [step]);
      expect(
        plan.fallbacks.length,
        "task has no fallback configured",
      ).toBeGreaterThan(0);
      expect(result.ok).toBe(true);
      expect(result.modelUsed).toBe(plan.fallbacks[0]);
      expect(result.attempted[0]).toBe(plan.primary);
    });
  }

  it("fails loudly (not with an empty answer) when every model fails", async () => {
    const { result } = await withScript(
      TASK,
      [{ kind: "http", status: 503 }],
      [{ kind: "http", status: 503 }],
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.text ?? "").toBe("");
  });

  it("does not exceed a per-run budget", async () => {
    const req = { ...TASK, budgetUsd: 0.000001 };
    const plan = await routing!.plan(req);
    const { result } = await withScript(req, [
      {
        kind: "json",
        body: openRouterCompletion(plan.primary, "x", {
          prompt_tokens: 200_000,
          completion_tokens: 50_000,
        }),
      },
    ]);
    if (result.ok)
      expect(result.costUsd ?? 0).toBeLessThanOrEqual(req.budgetUsd);
    else expect(result.error).toMatch(/budget/i);
  });

  it.skipIf(!routing?.approvedForConfidential)(
    "confidential matter text only reaches approved models, including on fallback",
    async () => {
      const req = {
        ...TASK,
        confidential: true,
        prompt: "Client Jane Roe's privileged memo: ...",
      };
      const { fake } = await withScript(req, [{ kind: "http", status: 503 }]);
      for (const call of fake.calls) {
        const model = (call.body as { model?: string })?.model;
        expect(routing!.approvedForConfidential, `sent to ${model}`).toContain(
          model,
        );
      }
    },
  );

  it("never sends the API key anywhere but OpenRouter", async () => {
    const plan = await routing!.plan(TASK);
    const { fake } = await withScript(TASK, [
      { kind: "json", body: openRouterCompletion(plan.primary, "ok") },
    ]);
    for (const c of fake.calls)
      if (c.headers.authorization)
        expect(new URL(c.url).hostname).toMatch(/(^|\.)openrouter\.ai$/);
  });
});

describe.skipIf(!!routing)("model routing (pending)", () => {
  it.todo(
    `waiting on "${THREADS.routing}" to land; wire routingAdapter() in tests/cross-module/adapters.ts`,
  );
});
